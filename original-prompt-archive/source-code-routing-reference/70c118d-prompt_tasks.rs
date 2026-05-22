use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

use crate::llm::config::RuntimeConfig;
use crate::llm::server_proxy::{self, PromptLlmParams};

fn now() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

fn uuid() -> String {
    Uuid::new_v4().to_string()
}

fn runtime_config(conn: &Connection) -> RuntimeConfig {
    let settings = crate::db::crud::get_app_settings(conn);
    RuntimeConfig {
        api_key: settings.text_key,
        api_base_url: settings.text_endpoint,
        default_model: settings.text_model,
        text_mode: settings.text_mode,
        mode: "local-configured".into(),
        image_endpoint: settings.image_endpoint,
        image_key: settings.image_key,
        image_model: settings.image_model,
        review_threshold: settings.review_threshold as u8,
        enable_local_save: settings.enable_local_save,
    }
}

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
    let start = stripped.find('{')?;
    let end = stripped.rfind('}')?;
    serde_json::from_str(&stripped[start..=end]).ok()
}

fn normalize_sections(
    value: Option<&serde_json::Value>,
    fallback_title: &str,
    raw: &str,
) -> Vec<serde_json::Value> {
    let sections = value
        .and_then(|v| v.get("sections"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut normalized = Vec::new();
    for (index, section) in sections.iter().enumerate() {
        let title = section
            .get("title")
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format!("分段 {}", index + 1));
        let content = section
            .get("content")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .or_else(|| {
                section
                    .get("lines")
                    .and_then(|v| v.as_array())
                    .map(|lines| {
                        lines
                            .iter()
                            .filter_map(|line| line.as_str())
                            .collect::<Vec<_>>()
                            .join("\n")
                    })
            })
            .unwrap_or_default();

        if !content.trim().is_empty() {
            normalized.push(json!({ "title": title, "content": content }));
        }
    }

    if normalized.is_empty() {
        normalized.push(json!({ "title": fallback_title, "content": raw.trim() }));
    }
    normalized
}

fn project_name(conn: &Connection, project_id: &str, fallback: &str) -> String {
    conn.query_row(
        "SELECT name FROM projects WHERE id = ?1",
        params![project_id],
        |row| row.get::<_, String>(0),
    )
    .unwrap_or_else(|_| fallback.to_string())
}

fn upsert_image_task(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<(String, String), String> {
    let t = now();
    if let Some(task_id) = input["existingTaskId"]
        .as_str()
        .or_else(|| input["taskId"].as_str())
        .filter(|s| !s.is_empty())
    {
        let project_id = conn
            .query_row(
                "SELECT project_id FROM image_tasks WHERE id = ?1",
                params![task_id],
                |row| row.get::<_, String>(0),
            )
            .map_err(|_| "图片提示词任务不存在，请先保存草稿。".to_string())?;
        return Ok((project_id, task_id.to_string()));
    }

    let project_id = input["existingProjectId"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(uuid);
    let task_id = uuid();
    conn.execute(
        "INSERT INTO projects (id, name, module_type, status, created_at, updated_at)
         VALUES (?1, '图片提示词', 'image', 'active', ?2, ?3)
         ON CONFLICT(id) DO NOTHING",
        params![project_id, t, t],
    )
    .ok();
    conn.execute(
        "INSERT INTO image_tasks (id, project_id, mode, source_script, visual_style, image_goal, stage, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'generating', ?7, ?8)",
        params![
            task_id,
            project_id,
            input["mode"].as_str().unwrap_or("single"),
            input["sourceScript"].as_str().unwrap_or_default(),
            input["visualStyle"].as_str().unwrap_or_default(),
            input["imageGoal"].as_str().unwrap_or_default(),
            t,
            t,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok((project_id, task_id))
}

fn upsert_video_task(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<(String, String), String> {
    let t = now();
    if let Some(task_id) = input["existingTaskId"]
        .as_str()
        .or_else(|| input["taskId"].as_str())
        .filter(|s| !s.is_empty())
    {
        let project_id = conn
            .query_row(
                "SELECT project_id FROM video_tasks WHERE id = ?1",
                params![task_id],
                |row| row.get::<_, String>(0),
            )
            .map_err(|_| "视频提示词任务不存在，请先保存草稿。".to_string())?;
        return Ok((project_id, task_id.to_string()));
    }

    let project_id = input["existingProjectId"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(uuid);
    let task_id = uuid();
    conn.execute(
        "INSERT INTO projects (id, name, module_type, status, created_at, updated_at)
         VALUES (?1, '视频提示词', 'video', 'active', ?2, ?3)
         ON CONFLICT(id) DO NOTHING",
        params![project_id, t, t],
    )
    .ok();
    conn.execute(
        "INSERT INTO video_tasks (id, project_id, mode, script_beats, video_style, motion_focus, stage, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'generating', ?7, ?8)",
        params![
            task_id,
            project_id,
            input["mode"].as_str().unwrap_or("beat"),
            input["scriptBeats"].as_str().unwrap_or_default(),
            input["videoStyle"].as_str().unwrap_or_default(),
            input["motionFocus"].as_str().unwrap_or_default(),
            t,
            t,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok((project_id, task_id))
}

pub async fn run_image_prompt_generation(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let (project_id, task_id) = upsert_image_task(conn, input)?;
    let cfg = runtime_config(conn);
    let source_script = input["sourceScript"].as_str().unwrap_or_default();
    if source_script.trim().is_empty() {
        return Err("没有可承接的剧本内容，请先完成或导入剧本。".into());
    }

    let payload = json!({
        "mode": input["mode"].as_str().unwrap_or("single"),
        "sourceScript": source_script,
        "visualStyle": input["visualStyle"].as_str().unwrap_or_default(),
        "imageGoal": input["imageGoal"].as_str().unwrap_or("分镜提示词"),
    });
    let completion = server_proxy::request_prompt_llm(PromptLlmParams {
        runtime_config: cfg.clone(),
        prompt_slug: "image_prompt_generation".into(),
        user_messages: vec![json!({"role": "user", "content": payload.to_string()})],
        temperature: Some(0.45),
    })
    .await?;

    let parsed = extract_json(&completion);
    let sections = normalize_sections(parsed.as_ref(), "完整分镜提示词", &completion);
    let generated_at = now();
    let sections_json = serde_json::to_string(&sections).unwrap_or_default();
    let raw = json!({ "completion": completion, "parsed": parsed }).to_string();

    conn.execute(
        "UPDATE image_tasks SET stage = 'ready', updated_at = ?1 WHERE id = ?2",
        params![generated_at, task_id],
    )
    .ok();
    conn.execute(
        "DELETE FROM image_outputs WHERE task_id = ?1",
        params![task_id],
    )
    .ok();
    conn.execute(
        "INSERT INTO image_outputs (id, task_id, sections_json, raw_response, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![uuid(), task_id, sections_json, raw, generated_at],
    )
    .ok();

    Ok(json!({
        "projectId": project_id,
        "taskId": task_id,
        "projectName": project_name(conn, &project_id, "图片提示词"),
        "sections": sections,
        "generatedAt": generated_at,
        "generationModel": format!("local-image-prompt / {}", cfg.default_model),
    }))
}

pub async fn run_video_prompt_generation(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let (project_id, task_id) = upsert_video_task(conn, input)?;
    let cfg = runtime_config(conn);
    let script_beats = input["scriptBeats"].as_str().unwrap_or_default();
    if script_beats.trim().is_empty() {
        return Err("没有可承接的剧本内容，请先完成或导入剧本。".into());
    }

    let payload = json!({
        "mode": input["mode"].as_str().unwrap_or("beat"),
        "scriptBeats": script_beats,
        "videoStyle": input["videoStyle"].as_str().unwrap_or_default(),
        "motionFocus": input["motionFocus"].as_str().unwrap_or_default(),
    });
    let completion = server_proxy::request_prompt_llm(PromptLlmParams {
        runtime_config: cfg.clone(),
        prompt_slug: "video_prompt_generation".into(),
        user_messages: vec![json!({"role": "user", "content": payload.to_string()})],
        temperature: Some(0.45),
    })
    .await?;

    let parsed = extract_json(&completion);
    let sections = normalize_sections(parsed.as_ref(), "完整视频提示词", &completion);
    let generated_at = now();
    let sections_json = serde_json::to_string(&sections).unwrap_or_default();
    let raw = json!({ "completion": completion, "parsed": parsed }).to_string();

    conn.execute(
        "UPDATE video_tasks SET stage = 'ready', updated_at = ?1 WHERE id = ?2",
        params![generated_at, task_id],
    )
    .ok();
    conn.execute(
        "DELETE FROM video_outputs WHERE task_id = ?1",
        params![task_id],
    )
    .ok();
    conn.execute(
        "INSERT INTO video_outputs (id, task_id, sections_json, raw_response, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![uuid(), task_id, sections_json, raw, generated_at],
    )
    .ok();

    Ok(json!({
        "projectId": project_id,
        "taskId": task_id,
        "projectName": project_name(conn, &project_id, "视频提示词"),
        "sections": sections,
        "generatedAt": generated_at,
        "generationModel": format!("local-video-prompt / {}", cfg.default_model),
    }))
}

fn load_prompt_text(conn: &Connection, table: &str, task_id: &str) -> Result<String, String> {
    let sql = format!(
        "SELECT sections_json FROM {} WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1",
        table
    );
    let sections_json: String = conn
        .query_row(&sql, params![task_id], |row| row.get(0))
        .map_err(|_| "当前任务还没有可审核的提示词结果，请先生成。".to_string())?;
    let sections: Vec<serde_json::Value> = serde_json::from_str(&sections_json).unwrap_or_default();
    let text = sections
        .iter()
        .map(|section| {
            let title = section["title"].as_str().unwrap_or("");
            let content = section["content"].as_str().unwrap_or("");
            format!("{}\n{}", title, content)
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    Ok(text)
}

fn heuristic_review(text: &str, threshold: u8) -> serde_json::Value {
    let mut score = 70;
    for key in [
        "角色", "镜头", "场景", "光线", "构图", "禁止", "负面", "转场",
    ] {
        if text.contains(key) {
            score += 3;
        }
    }
    let score = score.clamp(0, 96);
    let status = if score >= threshold as i32 {
        "passed"
    } else {
        "failed"
    };
    json!({
        "score": score,
        "status": status,
        "summary": if status == "passed" { "提示词结构完整，可以进入后续生成。" } else { "提示词可用，但稳定性约束还需要补强。" },
        "issues": if status == "passed" { Vec::<String>::new() } else { vec!["角色/场景/负面约束中至少一项不够明确".to_string()] },
        "suggestions": vec!["补充角色稳定词、场景锚点、镜头运动和禁止项。"],
    })
}

async fn review_prompt_text(
    conn: &Connection,
    _task_id: &str,
    module_type: &str,
    text: &str,
) -> Result<serde_json::Value, String> {
    let cfg = runtime_config(conn);
    if cfg.api_key.trim().is_empty() || cfg.api_base_url.trim().is_empty() {
        return Ok(heuristic_review(text, cfg.review_threshold));
    }

    let payload = json!({
        "moduleType": module_type,
        "threshold": cfg.review_threshold,
        "promptText": text,
    });
    let completion = server_proxy::request_prompt_llm(PromptLlmParams {
        runtime_config: cfg.clone(),
        prompt_slug: "prompt_review".into(),
        user_messages: vec![json!({"role": "user", "content": payload.to_string()})],
        temperature: Some(0.2),
    })
    .await?;

    let parsed =
        extract_json(&completion).unwrap_or_else(|| heuristic_review(text, cfg.review_threshold));
    let score = parsed["score"].as_i64().unwrap_or(70).clamp(0, 100) as i32;
    let status = if score >= cfg.review_threshold as i32 {
        "passed"
    } else {
        "failed"
    };
    Ok(json!({
        "score": score,
        "status": parsed["status"].as_str().filter(|s| *s == "passed" || *s == "failed").unwrap_or(status),
        "summary": parsed["summary"].as_str().unwrap_or("审核完成。"),
        "issues": parsed["issues"].as_array().cloned().unwrap_or_default(),
        "suggestions": parsed["suggestions"].as_array().cloned().unwrap_or_default(),
        "reviewModel": format!("local-prompt-review / {}", cfg.default_model),
    }))
}

pub async fn run_image_prompt_review(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let task_id = input["taskId"].as_str().unwrap_or("");
    let text = load_prompt_text(conn, "image_outputs", task_id)?;
    let review = review_prompt_text(conn, task_id, "image", &text).await?;
    let t = now();
    conn.execute(
        "INSERT INTO image_review_records (id, task_id, score, status, summary, issues_json, suggestions_json, review_model, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            uuid(),
            task_id,
            review["score"].as_i64().unwrap_or(0) as i32,
            review["status"].as_str().unwrap_or("failed"),
            review["summary"].as_str().unwrap_or_default(),
            review["issues"].to_string(),
            review["suggestions"].to_string(),
            review["reviewModel"].as_str().unwrap_or("local-prompt-review"),
            t,
        ],
    )
    .ok();
    Ok(review)
}

pub async fn run_video_prompt_review(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let task_id = input["taskId"].as_str().unwrap_or("");
    let text = load_prompt_text(conn, "video_outputs", task_id)?;
    let review = review_prompt_text(conn, task_id, "video", &text).await?;
    let t = now();
    conn.execute(
        "INSERT INTO video_review_records (id, task_id, score, status, summary, issues_json, suggestions_json, review_model, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            uuid(),
            task_id,
            review["score"].as_i64().unwrap_or(0) as i32,
            review["status"].as_str().unwrap_or("failed"),
            review["summary"].as_str().unwrap_or_default(),
            review["issues"].to_string(),
            review["suggestions"].to_string(),
            review["reviewModel"].as_str().unwrap_or("local-prompt-review"),
            t,
        ],
    )
    .ok();
    Ok(review)
}
