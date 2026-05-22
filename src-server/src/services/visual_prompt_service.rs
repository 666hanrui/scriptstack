use rusqlite::{params, Connection};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::llm::config::RuntimeConfig;
use crate::llm::server_proxy::{self, ContextualLlmParams};

#[derive(Clone)]
pub struct PreparedVisualAsset {
    pub project_id: String,
    pub task_id: String,
    pub asset_id: String,
    pub asset_type: String,
    pub asset_name: String,
    pub mode: String,
    pub snapshot: Value,
    pub source_hash: String,
    pub candidate_templates: Vec<Value>,
}

#[derive(Clone)]
pub struct SmartPromptPlan {
    pub runtime_config: RuntimeConfig,
    pub config_ready: bool,
    pub assets: Vec<PreparedVisualAsset>,
}

fn pick_str<'a>(payload: &'a Value, camel: &str, snake: &str) -> &'a str {
    payload[camel]
        .as_str()
        .or_else(|| payload[snake].as_str())
        .unwrap_or("")
}

fn string_set(payload: &Value, camel: &str, snake: &str) -> std::collections::HashSet<String> {
    let value = payload.get(camel).or_else(|| payload.get(snake));
    match value {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
            .filter(|s| !s.is_empty())
            .collect(),
        Some(Value::String(s)) if !s.trim().is_empty() => s
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        _ => std::collections::HashSet::new(),
    }
}

fn normalize_asset_type(value: &str) -> String {
    match value {
        "characters" | "role" | "roles" => "character".to_string(),
        "scenes" => "scene".to_string(),
        "props" => "prop".to_string(),
        other => other.to_string(),
    }
}

fn push_unique_id(ids: &mut Vec<String>, value: Option<&str>) {
    if let Some(value) = value {
        let value = value.trim();
        if !value.is_empty() && !ids.iter().any(|existing| existing == value) {
            ids.push(value.to_string());
        }
    }
}

fn asset_id_aliases(row: &Value, data: &Value) -> Vec<String> {
    let mut ids = Vec::new();
    push_unique_id(&mut ids, data.get("id").and_then(|v| v.as_str()));
    push_unique_id(&mut ids, data.get("assetId").and_then(|v| v.as_str()));
    push_unique_id(&mut ids, data.get("asset_id").and_then(|v| v.as_str()));
    push_unique_id(&mut ids, data.get("_assetUid").and_then(|v| v.as_str()));
    push_unique_id(&mut ids, row.get("id").and_then(|v| v.as_str()));
    push_unique_id(&mut ids, row.get("assetId").and_then(|v| v.as_str()));
    push_unique_id(&mut ids, row.get("asset_id").and_then(|v| v.as_str()));
    ids
}

fn asset_id_from_data(row: &Value, data: &Value) -> String {
    asset_id_aliases(row, data)
        .into_iter()
        .next()
        .unwrap_or_default()
}

