use axum::{
    extract::State,
    routing::post,
    Json, Router,
};
use serde::Deserialize;

use crate::error::AppError;
use crate::AppState;
use crate::auth::middleware::AuthUser;
use crate::db::crud;
use crate::services;

#[derive(Deserialize)]
pub struct InvokeRequest {
    pub cmd: String,
    #[serde(default)]
    pub args: serde_json::Value,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/invoke", post(handle_invoke))
}

pub async fn handle_invoke(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<InvokeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let db_path = state.db_path.clone();
    let config = state.config.clone();
    let cmd = req.cmd;
    let is_admin = auth_user.is_admin;
    // 将认证用户 ID 注入 args，供 screenplay 等命令使用
    let mut args = req.args;
    if let serde_json::Value::Object(ref mut map) = args {
        map.insert("_userId".to_string(), serde_json::json!(auth_user.user_id.to_string()));
    }

    let res = tokio::task::spawn_blocking(move || -> Result<serde_json::Value, AppError> {
        let conn = crate::db::open_database_connection(std::path::Path::new(&db_path))?;

        match cmd.as_str() {
            // ── System / Settings ──
            "get_version" => {
                Ok(serde_json::json!("3.0.1"))
            }
            "get_app_settings" => {
                ensure_admin(is_admin)?;
                let settings = crud::get_app_settings(&conn);
                Ok(serde_json::to_value(settings).unwrap_or_default())
            }
            "save_app_settings" => {
                ensure_admin(is_admin)?;
                let payload: crud::AppSettings = serde_json::from_value(args.clone())
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                let saved = crud::save_app_settings(&conn, &payload);
                Ok(serde_json::to_value(saved).unwrap_or_default())
            }
            "get_database_meta" => {
                ensure_admin(is_admin)?;
                let path: String = conn
                    .query_row("PRAGMA database_list", [], |row| row.get::<_, String>(2))
                    .unwrap_or_default();
                let p = std::path::Path::new(&path);
                let data_dir = p
                    .parent()
                    .map(|d| d.to_string_lossy().to_string())
                    .unwrap_or_default();
                Ok(serde_json::json!({ "dbPath": path, "dataDir": data_dir }))
            }
            "test_connection" => {
                ensure_admin(is_admin)?;
                let endpoint = args["endpoint"].as_str().unwrap_or("");
                let key = args["key"].as_str().unwrap_or("");
                let model = args["model"].as_str().unwrap_or("");
                let mode = args["mode"]
                    .as_str()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or("openai");
                let future = crate::llm::server_proxy::test_connection(endpoint, key, model, mode);
                let (ok, latency_ms, error) = tokio::runtime::Handle::current()
                    .block_on(future)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::json!({
                    "ok": ok,
                    "latencyMs": latency_ms,
                    "latency_ms": latency_ms,
                    "error": error,
                }))
            }
            "admin_summary" => {
                ensure_admin(is_admin)?;
                Ok(admin_summary(&conn, &config)?)
            }

            // ── Tasks ──
            "get_recent_script_tasks" => {
                let tasks = crud::get_recent_script_tasks(&conn, 8);
                Ok(serde_json::to_value(tasks).unwrap_or_default())
            }
            "get_recent_image_tasks" => {
                let tasks = crud::get_recent_image_tasks(&conn, 8);
                Ok(serde_json::to_value(tasks).unwrap_or_default())
            }
            "get_recent_video_tasks" => {
                let tasks = crud::get_recent_video_tasks(&conn, 8);
                Ok(serde_json::to_value(tasks).unwrap_or_default())
            }
            "load_script_task" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::load_script_task(&conn, task_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "delete_script_task" => {
                let task_id = args["taskId"].as_str().unwrap_or("").to_string();
                crud::delete_script_task(&conn, &task_id);
                Ok(serde_json::json!({ "success": true, "taskId": task_id }))
            }
            "delete_image_task" => {
                let task_id = args["taskId"].as_str().unwrap_or("").to_string();
                crud::delete_image_task(&conn, &task_id);
                Ok(serde_json::json!({ "success": true, "taskId": task_id }))
            }
            "delete_video_task" => {
                let task_id = args["taskId"].as_str().unwrap_or("").to_string();
                crud::delete_video_task(&conn, &task_id);
                Ok(serde_json::json!({ "success": true, "taskId": task_id }))
            }

            // ── Drafts ──
            "save_script_draft" => {
                let payload: crud::ScriptDraftInput = serde_json::from_value(args.clone())
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                let res = crud::save_script_draft(&conn, &payload);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "save_image_prompt_draft" => {
                let payload = args.clone();
                let input = crud::ImageVideoDraftInput {
                    mode: payload["mode"].as_str().unwrap_or("").to_string(),
                    source_script: payload["sourceScript"].as_str().map(String::from),
                    visual_style: payload["visualStyle"].as_str().map(String::from),
                    image_goal: payload["imageGoal"].as_str().map(String::from),
                    project_id: payload["projectId"].as_str().map(String::from),
                    script_beats: None,
                    video_style: None,
                    motion_focus: None,
                };
                let r = crud::save_image_draft(&conn, &input);
                Ok(serde_json::json!({ "projectId": r.project_id, "taskId": r.task_id, "savedAt": r.saved_at }))
            }
            "save_video_prompt_draft" => {
                let payload = args.clone();
                let input = crud::ImageVideoDraftInput {
                    mode: payload["mode"].as_str().unwrap_or("").to_string(),
                    project_id: payload["projectId"].as_str().map(String::from),
                    script_beats: payload["scriptBeats"].as_str().map(String::from),
                    video_style: payload["videoStyle"].as_str().map(String::from),
                    motion_focus: payload["motionFocus"].as_str().map(String::from),
                    source_script: None,
                    visual_style: None,
                    image_goal: None,
                };
                let r = crud::save_video_draft(&conn, &input);
                Ok(serde_json::json!({ "projectId": r.project_id, "taskId": r.task_id, "savedAt": r.saved_at }))
            }

            // ── Script Operations ──
            "save_script_generation" => {
                let input: crud::ScriptGenerationInput = serde_json::from_value(args.clone())
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                let future = services::script_generation::run_script_generation(&conn, &input, None);
                let result = tokio::runtime::Handle::current()
                    .block_on(future)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(result).unwrap_or_default())
            }
            "update_script_body" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let new_body = args["newBody"].as_str().unwrap_or("");
                crud::update_script_body(&conn, task_id, new_body);
                Ok(serde_json::json!({ "success": true }))
            }
            "import_existing_script" => {
                let payload: crud::ImportScriptInput = serde_json::from_value(args.clone())
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                let res = crud::import_existing_script(&conn, &payload);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "run_script_review" => {
                let res = crud::run_script_review(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }

            // ── Assets ──
            "get_assets_by_task" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::get_assets_by_task(&conn, task_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "update_assets" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let chars = args["characters"].as_str().unwrap_or("");
                let scenes = args["scenes"].as_str().unwrap_or("");
                let props = args["props"].as_str().unwrap_or("");
                let res = services::asset_extraction::update_assets(&conn, task_id, chars, scenes, props)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "run_asset_extraction" => {
                let task_id = args["taskId"].as_str()
                    .or_else(|| args["task_id"].as_str())
                    .unwrap_or("");
                let future = services::asset_extraction::run_asset_extraction(&conn, task_id);
                let result = tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(future)
                }).map_err(|e| AppError::Internal(e))?;
                Ok(result)
            }

            // ── Prompts ──
            "run_prompt_generation" => {
                let res = crud::run_prompt_generation(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "run_prompt_group_generation" => {
                let res = crud::run_prompt_group_gen(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "update_prompt_output" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let groups = args["seedanceGroups"].as_str().unwrap_or("");
                crud::update_prompt_output(&conn, task_id, groups);
                Ok(serde_json::json!({ "success": true }))
            }
            "get_prompt_output_by_task" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::get_prompt_output_by_task(&conn, task_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "get_scene_count" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::get_scene_count(&conn, task_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "get_segment_titles" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::get_segment_titles(&conn, task_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "run_prompt_quality_check" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let future = services::prompt_quality::run_prompt_quality_check(&conn, task_id);
                let result = tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(future)
                }).map_err(|e| AppError::Internal(e))?;
                Ok(result)
            }

            // ── Outline ──
            "generate_outline" => {
                let res = crud::generate_outline(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "confirm_outline" => {
                crud::confirm_outline(&conn, &args);
                Ok(serde_json::json!({ "success": true }))
            }
            "get_outline" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::get_outline(&conn, task_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }

            // ── Projects ──
            "get_projects" => {
                let res = crud::get_projects(&conn);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "rename_project" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let name = args["newName"].as_str().unwrap_or("");
                crud::rename_project(&conn, pid, name);
                Ok(serde_json::json!({ "success": true }))
            }
            "delete_project" => {
                let pid = args["projectId"].as_str().unwrap_or("").to_string();
                crud::delete_project(&conn, &pid);
                Ok(serde_json::json!({ "success": true, "projectId": pid }))
            }

            // ── Seedance ──
            "seedance_run_phase_ad" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::seedance_phase_ad(&conn, task_id)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "seedance_get_analysis" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::seedance_get_analysis(&conn, task_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "seedance_run_unit" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let unit = args["unitIndex"].as_i64().unwrap_or(0) as i32;
                let res = crud::seedance_run_unit(&conn, task_id, unit)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "seedance_run_all" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::seedance_run_all(&conn, task_id)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "seedance_list_units" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let res = crud::seedance_list_units(&conn, task_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "seedance_get_unit" => {
                let task_id = args["taskId"].as_str().unwrap_or("");
                let unit = args["unitIndex"].as_i64().unwrap_or(0) as i32;
                let res = crud::seedance_get_unit(&conn, task_id, unit);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }

            // ── Image / Video Generation ──
            "run_image_generation" => {
                let future = services::prompt_tasks::run_image_prompt_generation(&conn, &args);
                let result = tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(future)
                }).map_err(|e| AppError::Internal(e))?;
                Ok(result)
            }
            "run_video_generation" => {
                let future = services::prompt_tasks::run_video_prompt_generation(&conn, &args);
                let result = tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(future)
                }).map_err(|e| AppError::Internal(e))?;
                Ok(result)
            }
            "run_image_review" => {
                let future = services::prompt_tasks::run_image_prompt_review(&conn, &args);
                let result = tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(future)
                }).map_err(|e| AppError::Internal(e))?;
                Ok(result)
            }
            "run_video_review" => {
                let future = services::prompt_tasks::run_video_prompt_review(&conn, &args);
                let result = tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(future)
                }).map_err(|e| AppError::Internal(e))?;
                Ok(result)
            }

            // ── Visual Prompt Forge ──
            "visual_save_output" => {
                let res = crud::visual_save_output(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "visual_list_outputs" => {
                let mut project_id = args["projectId"].as_str()
                    .or_else(|| args["project_id"].as_str())
                    .unwrap_or("")
                    .to_string();
                let script_task_id = args["scriptTaskId"].as_str()
                    .or_else(|| args["script_task_id"].as_str())
                    .or_else(|| args["taskId"].as_str())
                    .unwrap_or("");
                if project_id.is_empty() && !script_task_id.is_empty() {
                    project_id = conn
                        .query_row(
                            "SELECT project_id FROM script_tasks WHERE id = ?1",
                            rusqlite::params![script_task_id],
                            |row| row.get::<_, String>(0),
                        )
                        .unwrap_or_default();
                }
                let res = crud::visual_list_outputs(&conn, &project_id)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "visual_delete_output" => {
                let id = args["id"].as_str().unwrap_or("");
                if id.is_empty() {
                    return Err(AppError::BadRequest("缺少 id".into()));
                }
                crud::visual_delete_output(&conn, id)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::json!({ "success": true }))
            }
            "visual_update_output_meta" => {
                let res = crud::visual_update_output_meta(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "visual_mark_copied" => {
                let id = args["id"].as_str().unwrap_or("");
                let res = crud::visual_mark_copied(&conn, id)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "visual_search_templates" => {
                let keyword = args["keyword"].as_str().filter(|s| !s.trim().is_empty());
                let category = args["category"].as_str().filter(|s| !s.trim().is_empty());
                let language = args["language"].as_str().filter(|s| !s.trim().is_empty());
                let res = crud::visual_search_templates(&conn, keyword, category, language)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "visual_get_template" => {
                let id = args["id"].as_str().unwrap_or("");
                if id.is_empty() {
                    return Ok(serde_json::Value::Null);
                }
                let res = crud::visual_get_template(&conn, id)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "visual_smart_generate_asset_prompt" => {
                let plan = services::visual_prompt_service::prepare_smart_prompt_plan(&conn, &args)
                    .map_err(|e| AppError::BadRequest(e))?;
                let future = services::visual_prompt_service::generate_smart_prompt_payloads(plan);
                let payloads = tokio::runtime::Handle::current()
                    .block_on(future)
                    .map_err(|e| AppError::Internal(e))?;
                let saved = services::visual_prompt_service::save_smart_prompt_payloads(&conn, &payloads)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(saved).unwrap_or_default())
            }
            "visual_batch_generate" => {
                let plan = services::visual_prompt_service::prepare_smart_prompt_plan(&conn, &args)
                    .map_err(|e| AppError::BadRequest(e))?;
                let future = services::visual_prompt_service::generate_smart_prompt_payloads(plan);
                let payloads = tokio::runtime::Handle::current()
                    .block_on(future)
                    .map_err(|e| AppError::Internal(e))?;
                let saved = services::visual_prompt_service::save_smart_prompt_payloads(&conn, &payloads)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(saved).unwrap_or_default())
            }
            "visual_import_external_templates" => {
                let readme = if let Some(content) = args["content"].as_str() {
                    content.to_string()
                } else {
                    let url = args["url"]
                        .as_str()
                        .unwrap_or("https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/README.md")
                        .to_string();
                    tokio::runtime::Handle::current()
                        .block_on(async move {
                            let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
                            if !response.status().is_success() {
                                return Err(format!("模板源请求失败：HTTP {}", response.status()));
                            }
                            response.text().await.map_err(|e| e.to_string())
                        })
                        .map_err(|e| AppError::Internal(e))?
                };
                let templates = crud::parse_awesome_readme(&readme);
                let total = templates.len();
                let mut imported = 0usize;
                for template in &templates {
                    crud::visual_upsert_template(&conn, template)
                        .map_err(|e| AppError::Internal(e))?;
                    imported += 1;
                }
                Ok(serde_json::json!({ "imported": imported, "total": total }))
            }
            "visual_export_json" => {
                let project_id = args["projectId"].as_str()
                    .or_else(|| args["project_id"].as_str())
                    .unwrap_or("");
                let rows = crud::visual_list_outputs(&conn, project_id)
                    .map_err(|e| AppError::Internal(e))?;
                let content = serde_json::to_string_pretty(&rows).unwrap_or_else(|_| "[]".to_string());
                Ok(serde_json::json!({ "content": content, "rows": rows }))
            }
            "visual_export_markdown" => {
                let project_id = args["projectId"].as_str()
                    .or_else(|| args["project_id"].as_str())
                    .unwrap_or("");
                let rows = crud::visual_list_outputs(&conn, project_id)
                    .map_err(|e| AppError::Internal(e))?;
                let mut md = String::from("# ScriptStack Visual Prompts\n\n");
                for row in &rows {
                    md.push_str(&format!(
                        "## {}\n\n- Asset: `{}` / `{}`\n- Mode: `{}`\n\n### English AIPROMPT\n\n```text\n{}\n```\n\n### 中文镜像\n\n{}\n\n",
                        row["title"].as_str().unwrap_or("Untitled"),
                        row["assetType"].as_str().unwrap_or(""),
                        row["assetId"].as_str().unwrap_or(""),
                        row["generationMode"].as_str().unwrap_or("image"),
                        row["promptTextEn"].as_str().filter(|s| !s.is_empty()).or_else(|| row["promptText"].as_str()).unwrap_or(""),
                        row["reviewTextZh"].as_str().unwrap_or("")
                    ));
                }
                Ok(serde_json::json!({ "content": md, "rows": rows }))
            }
            "get_prompt_flow_contract" => {
                let res = crate::llm::prompts::canonical_flow_contract();
                Ok(res)
            }

            // ── Screenplay ──
            "screenplay_skill_status" => {
                Ok(services::screenplay::skill_status())
            }
            "screenplay_create_project" => {
                let user_id = args["_userId"].as_str().unwrap_or("");
                let init: services::screenplay_store::ProjectInit = serde_json::from_value(args.clone())
                    .unwrap_or_else(|_| services::screenplay_store::ProjectInit::default());
                let res = services::screenplay::create_project(&conn, user_id, init);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "screenplay_list_recent_projects" => {
                let limit = args["limit"].as_u64().unwrap_or(20) as usize;
                let user_id = args["_userId"].as_str().unwrap_or("");
                let res = services::screenplay::list_recent_projects(&conn, user_id, limit);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "screenplay_get_project" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let user_id = args["_userId"].as_str().unwrap_or("");
                let res = services::screenplay::get_project(&conn, pid, user_id);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "screenplay_delete_project" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let user_id = args["_userId"].as_str().unwrap_or("");
                let ok = services::screenplay::delete_project(&conn, pid, user_id);
                Ok(serde_json::json!({ "success": ok }))
            }
            "screenplay_rename_project" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let name = args["newName"].as_str().unwrap_or("");
                let user_id = args["_userId"].as_str().unwrap_or("");
                let ok = services::screenplay::rename_project(&conn, pid, user_id, name);
                Ok(serde_json::json!({ "success": ok }))
            }
            "screenplay_update_step_structured" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
                let structured = args["structured"].clone();
                let user_id = args["_userId"].as_str().unwrap_or("");
                let ok = services::screenplay::update_step_structured(&conn, pid, user_id, step, structured);
                Ok(serde_json::json!({ "success": ok }))
            }
            "screenplay_generate_step" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
                let user_id = args["_userId"].as_str().unwrap_or("");
                let user_feedback = args["userFeedback"]
                    .as_str()
                    .or_else(|| args["user_feedback"].as_str())
                    .map(|s| s.to_string());
                let future = services::screenplay::generate_step_async(
                    &conn,
                    &config,
                    pid,
                    user_id,
                    step,
                    user_feedback,
                    |_chunk| {},
                );
                let res = tokio::runtime::Handle::current()
                    .block_on(future)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "screenplay_selfcheck_step" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
                let user_id = args["_userId"].as_str().unwrap_or("");
                let future = services::screenplay::selfcheck_step_async(
                    &conn,
                    &config,
                    pid,
                    user_id,
                    step,
                    |_chunk| {},
                );
                let res = tokio::runtime::Handle::current()
                    .block_on(future)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "screenplay_approve_step" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
                let next = args["nextStep"].as_i64().map(|n| n as u8);
                let user_id = args["_userId"].as_str().unwrap_or("");
                let rec = services::screenplay::approve_step(&conn, pid, user_id, step, next);
                Ok(serde_json::to_value(rec).unwrap_or_default())
            }
            "screenplay_rollback_to" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let target = args["targetStep"].as_i64().unwrap_or(1) as u8;
                let user_id = args["_userId"].as_str().unwrap_or("");
                let rec = services::screenplay::rollback_to(&conn, pid, user_id, target);
                Ok(serde_json::to_value(rec).unwrap_or_default())
            }
            "screenplay_list_versions" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
                let user_id = args["_userId"].as_str().unwrap_or("");
                let versions = services::screenplay::list_versions(&conn, pid, user_id, step);
                Ok(serde_json::to_value(versions).unwrap_or_default())
            }
            "screenplay_restore_version" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
                let vid = args["versionId"].as_str().unwrap_or("");
                let user_id = args["_userId"].as_str().unwrap_or("");
                services::screenplay::restore_version(&conn, pid, user_id, step, vid);
                Ok(serde_json::json!({ "success": true }))
            }
            "screenplay_set_step_selection" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
                let sel = args["selectionId"].as_str().map(String::from);
                let user_id = args["_userId"].as_str().unwrap_or("");
                services::screenplay::set_step_selection(&conn, pid, user_id, step, sel);
                Ok(serde_json::json!({ "success": true }))
            }
            "screenplay_get_checkpoint" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let trigger = args["trigger"].as_str().unwrap_or("");
                let user_id = args["_userId"].as_str().unwrap_or("");
                let res = services::screenplay::get_checkpoint(&conn, pid, user_id, trigger);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "screenplay_regenerate_checkpoint" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let trigger = args["trigger"].as_str().unwrap_or("manual");
                let user_id = args["_userId"].as_str().unwrap_or("");
                let future = services::screenplay::generate_checkpoint_async(
                    &conn,
                    &config,
                    pid,
                    user_id,
                    trigger,
                );
                let res = tokio::runtime::Handle::current()
                    .block_on(future)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::json!(res))
            }
            "screenplay_get_cached_selfcheck" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
                let user_id = args["_userId"].as_str().unwrap_or("");
                let res = services::screenplay::get_cached_selfcheck(&conn, pid, user_id, step);
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "screenplay_finalize_to_script_task" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let user_id = args["_userId"].as_str().unwrap_or("");
                let res = services::screenplay::finalize_to_script_task(&conn, pid, user_id)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "doctor_diagnose" => {
                let pid = args["projectId"].as_str().unwrap_or("");
                let question = args["question"].as_str().unwrap_or("");
                let user_id = args["_userId"].as_str().unwrap_or("");
                if pid.is_empty() || question.trim().is_empty() {
                    return Err(AppError::BadRequest("doctor_diagnose 缺少 projectId/question".into()));
                }

                let settings = crud::get_app_settings(&conn);
                let mut runtime_config = config.to_runtime_config();
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
                if runtime_config.api_key.trim().is_empty()
                    || runtime_config.api_key.contains("your-key")
                    || runtime_config.api_key.contains("change-me")
                {
                    return Ok(serde_json::json!({
                        "text": "剧本医生需要先配置可用的文本模型 API。请在设置页或服务端 .env 中配置 DeepSeek / OpenAI 兼容接口。"
                    }));
                }

                let snapshot = services::screenplay_store::build_project_snapshot(&conn, pid, user_id);
                let params = crate::llm::server_proxy::ContextualLlmParams {
                    runtime_config,
                    context_type: "screenplay_doctor_diagnose".into(),
                    context_params: serde_json::json!({
                        "question": question,
                        "projectSnapshot": snapshot,
                        "instruction": "你是剧本医生。请用中文回答，优先指出结构漏洞、人物动机、信息递进、时长风险，并给出可执行修改建议。"
                    }),
                    temperature: Some(0.2),
                    max_tokens_override: Some(4096),
                };
                let mut answer = String::new();
                let future = crate::llm::server_proxy::request_contextual_llm_stream(params, |chunk| {
                    answer.push_str(chunk);
                });
                tokio::runtime::Handle::current()
                    .block_on(future)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::json!({ "text": answer }))
            }

            // ── Longform / Series ──
            "create_series_project" => {
                let res = services::longform::create_series_project(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "longform_incubate_idea" => {
                let res = services::longform::incubate_idea(&conn, &config, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "import_source_file" => {
                let res = services::longform::import_source_file(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "parse_uploaded_source_file" => {
                let res = services::longform::parse_uploaded_source_file(&args)
                    .map_err(|e| AppError::BadRequest(e))?;
                Ok(res)
            }
            "list_source_materials" => {
                let res = services::longform::list_source_materials(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "segment_source_material" => {
                let res = services::longform::segment_source_material(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "confirm_source_chunks" => {
                let res = services::longform::confirm_source_chunks(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "list_source_chunks" => {
                let res = services::longform::list_source_chunks(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "create_episode_from_sources" => {
                let res = services::longform::create_episode_from_sources(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "list_series_episodes" => {
                let res = services::longform::list_series_episodes(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "generate_episode_snapshot" => {
                let res = services::longform::generate_episode_snapshot(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "generate_next_episode_options" => {
                let res = services::longform::generate_next_episode_options(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "create_asset_sheet_plan" => {
                let res = services::longform::create_asset_sheet_plan(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "crop_asset_sheet" => {
                let data_dir = server_data_dir(&config);
                let res = services::longform::crop_asset_sheet(&conn, &data_dir, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }

            // ── Asset Image Management ──
            "asset_image_save_file" => {
                let res = save_asset_image_file(&conn, &config, &args)?;
                Ok(res)
            }
            "asset_image_save" => {
                let res = crud::asset_image_save(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }
            "asset_image_list" => {
                let project_id = args["projectId"].as_str()
                    .or_else(|| args["project_id"].as_str())
                    .unwrap_or("");
                let asset_type = args["assetType"].as_str()
                    .or_else(|| args["asset_type"].as_str());
                let asset_id = args["assetId"].as_str()
                    .or_else(|| args["asset_id"].as_str());

                let res = if let (Some(at), Some(ai)) = (asset_type, asset_id) {
                    crud::asset_image_list_by_asset(&conn, at, ai)
                        .map_err(|e| AppError::Internal(e))?
                } else {
                    crud::asset_image_list_by_project(&conn, project_id)
                        .map_err(|e| AppError::Internal(e))?
                };
                Ok(serde_json::to_value(res).unwrap_or_default())
            }
            "asset_image_delete" => {
                let id = args["id"].as_str().unwrap_or("");
                if id.is_empty() {
                    return Err(AppError::BadRequest("缺少 id".into()));
                }
                crud::asset_image_delete(&conn, id)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(serde_json::json!({ "success": true }))
            }
            "asset_image_update" => {
                let res = crud::asset_image_update(&conn, &args)
                    .map_err(|e| AppError::Internal(e))?;
                Ok(res)
            }

            // ── Fallback ──
            _ => {
                Err(AppError::NotFound(format!("Command '{}' not found", cmd)))
            }
        }
    }).await.map_err(|e| AppError::Internal(e.to_string()))??;

    Ok(Json(res))
}

fn ensure_admin(is_admin: bool) -> Result<(), AppError> {
    if is_admin {
        Ok(())
    } else {
        Err(AppError::Forbidden("Admin privileges required".into()))
    }
}

fn scalar_i64(conn: &rusqlite::Connection, sql: &str) -> i64 {
    conn.query_row(sql, [], |row| row.get::<_, i64>(0))
        .unwrap_or(0)
}

fn mask_secret(value: &str) -> String {
    if value.trim().is_empty() {
        return String::new();
    }
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= 8 {
        return "••••".to_string();
    }
    let head: String = chars.iter().take(4).collect();
    let tail: String = chars.iter().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
    format!("{}••••{}", head, tail)
}

fn first_non_empty(primary: &str, fallback: &str) -> String {
    if primary.trim().is_empty() {
        fallback.trim().to_string()
    } else {
        primary.trim().to_string()
    }
}

fn is_configured_secret(value: &str) -> bool {
    let lowered = value.trim().to_ascii_lowercase();
    !lowered.is_empty()
        && !lowered.contains("your-key")
        && !lowered.contains("change-me")
        && !lowered.contains("placeholder")
}

fn admin_summary(
    conn: &rusqlite::Connection,
    config: &crate::config::ServerConfig,
) -> Result<serde_json::Value, AppError> {
    let settings = crate::db::crud::get_app_settings(conn);
    let effective_text_endpoint = first_non_empty(&settings.text_endpoint, &config.llm_text_endpoint);
    let effective_text_key = first_non_empty(&settings.text_key, &config.llm_text_key);
    let effective_text_model = first_non_empty(&settings.text_model, &config.llm_text_model);
    let effective_text_mode = first_non_empty(&settings.text_mode, &config.llm_text_mode);
    let effective_image_endpoint = first_non_empty(&settings.image_endpoint, &config.llm_image_endpoint);
    let effective_image_key = first_non_empty(&settings.image_key, &config.llm_image_key);
    let effective_image_model = first_non_empty(&settings.image_model, &config.llm_image_model);
    let mut recent_users_stmt = conn
        .prepare(
            "SELECT id, username, email, COALESCE(role, 'user'), created_at, COALESCE(last_login_at, ''), COALESCE(last_seen_at, '')
             FROM users
             ORDER BY COALESCE(last_seen_at, created_at) DESC
             LIMIT 20",
        )?;
    let recent_users = recent_users_stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "username": row.get::<_, String>(1)?,
                "email": row.get::<_, String>(2)?,
                "role": row.get::<_, String>(3)?,
                "createdAt": row.get::<_, String>(4)?,
                "lastLoginAt": row.get::<_, String>(5)?,
                "lastSeenAt": row.get::<_, String>(6)?,
            }))
        })?
        .filter_map(|item| item.ok())
        .collect::<Vec<_>>();

    let db_path: String = conn
        .query_row("PRAGMA database_list", [], |row| row.get::<_, String>(2))
        .unwrap_or_default();

    Ok(serde_json::json!({
        "users": {
            "total": scalar_i64(conn, "SELECT COUNT(*) FROM users"),
            "admins": scalar_i64(conn, "SELECT COUNT(*) FROM users WHERE role = 'admin'"),
            "active15m": scalar_i64(conn, "SELECT COUNT(*) FROM users WHERE last_seen_at >= datetime('now', '-15 minutes')"),
            "active24h": scalar_i64(conn, "SELECT COUNT(*) FROM users WHERE last_seen_at >= datetime('now', '-1 day')"),
            "recent": recent_users,
        },
        "workload": {
            "screenplayProjects": scalar_i64(conn, "SELECT COUNT(*) FROM screenplay_projects"),
            "projects": scalar_i64(conn, "SELECT COUNT(*) FROM projects"),
            "scriptTasks": scalar_i64(conn, "SELECT COUNT(*) FROM script_tasks"),
            "assetRecords": scalar_i64(conn, "SELECT COUNT(*) FROM asset_records"),
            "visualPrompts": scalar_i64(conn, "SELECT COUNT(*) FROM visual_prompt_outputs"),
            "seedanceUnits": scalar_i64(conn, "SELECT COUNT(*) FROM seedance_units"),
        },
        "model": {
            "textEndpoint": effective_text_endpoint,
            "textModel": effective_text_model,
            "textMode": effective_text_mode,
            "textKeyConfigured": is_configured_secret(&effective_text_key),
            "textKeyMasked": mask_secret(&effective_text_key),
            "imageEndpoint": effective_image_endpoint,
            "imageModel": effective_image_model,
            "imageKeyConfigured": is_configured_secret(&effective_image_key),
            "imageKeyMasked": mask_secret(&effective_image_key),
            "dbTextKeyConfigured": is_configured_secret(&settings.text_key),
            "dbImageKeyConfigured": is_configured_secret(&settings.image_key),
            "envTextEndpointConfigured": !config.llm_text_endpoint.trim().is_empty(),
            "envTextKeyConfigured": is_configured_secret(&config.llm_text_key),
            "envImageKeyConfigured": is_configured_secret(&config.llm_image_key),
            "apiPoolMode": "single-primary",
            "concurrencyNote": "当前为单主 API 配置。并发请求失败会返回错误，不会导致服务崩溃；公测人数上升后建议扩展为 API Key 池与队列限流。",
        },
        "server": {
            "listenAddr": config.listen_addr,
            "dbPath": db_path,
            "uploadDir": config.upload_dir,
            "maxUploadSizeMb": config.max_upload_size_mb,
            "jwtExpireHours": config.jwt_expire_hours,
        }
    }))
}

fn server_data_dir(config: &crate::config::ServerConfig) -> std::path::PathBuf {
    let upload_dir = std::path::PathBuf::from(&config.upload_dir);
    upload_dir
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or(upload_dir)
}

fn extension_from_upload(mime_type: &str, file_name: &str) -> &'static str {
    if mime_type.contains("webp") {
        "webp"
    } else if mime_type.contains("jpeg") || mime_type.contains("jpg") {
        "jpg"
    } else if mime_type.contains("png") {
        "png"
    } else if file_name.to_ascii_lowercase().ends_with(".webp") {
        "webp"
    } else if file_name.to_ascii_lowercase().ends_with(".jpg")
        || file_name.to_ascii_lowercase().ends_with(".jpeg")
    {
        "jpg"
    } else {
        "png"
    }
}

fn save_asset_image_file(
    conn: &rusqlite::Connection,
    config: &crate::config::ServerConfig,
    args: &serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    use base64::Engine;

    let data = args["base64"]
        .as_str()
        .or_else(|| args["data"].as_str())
        .ok_or_else(|| AppError::BadRequest("asset_image_save_file 缺少 base64".into()))?;
    let clean = data.split_once(',').map(|(_, body)| body).unwrap_or(data);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(clean)
        .map_err(|e| AppError::BadRequest(format!("图片 Base64 解码失败：{}", e)))?;

    let mime_type = args["mimeType"]
        .as_str()
        .or_else(|| args["mime_type"].as_str())
        .unwrap_or("image/png");
    let original_name = args["fileName"]
        .as_str()
        .or_else(|| args["file_name"].as_str())
        .unwrap_or("uploaded-image");
    let asset_type = args["assetType"]
        .as_str()
        .or_else(|| args["asset_type"].as_str())
        .unwrap_or("misc");
    let ext = extension_from_upload(mime_type, original_name);
    let id = crate::db::crud::uuid();
    let dir = server_data_dir(config).join("asset_images").join(asset_type);
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
    let file_name = format!("{}.{}", id, ext);
    let path = dir.join(&file_name);
    std::fs::write(&path, &bytes).map_err(|e| AppError::Internal(e.to_string()))?;

    let (width, height) = image::load_from_memory(&bytes)
        .map(|img| (Some(img.width() as i64), Some(img.height() as i64)))
        .unwrap_or((None, None));

    let mut payload = args.clone();
    if let Some(obj) = payload.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("filePath".into(), serde_json::json!(path.to_string_lossy().to_string()));
        obj.insert("fileName".into(), serde_json::json!(original_name));
        obj.insert("fileSize".into(), serde_json::json!(bytes.len() as i64));
        obj.insert("mimeType".into(), serde_json::json!(mime_type));
        if let Some(width) = width {
            obj.insert("width".into(), serde_json::json!(width));
        }
        if let Some(height) = height {
            obj.insert("height".into(), serde_json::json!(height));
        }
    }

    let saved = crate::db::crud::asset_image_save(conn, &payload)
        .map_err(|e| AppError::Internal(e))?;
    Ok(serde_json::json!({
        "id": saved["id"],
        "filePath": path.to_string_lossy().to_string(),
        "fileName": original_name,
        "fileSize": bytes.len() as i64,
        "mimeType": mime_type,
        "width": width,
        "height": height,
        "createdAt": saved["createdAt"],
    }))
}
