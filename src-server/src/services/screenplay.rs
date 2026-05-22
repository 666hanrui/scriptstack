use rusqlite::{params, Connection};

use crate::db::crud;

use crate::llm::server_proxy;
use crate::services::screenplay_store;
use crate::utils::step_parser;

fn is_placeholder_key(key: &str) -> bool {
    let trimmed = key.trim();
    trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case("sk-your-key-here")
        || trimmed.contains("your-key")
        || trimmed.contains("change-me")
}

fn effective_runtime_config(
    conn: &Connection,
    config: &crate::config::ServerConfig,
) -> crate::llm::config::RuntimeConfig {
    let mut runtime_config = config.to_runtime_config();
    let settings = crud::get_app_settings(conn);

    if !settings.text_endpoint.trim().is_empty() {
        runtime_config.api_base_url = settings.text_endpoint;
    }
    if !settings.text_key.trim().is_empty() {
        runtime_config.api_key = settings.text_key;
    }
    if !settings.text_model.trim().is_empty() {
        runtime_config.default_model = settings.text_model;
    }
    if !settings.text_mode.trim().is_empty() {
        runtime_config.text_mode = settings.text_mode;
    }
    runtime_config.review_threshold = settings.review_threshold.clamp(0, 100) as u8;
    runtime_config.enable_local_save = settings.enable_local_save;

    if is_placeholder_key(&runtime_config.api_key) {
        runtime_config.api_key.clear();
    }
    runtime_config
}

// ── Skill Status ──

pub fn skill_status() -> serde_json::Value {
    serde_json::json!({
        "cached": true, "cacheDir": "(local-embedded)", "main": true, "core": true,
        "formatUltrashort": true, "formatShort": true, "chinese": true, "craft": true,
        "aiPitfalls": true, "checkpointTemplate": true, "genreHookLibrary": true,
    })
}

// ── Public API for route handlers ──

pub fn create_project(conn: &Connection, user_id: &str, init: screenplay_store::ProjectInit) -> screenplay_store::ProjectRecord {
    screenplay_store::create_project(conn, user_id, init)
}

pub fn get_project(conn: &Connection, project_id: &str, user_id: &str) -> Option<screenplay_store::ProjectRecord> {
    screenplay_store::load_project(conn, project_id, user_id)
}

pub fn list_recent_projects(conn: &Connection, user_id: &str, limit: usize) -> Vec<serde_json::Value> {
    screenplay_store::list_recent_projects(conn, user_id, limit)
}

pub fn delete_project(conn: &Connection, project_id: &str, user_id: &str) -> bool {
    screenplay_store::delete_project(conn, project_id, user_id)
}

pub fn update_step_structured(
    conn: &Connection,
    project_id: &str,
    user_id: &str,
    step_number: u8,
    structured: serde_json::Value,
) -> bool {
    screenplay_store::update_active_step_structured(conn, project_id, user_id, step_number, structured)
}

pub fn rename_project(conn: &Connection, project_id: &str, user_id: &str, new_name: &str) -> bool {
    screenplay_store::rename_project(conn, project_id, user_id, new_name)
}

