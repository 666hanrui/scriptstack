use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

use crate::llm::config::RuntimeConfig;
use crate::llm::server_proxy::{self, PromptLlmParams};

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

fn uuid() -> String {
    Uuid::new_v4().to_string()
}

fn array_from_text(text: &str) -> Option<Vec<serde_json::Value>> {
    let text = text.trim();
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(arr) = v.as_array() {
            return Some(arr.clone());
        }
        if let Some(obj) = v.as_object() {
            for val in obj.values() {
                if let Some(arr) = val.as_array() {
                    if !arr.is_empty() {
                        return Some(arr.clone());
                    }
                }
            }
        }
    }
    let start = text.find('[')?;
    let end = text.rfind(']')?;
    serde_json::from_str::<Vec<serde_json::Value>>(&text[start..=end]).ok()
}

fn parse_asset_list(raw: &str, label: &str) -> Result<Vec<serde_json::Value>, String> {
    if raw.trim().is_empty() {
        return Ok(vec![]);
    }
    serde_json::from_str::<Vec<serde_json::Value>>(raw)
        .map_err(|e| format!("{} JSON 解析失败: {}", label, e))
}

fn ensure_string(obj: &mut serde_json::Map<String, serde_json::Value>, key: &str, fallback: &str) {
    let should_fill = obj.get(key).and_then(|v| v.as_str()).map(|s| s.trim().is_empty()).unwrap_or(true);
    if should_fill {
        obj.insert(key.to_string(), json!(fallback));
    }
}

fn ensure_array(obj: &mut serde_json::Map<String, serde_json::Value>, key: &str) {
    if !obj.get(key).map(|v| v.is_array()).unwrap_or(false) {
        obj.insert(key.to_string(), json!([]));
    }
}

fn object_with_raw(raw: &serde_json::Value) -> serde_json::Map<String, serde_json::Value> {
    raw.as_object().cloned().unwrap_or_default()
}

