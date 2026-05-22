use rusqlite::{params, Connection};
use serde_json::json;

use crate::llm::config::RuntimeConfig;
use crate::llm::server_proxy::{self, PromptLlmParams};

fn extract_json(text: &str) -> Option<serde_json::Value> {
    let stripped = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim()
        .trim_end_matches("```")
        .trim();
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(stripped) {
        return Some(v);
    }
    if let Some(start) = stripped.find('{') {
        if let Some(end) = stripped.rfind('}') {
            let slice = &stripped[start..=end];
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(slice) {
                return Some(v);
            }
        }
    }
    None
}

fn normalize_review(raw: &serde_json::Value, raw_text: &str, model: &str) -> serde_json::Value {
    let score = raw
        .get("score")
        .and_then(|v| v.as_i64())
        .or_else(|| raw.get("totalScore").and_then(|v| v.as_i64()))
        .unwrap_or(0)
        .clamp(0, 100);
    let passed = raw
        .get("passed")
        .and_then(|v| v.as_bool())
        .unwrap_or(score >= 90);
    let status = raw
        .get("status")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| if passed { "passed".into() } else { "needs_revision".into() });
    json!({
        "passed": passed,
        "score": score,
        "status": status,
        "summary": raw.get("summary").cloned().unwrap_or_else(|| json!("")),
        "issues": raw.get("issues").cloned().unwrap_or_else(|| json!([])),
        "suggestions": raw.get("suggestions").cloned().unwrap_or_else(|| json!([])),
        "dimensions": raw.get("dimensions").cloned().unwrap_or_else(|| json!([])),
        "rawResponse": raw_text,
        "reviewModel": model,
    })
}

pub async fn run_prompt_quality_check(
    conn: &Connection,
    task_id: &str,
) -> Result<serde_json::Value, String> {
    let settings = crate::db::crud::get_app_settings(conn);
    if settings.text_key.trim().is_empty() || settings.text_endpoint.trim().is_empty() {
        return Err("API 未配置，无法执行提示词质量检查。".into());
    }

    let row: (String, String, Option<String>, String) = conn
        .query_row(
            "SELECT grid_groups_json, seedance_groups_json, generation_model, created_at
             FROM prompt_output_records
             WHERE task_id = ?1
             ORDER BY created_at DESC LIMIT 1",
            params![task_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| format!("未找到 prompt_output_records: {}", task_id))?;

    let runtime_config = RuntimeConfig {
        api_key: settings.text_key,
        api_base_url: settings.text_endpoint,
        default_model: settings.text_model,
        text_mode: settings.text_mode,
        mode: String::new(),
        image_endpoint: String::new(),
        image_key: String::new(),
        image_model: String::new(),
        review_threshold: settings.review_threshold as u8,
        enable_local_save: settings.enable_local_save,
    };
    let model = runtime_config.default_model.clone();

    let user_messages = vec![json!({
        "role": "user",
        "content": json!({
            "taskId": task_id,
            "gridGroupsJson": row.0,
            "seedanceGroupsJson": row.1,
            "generationModel": row.2,
            "createdAt": row.3,
            "requirement": "请对这批逐镜提示词做质量审核，输出严格 JSON，包含 score、passed、status、summary、issues、suggestions、dimensions。"
        }).to_string()
    })];

    let raw_text = server_proxy::request_prompt_llm(PromptLlmParams {
        runtime_config,
        prompt_slug: "prompt_review".into(),
        user_messages,
        temperature: Some(0.2),
    })
    .await?;

    if let Some(parsed) = extract_json(&raw_text) {
        Ok(normalize_review(&parsed, &raw_text, &model))
    } else {
        Ok(json!({
            "passed": false,
            "score": 0,
            "status": "parse_failed",
            "summary": "提示词质量检查模型返回了非 JSON 内容。",
            "issues": ["review response is not valid JSON"],
            "suggestions": ["检查 slug_prompt_review.txt 的输出格式约束，或重新运行质量检查。"],
            "dimensions": [],
            "rawResponse": raw_text,
            "reviewModel": model,
        }))
    }
}