fn asset_name(data: &Value, fallback: &str) -> String {
    data.get("name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(fallback)
        .trim()
        .to_string()
}

fn canonical_json_hash(value: &Value) -> String {
    let raw = serde_json::to_string(value).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

fn parse_asset_data(row: &Value) -> Value {
    row.get("assetDataJson")
        .or_else(|| row.get("asset_data_json"))
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .or_else(|| row.get("assetData").cloned())
        .or_else(|| row.get("asset_data").cloned())
        .unwrap_or_else(|| json!({}))
}

fn load_candidate_templates(conn: &Connection, asset_type: &str, mode: &str, asset_name: &str) -> Vec<Value> {
    let keywords = [
        format!("{} {}", asset_type, mode),
        asset_name.to_string(),
        asset_type.to_string(),
    ];
    for keyword in keywords {
        if keyword.trim().is_empty() {
            continue;
        }
        if let Ok(mut rows) = crate::db::crud::visual_search_templates(conn, Some(&keyword), None, Some("en")) {
            if !rows.is_empty() {
                rows.truncate(12);
                return rows;
            }
        }
    }
    crate::db::crud::visual_search_templates(conn, None, None, Some("en"))
        .unwrap_or_default()
        .into_iter()
        .take(12)
        .collect()
}

pub fn prepare_smart_prompt_plan(conn: &Connection, payload: &Value) -> Result<SmartPromptPlan, String> {
    let task_id = pick_str(payload, "taskId", "task_id").to_string();
    if task_id.is_empty() {
        return Err("visual/smart-generate-asset-prompt 缺少 taskId".to_string());
    }
    let mode = pick_str(payload, "mode", "mode");
    let mode = match mode {
        "storyboard" | "video" => mode.to_string(),
        _ => "image".to_string(),
    };
    let asset_ids = string_set(payload, "assetIds", "asset_ids");
    let asset_types = string_set(payload, "assetTypes", "asset_types")
        .into_iter()
        .map(|s| normalize_asset_type(&s))
        .collect::<std::collections::HashSet<_>>();
    let project_id = conn
        .query_row(
            "SELECT project_id FROM script_tasks WHERE id = ?1",
            params![task_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_default();
    if project_id.is_empty() {
        return Err("找不到该 script task 对应的 project_id".to_string());
    }

    let settings = crate::db::crud::get_app_settings(conn);
    let config_ready = !settings.text_key.trim().is_empty() && !settings.text_endpoint.trim().is_empty();
    let runtime_config = RuntimeConfig {
        api_key: settings.text_key,
        api_base_url: settings.text_endpoint,
        default_model: settings.text_model,
        text_mode: settings.text_mode,
        mode: "local-configured".into(),
        image_endpoint: String::new(),
        image_key: String::new(),
        image_model: String::new(),
        review_threshold: settings.review_threshold as u8,
        enable_local_save: settings.enable_local_save,
    };

    let mut assets = Vec::new();
    for row in crate::db::crud::get_assets_by_task(conn, &task_id) {
        let ty = normalize_asset_type(row["assetType"].as_str().unwrap_or(""));
        if !matches!(ty.as_str(), "character" | "scene" | "prop") {
            continue;
        }
        if !asset_types.is_empty() && !asset_types.contains(&ty) {
            continue;
        }
        let data = parse_asset_data(&row);
        let asset_id = asset_id_from_data(&row, &data);
        if asset_id.is_empty() {
            continue;
        }
        if !asset_ids.is_empty() && !asset_ids.contains(&asset_id) {
            continue;
        }
        let name = asset_name(&data, &asset_id);
        let candidate_templates = load_candidate_templates(conn, &ty, &mode, &name);
        let snapshot = json!({
            "assetId": asset_id,
            "assetType": ty,
            "assetName": name,
            "chineseAsset": data,
        });
        assets.push(PreparedVisualAsset {
            project_id: project_id.clone(),
            task_id: task_id.clone(),
            asset_id,
            asset_type: ty,
            asset_name: name,
            mode: mode.clone(),
            source_hash: canonical_json_hash(&snapshot),
            snapshot,
            candidate_templates,
        });
    }

    if assets.is_empty() {
        return Err("没有匹配到可生成视觉标准件的角色/场景/道具资产".to_string());
    }

    Ok(SmartPromptPlan {
        runtime_config,
        config_ready,
        assets,
    })
}

fn extract_json_object(text: &str) -> Option<Value> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    serde_json::from_str::<Value>(&text[start..=end]).ok()
}

fn contains_cjk(text: &str) -> bool {
    text.chars()
        .any(|c| matches!(c as u32, 0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0xF900..=0xFAFF))
}

fn has_unfilled_placeholders(text: &str) -> bool {
    let patterns = ["[SUBJECT]", "[SETTING]", "{", "}", "<", ">", "TODO", "TBD"];
    patterns.iter().any(|p| text.contains(p))
}

fn local_quality(prompt_en: &str, asset_type: &str) -> Value {
    let contains_chinese = contains_cjk(prompt_en);
    let has_placeholders = has_unfilled_placeholders(prompt_en);
    let lower = prompt_en.to_lowercase();
    let preserved_negative_constraints = lower.contains("no ")
        || lower.contains("without ")
        || lower.contains("forbid")
        || lower.contains("avoid");
    let scene_without_people_ok = asset_type != "scene"
        || !(lower.contains("empty establishing shot") || lower.contains("no people"))
        || (!lower.contains("person") && !lower.contains("human figure"));

    json!({
        "containsChinese": contains_chinese,
        "hasUnfilledPlaceholders": has_placeholders,
        "preservedVisualAnchors": prompt_en.len() > 240,
        "preservedNegativeConstraints": preserved_negative_constraints,
        "assetTypeCompatible": scene_without_people_ok,
        "localChecks": true
    })
}

async fn generate_one(asset: &PreparedVisualAsset, runtime_config: &RuntimeConfig) -> Result<Value, String> {
    let context_params = json!({
        "mode": asset.mode,
        "assetType": asset.asset_type,
        "asset": asset.snapshot,
        "candidateTemplates": asset.candidate_templates,
    });
    let text = server_proxy::request_contextual_llm_stream(
        ContextualLlmParams {
            runtime_config: runtime_config.clone(),
            context_type: "visual_smart_asset_prompt".into(),
            context_params,
            temperature: Some(0.2),
            max_tokens_override: Some(8192),
        },
        |_chunk| {},
    )
    .await?;

    let parsed = extract_json_object(&text).ok_or_else(|| {
        let preview: String = text.chars().take(220).collect();
        format!("视觉标准件生成失败：模型未返回 JSON。预览：{}", preview)
    })?;
    let prompt_text_en = parsed["promptTextEn"]
        .as_str()
        .or_else(|| parsed["prompt_text_en"].as_str())
        .or_else(|| parsed["promptText"].as_str())
        .or_else(|| parsed["prompt_text"].as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if prompt_text_en.is_empty() {
        return Err(format!("{} 缺少 promptTextEn", asset.asset_name));
    }
    let mut quality = parsed
        .get("quality")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let local = local_quality(&prompt_text_en, &asset.asset_type);
    if let Some(obj) = quality.as_object_mut() {
        if let Some(local_obj) = local.as_object() {
            for (k, v) in local_obj {
                obj.insert(k.clone(), v.clone());
            }
        }
    } else {
        quality = local;
    }
    if quality["containsChinese"].as_bool().unwrap_or(false) {
        return Err(format!("{} 的英文 AIPROMPT 仍含中文，已拒绝保存。请重试。", asset.asset_name));
    }
    if quality["hasUnfilledPlaceholders"].as_bool().unwrap_or(false) {
        return Err(format!("{} 的英文 AIPROMPT 仍有未填占位符，已拒绝保存。请重试。", asset.asset_name));
    }

    let selected_ids = parsed["selectedTemplateIds"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let review_text_zh = parsed["reviewTextZh"]
        .as_str()
        .or_else(|| parsed["review_text_zh"].as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    Ok(json!({
        "projectId": asset.project_id,
        "scriptTaskId": asset.task_id,
        "assetType": asset.asset_type,
        "assetId": asset.asset_id,
        "outputType": asset.mode,
        "templateId": selected_ids.first().cloned().unwrap_or_else(|| "smart-auto".to_string()),
        "title": format!("{} · English AIPROMPT ({})", asset.asset_name, asset.mode),
        "promptText": prompt_text_en,
        "promptTextEn": prompt_text_en,
        "reviewTextZh": review_text_zh,
        "promptLanguage": "en",
        "platformPreset": "copy-only",
        "paramsJson": serde_json::to_string(&json!({"mode": asset.mode, "assetName": asset.asset_name})).unwrap_or_else(|_| "{}".to_string()),
        "attributionJson": serde_json::to_string(&json!({"source": "ScriptStack LLM smart compiler", "templateSource": "visual_prompt_templates"})).unwrap_or_else(|_| "{}".to_string()),
        "sourceAssetSnapshotJson": serde_json::to_string(&asset.snapshot).unwrap_or_else(|_| "{}".to_string()),
        "sourceAssetHash": asset.source_hash,
        "selectedTemplateIdsJson": serde_json::to_string(&selected_ids).unwrap_or_else(|_| "[]".to_string()),
        "generationMode": asset.mode,
        "qualityJson": serde_json::to_string(&quality).unwrap_or_else(|_| "{}".to_string()),
        "quality": quality
    }))
}

pub async fn generate_smart_prompt_payloads(plan: SmartPromptPlan) -> Result<Vec<Value>, String> {
    if !plan.config_ready {
        return Err("文本模型 API 未配置，无法生成英文 AIPROMPT。请先到设置页配置 DeepSeek / OpenAI / Claude / Gemini 等文本模型。".to_string());
    }

    let mut out = Vec::new();
    for asset in &plan.assets {
        out.push(generate_one(asset, &plan.runtime_config).await?);
    }
    Ok(out)
}

pub fn save_smart_prompt_payloads(conn: &Connection, payloads: &[Value]) -> Result<Vec<Value>, String> {
    let mut saved = Vec::new();
    for payload in payloads {
        let meta = crate::db::crud::visual_save_output(conn, payload)?;
        let mut row = payload.clone();
        if let Some(obj) = row.as_object_mut() {
            obj.insert("id".into(), meta["id"].clone());
            obj.insert("version".into(), meta["version"].clone());
            obj.insert("createdAt".into(), meta["createdAt"].clone());
        }
        saved.push(row);
    }
    Ok(saved)
}

pub fn build_visual_standard_context(conn: &Connection, task_id: &str) -> Result<String, String> {
    let assets = crate::db::crud::get_assets_by_task(conn, task_id);
    if assets.is_empty() {
        return Ok(json!({"characters":[],"scenes":[],"props":[],"missing":[]}).to_string());
    }

    let project_id: String = conn
        .query_row(
            "SELECT project_id FROM script_tasks WHERE id = ?1",
            params![task_id],
            |row| row.get(0),
        )
        .unwrap_or_default();

    let mut stmt = conn
        .prepare(
            "SELECT asset_id, asset_type, title, COALESCE(NULLIF(prompt_text_en, ''), prompt_text), review_text_zh, generation_mode, source_asset_hash, created_at
             FROM visual_prompt_outputs
             WHERE (script_task_id = ?1 OR (?2 <> '' AND project_id = ?2))
               AND COALESCE(NULLIF(prompt_text_en, ''), prompt_text) <> ''
             ORDER BY CASE WHEN script_task_id = ?1 THEN 0 ELSE 1 END, created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let mut latest: std::collections::HashMap<String, Value> = std::collections::HashMap::new();
    let rows = stmt
        .query_map(params![task_id, project_id], |row| {
            Ok(json!({
                "assetId": row.get::<_, String>(0)?,
                "assetType": normalize_asset_type(&row.get::<_, String>(1)?),
                "title": row.get::<_, String>(2)?,
                "promptTextEn": row.get::<_, String>(3)?,
                "reviewTextZh": row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                "generationMode": row.get::<_, Option<String>>(5)?.unwrap_or_else(|| "image".to_string()),
                "sourceAssetHash": row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                "createdAt": row.get::<_, String>(7)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    for row in rows.flatten() {
        let asset_id = row["assetId"].as_str().unwrap_or("").to_string();
        let asset_type = row["assetType"].as_str().unwrap_or("").to_string();
        if asset_id.is_empty() {
            continue;
        }
        latest
            .entry(format!("{}:{}", asset_type, asset_id))
            .or_insert_with(|| row.clone());
        latest.entry(asset_id).or_insert(row);
    }

    let mut characters = Vec::new();
    let mut scenes = Vec::new();
    let mut props = Vec::new();
    let mut missing = Vec::new();

    for row in assets {
        let ty = normalize_asset_type(row["assetType"].as_str().unwrap_or(""));
        if !matches!(ty.as_str(), "character" | "scene" | "prop") {
            continue;
        }
        let data = parse_asset_data(&row);
        let asset_id = asset_id_from_data(&row, &data);
        let name = asset_name(&data, &asset_id);
        let aliases = asset_id_aliases(&row, &data);
        let prompt = aliases
            .iter()
            .find_map(|alias| latest.get(&format!("{}:{}", ty, alias)).or_else(|| latest.get(alias)));
        if let Some(prompt) = prompt {
            let item = json!({
                "assetId": asset_id,
                "assetType": ty,
                "name": name,
                "promptTextEn": prompt["promptTextEn"],
                "reviewTextZh": prompt["reviewTextZh"],
                "generationMode": prompt["generationMode"],
                "sourceAssetHash": prompt["sourceAssetHash"],
            });
            match ty.as_str() {
                "character" => characters.push(item),
                "scene" => scenes.push(item),
                "prop" => props.push(item),
                _ => {}
            }
        } else {
            missing.push(json!({"assetId": asset_id, "assetType": ty, "name": name}));
        }
    }

    if !missing.is_empty() {
        let matched_count = characters.len() + scenes.len() + props.len();
        return Err(format!(
            "缺少英文视觉标准件，请先在视觉提示词工坊生成 AIPROMPT（已匹配 {} 个，缺少 {} 个）：{}",
            matched_count,
            missing.len(),
            serde_json::to_string(&missing).unwrap_or_default()
        ));
    }

    Ok(json!({
        "standard": "English AIPROMPT visual standard parts",
        "characters": characters,
        "scenes": scenes,
        "props": props,
        "missing": []
    })
    .to_string())
}