fn normalize_character(raw: &serde_json::Value) -> serde_json::Value {
    let mut obj = object_with_raw(raw);
    let id = raw
        .get("id")
        .or_else(|| raw.get("assetId"))
        .or_else(|| raw.get("_assetUid"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(uuid);
    obj.insert("id".into(), json!(id));
    ensure_string(&mut obj, "name", "Unknown");
    ensure_string(&mut obj, "role", "Unknown");
    ensure_array(&mut obj, "aliases");
    ensure_string(&mut obj, "appearance", "");
    ensure_string(&mut obj, "clothing", "");
    ensure_string(&mut obj, "personality", "");
    ensure_string(&mut obj, "colorPalette", "");
    ensure_string(&mut obj, "visualAnchor", "");
    ensure_string(&mut obj, "aiPrompt", "");
    serde_json::Value::Object(obj)
}

fn normalize_scene(raw: &serde_json::Value) -> serde_json::Value {
    let mut obj = object_with_raw(raw);
    let id = raw
        .get("id")
        .or_else(|| raw.get("assetId"))
        .or_else(|| raw.get("_assetUid"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(uuid);
    obj.insert("id".into(), json!(id));
    ensure_string(&mut obj, "name", "Unknown");
    ensure_array(&mut obj, "aliases");
    ensure_string(&mut obj, "timeOfDay", "");
    ensure_string(&mut obj, "atmosphere", "");
    ensure_string(&mut obj, "materials", "");
    ensure_string(&mut obj, "landmarks", "");
    ensure_string(&mut obj, "colorTemperature", "");
    ensure_string(&mut obj, "visualAnchor", "");
    ensure_string(&mut obj, "aiPrompt", "");
    serde_json::Value::Object(obj)
}

fn normalize_prop(raw: &serde_json::Value) -> serde_json::Value {
    let mut obj = object_with_raw(raw);
    let id = raw
        .get("id")
        .or_else(|| raw.get("assetId"))
        .or_else(|| raw.get("_assetUid"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(uuid);
    obj.insert("id".into(), json!(id));
    ensure_string(&mut obj, "name", "Unknown");
    ensure_array(&mut obj, "aliases");
    ensure_string(&mut obj, "dramaticFunction", "");
    ensure_string(&mut obj, "form", "");
    ensure_string(&mut obj, "material", "");
    ensure_string(&mut obj, "surfaceState", "");
    ensure_string(&mut obj, "visualAnchor", "");
    ensure_string(&mut obj, "aiPrompt", "");
    serde_json::Value::Object(obj)
}

fn fallback_characters(text: &str) -> Vec<serde_json::Value> {
    let re = regex_lite::Regex::new(r"\*\*(.{1,8})\*\*(?:\s*(?:（[^）]*）))?\s*[：:]").unwrap();
    let mut out = vec![];
    let mut seen = std::collections::HashSet::new();
    for cap in re.captures_iter(text) {
        let name = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("");
        if name.is_empty() || name.starts_with("场景") || name.starts_with("出场") || seen.contains(name) {
            continue;
        }
        seen.insert(name.to_string());
        out.push(json!({"id": uuid(), "name": name, "role": "", "aliases": [], "appearance": "", "clothing": "", "personality": "", "colorPalette": "", "visualAnchor": "", "aiPrompt": "", "source": "regex-fallback"}));
    }
    out
}

fn fallback_scenes(text: &str) -> Vec<serde_json::Value> {
    let re = regex_lite::Regex::new(r"\*\*场景[：:]\*\*\s*([^\n]+)").unwrap();
    let mut out = vec![];
    let mut seen = std::collections::HashSet::new();
    for cap in re.captures_iter(text) {
        let name = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("");
        if name.is_empty() || seen.contains(name) {
            continue;
        }
        seen.insert(name.to_string());
        out.push(json!({"id": uuid(), "name": name, "aliases": [], "timeOfDay": "", "atmosphere": "", "materials": "", "landmarks": "", "colorTemperature": "", "visualAnchor": "", "aiPrompt": "", "source": "regex-fallback"}));
    }
    out
}

fn fallback_props(_text: &str) -> Vec<serde_json::Value> {
    vec![]
}

fn asset_name(value: &serde_json::Value) -> String {
    value
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

fn asset_id(value: &serde_json::Value) -> Option<String> {
    value
        .get("id")
        .or_else(|| value.get("assetId"))
        .or_else(|| value.get("_assetUid"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn existing_asset_index(
    conn: &Connection,
    task_id: &str,
) -> Result<std::collections::HashMap<(String, String), String>, String> {
    let mut index = std::collections::HashMap::new();
    let mut stmt = conn
        .prepare("SELECT id, asset_type, asset_data_json FROM asset_records WHERE task_id = ?1")
        .map_err(|e| format!("读取旧资产索引失败: {}", e))?;
    let rows = stmt
        .query_map(params![task_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("遍历旧资产索引失败: {}", e))?;

    for row in rows.flatten() {
        let (row_id, ty, raw) = row;
        let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));
        if let Some(id) = asset_id(&parsed) {
            index.insert((ty.clone(), format!("id:{}", id)), row_id.clone());
        }
        let name = asset_name(&parsed);
        if !name.is_empty() {
            index.insert((ty.clone(), format!("name:{}", name)), row_id.clone());
        }
    }
    Ok(index)
}

fn upsert_asset(
    conn: &Connection,
    task_id: &str,
    ty: &str,
    item: &serde_json::Value,
    time: &str,
    index: &std::collections::HashMap<(String, String), String>,
    kept: &mut Vec<String>,
) -> Result<(), String> {
    let mut item = item.clone();
    let mut id = asset_id(&item).unwrap_or_else(uuid);
    let name = asset_name(&item);
    if let Some(existing) = index.get(&(ty.to_string(), format!("id:{}", id))) {
        id = existing.clone();
    } else if !name.is_empty() {
        if let Some(existing) = index.get(&(ty.to_string(), format!("name:{}", name))) {
            id = existing.clone();
        }
    }

    if let Some(obj) = item.as_object_mut() {
        obj.insert("id".into(), json!(id.clone()));
        obj.insert("assetId".into(), json!(id.clone()));
        obj.insert("_assetUid".into(), json!(id.clone()));
    }

    conn.execute(
        "INSERT INTO asset_records (id, task_id, asset_type, asset_data_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
           asset_type = excluded.asset_type,
           asset_data_json = excluded.asset_data_json",
        params![id, task_id, ty, item.to_string(), time],
    )
    .map_err(|e| format!("写入{}资产失败: {}", ty, e))?;
    kept.push(id);
    Ok(())
}

fn persist_assets(conn: &Connection, task_id: &str, characters: &[serde_json::Value], scenes: &[serde_json::Value], props: &[serde_json::Value], time: &str) -> Result<(), String> {
    let index = existing_asset_index(conn, task_id)?;
    let mut kept = Vec::new();
    for item in characters {
        upsert_asset(conn, task_id, "character", item, time, &index, &mut kept)?;
    }
    for item in scenes {
        upsert_asset(conn, task_id, "scene", item, time, &index, &mut kept)?;
    }
    for item in props {
        upsert_asset(conn, task_id, "prop", item, time, &index, &mut kept)?;
    }
    if kept.is_empty() {
        conn.execute(
            "DELETE FROM asset_records WHERE task_id = ?1 AND asset_type IN ('character','scene','prop')",
            params![task_id],
        )
        .map_err(|e| format!("清理空资产失败: {}", e))?;
    } else {
        let placeholders = kept.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "DELETE FROM asset_records WHERE task_id = ? AND asset_type IN ('character','scene','prop') AND id NOT IN ({})",
            placeholders
        );
        let mut values: Vec<&dyn rusqlite::ToSql> = vec![&task_id];
        for id in &kept {
            values.push(id);
        }
        conn.execute(&sql, values.as_slice())
            .map_err(|e| format!("清理已删除资产失败: {}", e))?;
    }
    Ok(())
}

async fn extract_with_prompt(runtime_config: &RuntimeConfig, slug: &str, script_body: &str) -> Option<Vec<serde_json::Value>> {
    for _ in 0..2 {
        let result = server_proxy::request_prompt_llm(PromptLlmParams {
            runtime_config: runtime_config.clone(),
            prompt_slug: slug.to_string(),
            temperature: Some(0.2),
            user_messages: vec![json!({"role": "user", "content": script_body})],
        }).await;
        if let Ok(text) = result {
            if let Some(arr) = array_from_text(&text) {
                if !arr.is_empty() {
                    return Some(arr);
                }
            }
        }
    }
    None
}

fn load_script_body(conn: &Connection, task_id: &str) -> Result<String, String> {
    let row: Result<Option<String>, _> = conn.query_row(
        "SELECT script_body FROM script_outputs WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1",
        params![task_id],
        |row| row.get(0),
    );
    match row {
        Ok(Some(body)) if !body.trim().is_empty() => Ok(body),
        _ => {
            let task_exists: bool = conn.query_row("SELECT 1 FROM script_tasks WHERE id = ?1", params![task_id], |_| Ok(true)).unwrap_or(false);
            if task_exists {
                Err("当前剧本任务还没有正文内容。请先在剧本阶段生成剧本，或使用「导入已有剧本」功能上传剧本后再继续。".into())
            } else {
                Err("找不到该任务，请重新选择或重新创建剧本任务。".into())
            }
        }
    }
}

fn db_path(conn: &Connection) -> Result<String, String> {
    conn.query_row("PRAGMA database_list", [], |row| row.get::<_, String>(2))
        .map_err(|e| format!("读取数据库路径失败: {}", e))
}

struct PreparedExtraction {
    task_id: String,
    time: String,
    db_path: String,
    runtime_config: RuntimeConfig,
    script_body: String,
    config_ready: bool,
}

fn prepare(conn: &Connection, task_id: &str) -> Result<PreparedExtraction, String> {
    let settings = crate::db::crud::get_app_settings(conn);
    let config_ready = !settings.text_key.trim().is_empty() && !settings.text_endpoint.trim().is_empty();
    Ok(PreparedExtraction {
        task_id: task_id.to_string(),
        time: now(),
        db_path: db_path(conn)?,
        script_body: load_script_body(conn, task_id)?,
        config_ready,
        runtime_config: RuntimeConfig {
            api_key: settings.text_key,
            api_base_url: settings.text_endpoint,
            default_model: settings.text_model,
            text_mode: settings.text_mode,
            mode: if config_ready { "local-configured".into() } else { "fallback-no-api".into() },
            image_endpoint: String::new(),
            image_key: String::new(),
            image_model: String::new(),
            review_threshold: settings.review_threshold as u8,
            enable_local_save: settings.enable_local_save,
        },
    })
}

pub fn run_asset_extraction(conn: &Connection, task_id: &str) -> impl std::future::Future<Output = Result<serde_json::Value, String>> + Send + 'static {
    let prepared = prepare(conn, task_id);
    async move {
        let p = prepared?;
        let mut fallback_used = false;
        let mut llm_used = false;

        let characters = if p.config_ready {
            match extract_with_prompt(&p.runtime_config, "asset_character", &p.script_body).await {
                Some(items) => {
                    llm_used = true;
                    items.iter().map(normalize_character).collect::<Vec<_>>()
                },
                None => {
                    fallback_used = true;
                    fallback_characters(&p.script_body).iter().map(normalize_character).collect::<Vec<_>>()
                }
            }
        } else {
            fallback_used = true;
            fallback_characters(&p.script_body).iter().map(normalize_character).collect::<Vec<_>>()
        };

        let scenes = if p.config_ready {
            match extract_with_prompt(&p.runtime_config, "asset_scene", &p.script_body).await {
                Some(items) => {
                    llm_used = true;
                    items.iter().map(normalize_scene).collect::<Vec<_>>()
                },
                None => {
                    fallback_used = true;
                    fallback_scenes(&p.script_body).iter().map(normalize_scene).collect::<Vec<_>>()
                }
            }
        } else {
            fallback_used = true;
            fallback_scenes(&p.script_body).iter().map(normalize_scene).collect::<Vec<_>>()
        };

        let props = if p.config_ready {
            match extract_with_prompt(&p.runtime_config, "asset_prop", &p.script_body).await {
                Some(items) => {
                    llm_used = true;
                    items.iter().map(normalize_prop).collect::<Vec<_>>()
                },
                None => {
                    fallback_used = true;
                    fallback_props(&p.script_body).iter().map(normalize_prop).collect::<Vec<_>>()
                }
            }
        } else {
            fallback_used = true;
            fallback_props(&p.script_body).iter().map(normalize_prop).collect::<Vec<_>>()
        };

        let write_conn = Connection::open(&p.db_path).map_err(|e| format!("打开数据库写入资产失败: {}", e))?;
        persist_assets(&write_conn, &p.task_id, &characters, &scenes, &props, &p.time)?;

        let extraction_mode = match (llm_used, fallback_used) {
            (true, true) => "mixed",
            (true, false) => "llm",
            _ => "fallback",
        };
        let extraction_model = if llm_used {
            format!("local-asset-extractor-v2 / {}", p.runtime_config.default_model)
        } else {
            "local-asset-extractor-v2 / regex-fallback-no-api".into()
        };

        Ok(json!({
            "taskId": p.task_id,
            "characters": characters,
            "scenes": scenes,
            "props": props,
            "extractedAt": p.time,
            "extractionModel": extraction_model,
            "extractionMode": extraction_mode,
            "configReady": p.config_ready,
            "fallbackUsed": fallback_used,
            "llmUsed": llm_used,
            "promptSlugs": ["asset_character", "asset_scene", "asset_prop"]
        }))
    }
}

pub fn update_assets(conn: &Connection, task_id: &str, characters: &str, scenes: &str, props: &str) -> Result<serde_json::Value, String> {
    let time = now();
    let characters = parse_asset_list(characters, "characters")?.iter().map(normalize_character).collect::<Vec<_>>();
    let scenes = parse_asset_list(scenes, "scenes")?.iter().map(normalize_scene).collect::<Vec<_>>();
    let props = parse_asset_list(props, "props")?.iter().map(normalize_prop).collect::<Vec<_>>();
    persist_assets(conn, task_id, &characters, &scenes, &props, &time)?;
    Ok(json!({"taskId": task_id, "characters": characters, "scenes": scenes, "props": props, "savedAt": time}))
}