fn scenes_to_script_body(scenes: &[serde_json::Value]) -> String {
    scenes
        .iter()
        .map(|s| {
            format!(
                "{}\n{}",
                s["header"].as_str().unwrap_or(""),
                s["body"].as_str().unwrap_or("")
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn linked_script_task_project_id(conn: &Connection, task_id: &str) -> Option<String> {
    conn.query_row(
        "SELECT project_id FROM script_tasks WHERE id = ?1",
        params![task_id],
        |row| row.get::<_, String>(0),
    )
    .ok()
}

fn update_existing_script_task(
    conn: &Connection,
    task_id: &str,
    project_name: &str,
    duration: &str,
    concept: Option<String>,
    scenes: &[serde_json::Value],
    doctor: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let project_id = linked_script_task_project_id(conn, task_id)
        .ok_or_else(|| format!("linked script task not found: {}", task_id))?;
    let t = chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string();
    let script_body = scenes_to_script_body(scenes);
    let raw = serde_json::json!({"scenes": scenes, "doctor": doctor});

    conn.execute(
        "UPDATE projects SET name = ?1, status = 'active', updated_at = ?2 WHERE id = ?3",
        params![project_name, t, project_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE script_tasks SET input_summary = ?1, duration = ?2, stage = 'ready', updated_at = ?3 WHERE id = ?4",
        params![concept.as_deref().unwrap_or_default(), duration, t, task_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM script_outputs WHERE task_id = ?1", params![task_id])
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO script_outputs (id, task_id, characters_json, plot_outline, script_body, raw_response, created_at) VALUES (?1, ?2, '[]', ?3, ?4, ?5, ?6)",
        params![uuid::Uuid::new_v4().to_string(), task_id, script_body, script_body, raw.to_string(), t],
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "projectId": project_id,
        "scriptTaskId": task_id,
        "wasCreate": false,
    }))
}

pub fn finalize_to_script_task(
    conn: &Connection,
    project_id: &str,
    user_id: &str,
) -> Result<serde_json::Value, String> {
    let rec = screenplay_store::load_project(conn, project_id, user_id).ok_or("Project not found")?;

    let scenes = if rec.init.path.as_deref() == Some("import") {
        let imported_script = rec.init.imported_script.clone().unwrap_or_default();
        if imported_script.trim().is_empty() {
            return Err("Imported script is empty".into());
        }
        let re = regex_lite::Regex::new(
            r"【\s*(场景|场)\s*[一二三四五六七八九十百零\d]+\s*[:：][^】]+】\s*[（(][^)）]*[)）]",
        )
        .unwrap();
        let matches: Vec<_> = re.find_iter(&imported_script).collect();

        if matches.len() >= 2 {
            matches
                .iter()
                .enumerate()
                .map(|(i, m)| {
                    let start = m.start();
                    let end = if i + 1 < matches.len() {
                        matches[i + 1].start()
                    } else {
                        imported_script.len()
                    };
                    let block = imported_script[start..end].trim().to_string();
                    let header = block.lines().next().unwrap_or("").to_string();
                    let body = block[header.len()..].trim().to_string();
                    let dur_re = regex_lite::Regex::new(r"[（(][^)）]*?(\d+)[^)）]*?[)）]").unwrap();
                    let dur = dur_re
                        .captures(&header)
                        .and_then(|c| c.get(1))
                        .map(|m| format!("约 {} 秒", m.as_str()))
                        .unwrap_or_else(|| "约 30 秒".into());
                    serde_json::json!({"index": i+1, "header": header, "duration": dur, "plotRhythm": "中", "emotionRhythm": "中", "body": body})
                })
                .collect()
        } else {
            let file_name = rec.init.imported_file_name.clone();
            let header = file_name
                .map(|n| format!("【导入剧本：{}】", n))
                .unwrap_or_else(|| "【导入剧本】".into());
            vec![serde_json::json!({
                "index": 1, "header": header, "duration": rec.init.duration.clone().unwrap_or_else(|| "未知".into()),
                "plotRhythm": "中", "emotionRhythm": "中", "body": imported_script.trim(),
            })]
        }
    } else {
        let step7 =
            screenplay_store::get_active_version(conn, project_id, user_id, 7).ok_or("Step 7 output not found")?;
        let structured = step7.structured.ok_or("Step 7 structured data missing")?;
        structured["scenes"]
            .as_array()
            .ok_or("Step 7 scenes is not an array")?
            .clone()
    };

    let doctor = screenplay_store::get_active_version(conn, project_id, user_id, 8).and_then(|v| v.structured);

    let project_name = rec
        .init
        .name
        .clone()
        .or_else(|| {
            rec.init
                .concept
                .as_ref()
                .map(|c| c.chars().take(30).collect())
        })
        .unwrap_or_else(|| "未命名剧本".into());
    let duration = rec.init.duration.clone().unwrap_or_else(|| "2分钟".into());

    if let Some(linked_task_id) = rec.linked_script_task_id.clone() {
        if linked_script_task_project_id(conn, &linked_task_id).is_some() {
            let result = update_existing_script_task(
                conn,
                &linked_task_id,
                &project_name,
                &duration,
                rec.init.concept.clone(),
                &scenes,
                doctor,
            )?;
            screenplay_store::set_linked_script_task_id(conn, project_id, user_id, &linked_task_id);
            return Ok(result);
        }
    }

    let result = crud::finalize_screenplay(
        conn,
        &crud::FinalizeScreenplayInput {
            project_name,
            duration,
            concept: rec.init.concept.clone(),
            scenes,
            doctor,
            linked_script_task_id: rec.linked_script_task_id.clone(),
        },
    );

    screenplay_store::set_linked_script_task_id(conn, project_id, user_id, &result.task_id);

    Ok(serde_json::json!({
        "projectId": result.project_id,
        "scriptTaskId": result.task_id,
        "wasCreate": result.was_create,
    }))
}

pub async fn generate_step_async(
    conn: &Connection,
    config: &crate::config::ServerConfig,
    project_id: &str,
    user_id: &str,
    step_number: u8,
    user_feedback: Option<String>,
    on_chunk: impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let runtime_config = effective_runtime_config(conn, config);

    if runtime_config.api_key.is_empty() || runtime_config.api_base_url.is_empty() {
        return Err("API 未配置, 请先到设置页填写文字模型 API 地址和密钥.".into());
    }

    let rec = screenplay_store::load_project(conn, project_id, user_id).ok_or("Project not found")?;
    let project_snapshot = screenplay_store::build_project_snapshot(conn, project_id, user_id);

    let params = server_proxy::ContextualLlmParams {
        runtime_config,
        context_type: "screenplay_step".into(),
        context_params: serde_json::json!({
            "stepNumber": step_number,
            "init": rec.init,
            "projectSnapshot": project_snapshot,
            "userFeedback": user_feedback,
        }),
        temperature: None,
        max_tokens_override: None,
    };

    let mut full_text = String::new();
    server_proxy::request_contextual_llm_stream(params, |chunk| {
        full_text.push_str(chunk);
        on_chunk(chunk);
    })
    .await
    .map_err(|e| e.to_string())?;

    if full_text.trim().is_empty() {
        return Err("模型返回空内容，未保存当前步骤。请先在管理员设置中测试模型连接，或检查当前输入是否过长导致模型端截断。".into());
    }

    let structured = parse_step_output(step_number, &full_text);

    let version = screenplay_store::append_version(
        conn,
        project_id,
        user_id,
        step_number,
        user_feedback
            .as_ref()
            .map(|fb| format!("修改: {}", &fb[..fb.len().min(20)]))
            .or_else(|| Some("初版".into())),
        Some(full_text.clone()),
        structured.clone(),
        user_feedback,
    );

    Ok(serde_json::json!({
        "versionId": version.as_ref().map(|v| v.id.clone()),
        "text": full_text,
        "structured": structured,
    }))
}

pub async fn selfcheck_step_async(
    conn: &Connection,
    config: &crate::config::ServerConfig,
    project_id: &str,
    user_id: &str,
    step_number: u8,
    on_chunk: impl Fn(&str),
) -> Result<serde_json::Value, String> {
    let rec = screenplay_store::load_project(conn, project_id, user_id).ok_or("Project not found")?;

    let runtime_config = effective_runtime_config(conn, config);

    let active = screenplay_store::get_active_version(conn, project_id, user_id, step_number);
    let current_output = active
        .as_ref()
        .and_then(|v| v.output.clone())
        .unwrap_or_else(|| "(无产出)".into());
    let current_selection = rec.selections.get(&step_number.to_string()).cloned();

    let params = server_proxy::ContextualLlmParams {
        runtime_config,
        context_type: "screenplay_selfcheck".into(),
        context_params: serde_json::json!({
            "stepNumber": step_number,
            "init": rec.init,
            "currentOutput": current_output,
            "currentSelection": current_selection,
        }),
        temperature: None,
        max_tokens_override: None,
    };

    let mut full_text = String::new();
    server_proxy::request_contextual_llm_stream(params, |chunk| {
        full_text.push_str(chunk);
        on_chunk(chunk);
    })
    .await
    .map_err(|e| e.to_string())?;

    let items = parse_selfcheck(&full_text);
    screenplay_store::save_selfcheck(conn, project_id, user_id, step_number, items.clone());

    Ok(serde_json::json!({ "items": items }))
}

fn parse_step_output(step_number: u8, text: &str) -> Option<serde_json::Value> {
    step_parser::parse_step_output(step_number, text)
}

fn parse_selfcheck(text: &str) -> Vec<serde_json::Value> {
    step_parser::parse_selfcheck(text)
}

// ── Checkpoint ──

pub async fn generate_checkpoint_async(
    conn: &Connection,
    config: &crate::config::ServerConfig,
    project_id: &str,
    user_id: &str,
    trigger: &str,
) -> Result<String, String> {
    let rec = screenplay_store::load_project(conn, project_id, user_id).ok_or("Project not found")?;

    let runtime_config = effective_runtime_config(conn, config);

    let project_snapshot = screenplay_store::build_project_snapshot(conn, project_id, user_id);

    let params = server_proxy::ContextualLlmParams {
        runtime_config,
        context_type: "screenplay_checkpoint".into(),
        context_params: serde_json::json!({
            "init": rec.init,
            "projectSnapshot": project_snapshot,
        }),
        temperature: None,
        max_tokens_override: None,
    };

    let mut full_text = String::new();
    server_proxy::request_contextual_llm_stream(params, |chunk| {
        full_text.push_str(chunk);
    })
    .await
    .map_err(|e| e.to_string())?;

    let content = full_text.trim().to_string();
    if content.is_empty() {
        return Err("LLM 返回空, checkpoint 未生成".into());
    }

    screenplay_store::save_checkpoint(conn, project_id, user_id, trigger, &content);
    Ok(content)
}

pub fn get_checkpoint(conn: &Connection, project_id: &str, user_id: &str, trigger: &str) -> Option<String> {
    screenplay_store::get_checkpoint(conn, project_id, user_id, trigger)
}

pub fn get_cached_selfcheck(conn: &Connection, project_id: &str, user_id: &str, step_number: u8) -> Option<serde_json::Value> {
    screenplay_store::get_selfcheck(conn, project_id, user_id, step_number)
        .map(|s| serde_json::json!({ "items": s.items, "createdAt": s.created_at }))
}

pub fn approve_step(
    conn: &Connection,
    project_id: &str,
    user_id: &str,
    step_number: u8,
    next_step: Option<u8>,
) -> Option<screenplay_store::ProjectRecord> {
    screenplay_store::approve_step(conn, project_id, user_id, step_number, next_step)
}

pub fn rollback_to(conn: &Connection, project_id: &str, user_id: &str, target_step: u8) -> Option<screenplay_store::ProjectRecord> {
    screenplay_store::rollback_to(conn, project_id, user_id, target_step)
}

pub fn list_versions(conn: &Connection, project_id: &str, user_id: &str, step_number: u8) -> Vec<screenplay_store::VersionEntry> {
    screenplay_store::list_versions(conn, project_id, user_id, step_number)
}

pub fn restore_version(conn: &Connection, project_id: &str, user_id: &str, step_number: u8, version_id: &str) {
    screenplay_store::set_active_version(conn, project_id, user_id, step_number, version_id);
}

pub fn set_step_selection(conn: &Connection, project_id: &str, user_id: &str, step_number: u8, selection_id: Option<String>) {
    screenplay_store::set_step_selection(conn, project_id, user_id, step_number, selection_id);
}
