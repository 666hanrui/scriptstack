use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn now() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

pub fn uuid() -> String {
    Uuid::new_v4().to_string()
}

// ── App Settings ──

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub text_endpoint: String,
    pub text_key: String,
    pub text_model: String,
    pub text_mode: String,
    pub image_endpoint: String,
    pub image_key: String,
    pub image_model: String,
    pub review_threshold: i32,
    pub enable_local_save: bool,
}

pub fn get_app_settings(conn: &Connection) -> AppSettings {
    let mut stmt = conn
        .prepare("SELECT setting_key, setting_value FROM app_settings")
        .unwrap();
    let rows: Vec<(String, Option<String>)> = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let mut map = std::collections::HashMap::new();
    for (k, v) in &rows {
        if let Some(val) = v {
            map.insert(k.as_str(), val.as_str());
        }
    }

    AppSettings {
        text_endpoint: map.get("textEndpoint").unwrap_or(&"").to_string(),
        text_key: map.get("textKey").unwrap_or(&"").to_string(),
        text_model: map
            .get("textModel")
            .unwrap_or(&"deepseek-reasoner")
            .to_string(),
        text_mode: {
            let mode = map.get("textMode").unwrap_or(&"openai");
            matches!(*mode, "openai" | "gemini" | "anthropic")
                .then(|| mode.to_string())
                .unwrap_or_else(|| "openai".to_string())
        },
        image_endpoint: map.get("imageEndpoint").unwrap_or(&"").to_string(),
        image_key: map.get("imageKey").unwrap_or(&"").to_string(),
        image_model: map.get("imageModel").unwrap_or(&"").to_string(),
        review_threshold: map
            .get("reviewThreshold")
            .and_then(|s| s.parse::<i32>().ok())
            .map(|v| v.clamp(0, 100))
            .unwrap_or(90),
        enable_local_save: map
            .get("enableLocalSave")
            .map(|s| s == &"1")
            .unwrap_or(true),
    }
}

pub fn save_app_settings(conn: &Connection, input: &AppSettings) -> AppSettings {
    let t = now();
    let mut stmt = conn
        .prepare_cached(
            "INSERT INTO app_settings (id, setting_key, setting_value, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(setting_key) DO UPDATE SET
               setting_value = excluded.setting_value,
               updated_at = excluded.updated_at",
        )
        .unwrap();

    let threshold_str = input.review_threshold.to_string();
    let local_save_str = if input.enable_local_save { "1" } else { "0" };
    let pairs: [(&str, &str); 9] = [
        ("textEndpoint", &input.text_endpoint),
        ("textKey", &input.text_key),
        ("textModel", &input.text_model),
        ("textMode", &input.text_mode),
        ("imageEndpoint", &input.image_endpoint),
        ("imageKey", &input.image_key),
        ("imageModel", &input.image_model),
        ("reviewThreshold", &threshold_str),
        ("enableLocalSave", local_save_str),
    ];

    for (key, val) in &pairs {
        stmt.execute(params![key, key, val, &t]).ok();
    }

    get_app_settings(conn)
}

// ── Database Meta ──

#[derive(Debug, Serialize)]
pub struct DatabaseMeta {
    pub db_path: String,
    pub data_dir: String,
}

// ── Script Drafts ──

#[derive(Debug, Deserialize)]
pub struct ScriptDraftInput {
    pub mode: String,
    pub input_summary: String,
    pub genre: Option<String>,
    pub style: Option<String>,
    pub duration: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScriptDraftResult {
    pub project_id: String,
    pub task_id: String,
    pub project_name: String,
    pub saved_at: String,
}

fn script_project_name(mode: &str, input_summary: &str) -> String {
    let prefix = match mode {
        "plot" => "剧情描述生成剧本",
        "image" => "图片生成连续性剧本",
        "rewrite" => "剧本优化重生系统",
        _ => "剧本",
    };
    let s = input_summary.trim();
    if s.is_empty() {
        return format!("{}草稿", prefix);
    }
    let truncated: String = s.chars().take(18).collect();
    format!("{} - {}", prefix, truncated)
}

pub fn save_script_draft(conn: &Connection, input: &ScriptDraftInput) -> ScriptDraftResult {
    let project_id = uuid();
    let task_id = uuid();
    let t = now();
    let project_name = script_project_name(&input.mode, &input.input_summary);

    conn.execute(
        "INSERT INTO projects (id, name, module_type, status, created_at, updated_at)
         VALUES (?1, ?2, 'script', 'draft', ?3, ?4)",
        params![project_id, project_name, t, t],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO script_tasks (id, project_id, mode, input_summary, genre, style, duration, stage, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'idle', ?8, ?9)",
        params![
            task_id,
            project_id,
            input.mode,
            input.input_summary.trim(),
            input.genre.as_deref().unwrap_or_default(),
            input.style.as_deref().unwrap_or_default(),
            input.duration.as_deref().unwrap_or_default(),
            t,
            t,
        ],
    )
    .unwrap();

    ScriptDraftResult {
        project_id,
        task_id,
        project_name,
        saved_at: t,
    }
}

// ── Image / Video Prompt Drafts ──

#[derive(Debug, Deserialize)]
pub struct ImageVideoDraftInput {
    pub mode: String,
    pub source_script: Option<String>,
    pub visual_style: Option<String>,
    pub image_goal: Option<String>,
    pub script_beats: Option<String>,
    pub video_style: Option<String>,
    pub motion_focus: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DraftResult {
    pub project_id: String,
    pub task_id: String,
    pub saved_at: String,
}

pub fn save_image_draft(conn: &Connection, input: &ImageVideoDraftInput) -> DraftResult {
    let project_id = input.project_id.clone().unwrap_or_else(uuid);
    let task_id = uuid();
    let t = now();
    conn.execute(
        "INSERT INTO projects (id, name, module_type, status, created_at, updated_at)
         VALUES (?1, '图片提示词草稿', 'image', 'draft', ?2, ?3)
         ON CONFLICT(id) DO NOTHING",
        params![project_id, t, t],
    )
    .ok();
    conn.execute(
        "INSERT INTO image_tasks (id, project_id, mode, source_script, visual_style, image_goal, stage, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'idle', ?7, ?8)",
        params![
            task_id,
            project_id,
            input.mode,
            input.source_script.as_deref().unwrap_or_default(),
            input.visual_style.as_deref().unwrap_or_default(),
            input.image_goal.as_deref().unwrap_or_default(),
            t,
            t,
        ],
    )
    .unwrap();
    DraftResult {
        project_id,
        task_id,
        saved_at: t,
    }
}

pub fn save_video_draft(conn: &Connection, input: &ImageVideoDraftInput) -> DraftResult {
    let project_id = input.project_id.clone().unwrap_or_else(uuid);
    let task_id = uuid();
    let t = now();
    conn.execute(
        "INSERT INTO projects (id, name, module_type, status, created_at, updated_at)
         VALUES (?1, '视频提示词草稿', 'video', 'draft', ?2, ?3)
         ON CONFLICT(id) DO NOTHING",
        params![project_id, t, t],
    )
    .ok();
    conn.execute(
        "INSERT INTO video_tasks (id, project_id, mode, script_beats, video_style, motion_focus, stage, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'idle', ?7, ?8)",
        params![
            task_id,
            project_id,
            input.mode,
            input.script_beats.as_deref().unwrap_or_default(),
            input.video_style.as_deref().unwrap_or_default(),
            input.motion_focus.as_deref().unwrap_or_default(),
            t,
            t,
        ],
    )
    .unwrap();
    DraftResult {
        project_id,
        task_id,
        saved_at: t,
    }
}

// ── Script Generation ──

#[derive(Debug, Deserialize)]
pub struct ScriptGenerationInput {
    pub mode: String,
    pub duration: Option<String>,
    pub input_summary: String,
    pub style_preset: Option<String>,
    pub genres: Option<String>,
    pub audience: Option<String>,
    pub tone: Option<String>,
    pub ending: Option<String>,
    pub output_mode: Option<String>,
    pub episodes: Option<String>,
    pub custom_style: Option<String>,
    pub existing_project_id: Option<String>,
    pub existing_task_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScriptSection {
    pub title: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ScriptGenerationResult {
    pub project_id: String,
    pub task_id: String,
    pub stage: String,
    pub generated_at: String,
    pub project_name: String,
    pub sections: Vec<ScriptSection>,
    pub characters: Vec<serde_json::Value>,
}

pub fn fallback_sections(mode: &str) -> Vec<ScriptSection> {
    let text = match mode {
        "image" => "【图片连续性剧本预演】\n系统正在从参考图片中反推人物身份、视觉线索与冲突起点。",
        "rewrite" => {
            "【剧本优化重生系统预演】\n系统将保留原剧情主线，优先压缩冗余、强化冲突、提前爆点。"
        }
        _ => "【剧情描述生成剧本预演】\n系统会围绕重生、背叛、反击三条线组织故事。",
    };
    vec![ScriptSection {
        title: "完整结果文本".into(),
        content: text.into(),
    }]
}

pub fn save_script_generation(
    conn: &Connection,
    input: &ScriptGenerationInput,
    sections: Vec<ScriptSection>,
    characters: Vec<serde_json::Value>,
    raw_response: Option<serde_json::Value>,
) -> ScriptGenerationResult {
    let t = now();
    let project_id = input.existing_project_id.clone().unwrap_or_else(uuid);
    let task_id = input.existing_task_id.clone().unwrap_or_else(uuid);
    let project_name = script_project_name(&input.mode, &input.input_summary);

    conn.execute(
        "INSERT INTO projects (id, name, module_type, status, created_at, updated_at)
         VALUES (?1, ?2, 'script', 'active', ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, updated_at = excluded.updated_at",
        params![project_id, project_name, t, t],
    ).unwrap();
    conn.execute(
        "INSERT INTO script_tasks (id, project_id, mode, input_summary, genre, style, duration, stage, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, '', '', ?5, 'ready', ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET mode = excluded.mode, input_summary = excluded.input_summary, stage = excluded.stage, updated_at = excluded.updated_at",
        params![task_id, project_id, input.mode, input.input_summary.trim(), input.duration.as_deref().unwrap_or_default(), t, t],
    ).unwrap();

    conn.execute(
        "DELETE FROM script_outputs WHERE task_id = ?1",
        params![task_id],
    )
    .ok();

    let script_body: String = sections
        .iter()
        .map(|s| s.content.as_str())
        .collect::<Vec<_>>()
        .join("\n\n");
    let chars_json = serde_json::to_string(&characters).unwrap_or_default();
    let raw = raw_response.map(|v| v.to_string()).unwrap_or_default();

    conn.execute(
        "INSERT INTO script_outputs (id, task_id, characters_json, plot_outline, script_body, hook_opening, storyboard_base, raw_response, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![uuid(), task_id, chars_json, script_body, script_body, script_body, script_body, raw, t],
    ).unwrap();

    ScriptGenerationResult {
        project_id,
        task_id,
        stage: "ready".into(),
        generated_at: t,
        project_name,
        sections,
        characters,
    }
}

pub fn update_script_body(conn: &Connection, task_id: &str, new_body: &str) {
    let output_id: Option<String> = conn
        .query_row(
            "SELECT id FROM script_outputs WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1",
            params![task_id],
            |row| row.get(0),
        )
        .ok();
    if let Some(ref oid) = output_id {
        conn.execute(
            "UPDATE script_outputs SET script_body = ?1, plot_outline = ?1 WHERE id = ?2",
            params![new_body, oid],
        )
        .ok();
    }
    conn.execute(
        "UPDATE script_tasks SET updated_at = ?1 WHERE id = ?2",
        params![now(), task_id],
    )
    .ok();
}

// ── Import Existing Script ──

#[derive(Debug, Deserialize)]
pub struct ImportScriptInput {
    pub script_body: String,
    pub input_summary: Option<String>,
    pub duration: Option<String>,
}

pub fn import_existing_script(
    conn: &Connection,
    input: &ImportScriptInput,
) -> ScriptGenerationResult {
    let t = now();
    let project_id = uuid();
    let task_id = uuid();
    let clean_body = input.script_body.trim().to_string();
    let first_line = clean_body
        .lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("导入剧本")
        .trim()
        .to_string();
    let truncated: String = first_line.chars().take(24).collect();
    let project_name = format!("导入剧本 - {}", truncated);
    let summary: String = input
        .input_summary
        .clone()
        .unwrap_or(first_line)
        .chars()
        .take(200)
        .collect();

    conn.execute(
        "INSERT INTO projects (id, name, module_type, status, created_at, updated_at) VALUES (?1, ?2, 'script', 'active', ?3, ?4)",
        params![project_id, project_name, t, t],
    ).unwrap();
    conn.execute(
        "INSERT INTO script_tasks (id, project_id, mode, input_summary, genre, style, duration, stage, created_at, updated_at)
         VALUES (?1, ?2, 'plot', ?3, '', '', ?4, 'ready', ?5, ?6)",
        params![task_id, project_id, summary, input.duration.as_deref().unwrap_or("2分钟"), t, t],
    ).unwrap();

    let raw =
        serde_json::json!({ "sections": [{ "title": "导入的剧本内容", "content": clean_body }] });
    conn.execute(
        "INSERT INTO script_outputs (id, task_id, characters_json, plot_outline, script_body, hook_opening, storyboard_base, raw_response, created_at)
         VALUES (?1, ?2, '[]', ?3, ?4, ?5, ?6, ?7, ?8)",
        params![uuid(), task_id, clean_body, clean_body, clean_body, clean_body, raw.to_string(), t],
    ).unwrap();

    ScriptGenerationResult {
        project_id,
        task_id,
        stage: "ready".into(),
        generated_at: t,
        project_name,
        sections: vec![ScriptSection {
            title: "导入的剧本内容".into(),
            content: clean_body,
        }],
        characters: vec![],
    }
}

// ── Script Tasks History ──

#[derive(Debug, Serialize)]
pub struct ScriptTaskSummary {
    pub task_id: String,
    pub project_id: String,
    pub project_name: String,
    pub mode: String,
    pub input_summary: String,
    pub genre: String,
    pub style: String,
    pub duration: String,
    pub stage: String,
    pub updated_at: String,
    pub review_score: Option<i32>,
    pub review_status: Option<String>,
}

pub fn get_recent_script_tasks(conn: &Connection, limit: i64) -> Vec<ScriptTaskSummary> {
    let mut stmt = conn.prepare(
        "SELECT st.id, st.project_id, p.name, st.mode, st.input_summary, st.genre, st.style, st.duration, st.stage, st.updated_at, rr.score, rr.status
         FROM script_tasks st INNER JOIN projects p ON p.id = st.project_id
         LEFT JOIN review_records rr ON rr.id = (SELECT inner_rr.id FROM review_records inner_rr WHERE inner_rr.task_id = st.id ORDER BY inner_rr.created_at DESC LIMIT 1)
         ORDER BY st.updated_at DESC LIMIT ?1",
    ).unwrap();
    stmt.query_map(params![limit], |row| {
        Ok(ScriptTaskSummary {
            task_id: row.get(0)?,
            project_id: row.get(1)?,
            project_name: row.get(2)?,
            mode: row.get(3)?,
            input_summary: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            genre: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            style: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            duration: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
            stage: row.get(8)?,
            updated_at: row.get(9)?,
            review_score: row.get(10)?,
            review_status: row.get(11)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

pub fn get_recent_image_tasks(conn: &Connection, limit: i64) -> Vec<serde_json::Value> {
    let mut stmt = conn.prepare("SELECT id, project_id, mode, stage, updated_at FROM image_tasks ORDER BY updated_at DESC LIMIT ?1").unwrap();
    stmt.query_map(params![limit], |row| {
        Ok(serde_json::json!({"taskId": row.get::<_, String>(0)?, "projectId": row.get::<_, String>(1)?, "mode": row.get::<_, String>(2)?, "stage": row.get::<_, String>(3)?, "updatedAt": row.get::<_, String>(4)?}))
    }).unwrap().filter_map(|r| r.ok()).collect()
}

pub fn get_recent_video_tasks(conn: &Connection, limit: i64) -> Vec<serde_json::Value> {
    let mut stmt = conn.prepare("SELECT id, project_id, mode, stage, updated_at FROM video_tasks ORDER BY updated_at DESC LIMIT ?1").unwrap();
    stmt.query_map(params![limit], |row| {
        Ok(serde_json::json!({"taskId": row.get::<_, String>(0)?, "projectId": row.get::<_, String>(1)?, "mode": row.get::<_, String>(2)?, "stage": row.get::<_, String>(3)?, "updatedAt": row.get::<_, String>(4)?}))
    }).unwrap().filter_map(|r| r.ok()).collect()
}

// ── Load Script Task ──

pub fn load_script_task(conn: &Connection, task_id: &str) -> Option<serde_json::Value> {
    let task = conn.query_row(
        "SELECT st.*, p.name as project_name, p.status as project_status FROM script_tasks st JOIN projects p ON p.id = st.project_id WHERE st.id = ?1",
        params![task_id],
        |row| Ok(serde_json::json!({
            "taskId": row.get::<_, String>("id").ok(), "projectId": row.get::<_, String>("project_id").ok(),
            "projectName": row.get::<_, String>("project_name").ok(), "mode": row.get::<_, String>("mode").ok(),
            "inputSummary": row.get::<_, Option<String>>("input_summary").ok().flatten(),
            "genre": row.get::<_, Option<String>>("genre").ok().flatten(), "style": row.get::<_, Option<String>>("style").ok().flatten(),
            "duration": row.get::<_, Option<String>>("duration").ok().flatten(), "stage": row.get::<_, String>("stage").ok(),
            "status": row.get::<_, String>("project_status").ok(), "createdAt": row.get::<_, String>("created_at").ok(),
            "updatedAt": row.get::<_, String>("updated_at").ok(),
        })),
    ).ok()?;

    let outputs: Vec<serde_json::Value> = {
        let mut stmt = conn
            .prepare("SELECT * FROM script_outputs WHERE task_id = ?1 ORDER BY created_at DESC")
            .unwrap();
        stmt.query_map(params![task_id], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>("id").ok(), "taskId": row.get::<_, String>("task_id").ok(),
            "charactersJson": row.get::<_, Option<String>>("characters_json").ok().flatten(),
            "plotOutline": row.get::<_, Option<String>>("plot_outline").ok().flatten(),
            "scriptBody": row.get::<_, Option<String>>("script_body").ok().flatten(),
            "hookOpening": row.get::<_, Option<String>>("hook_opening").ok().flatten(),
            "storyboardBase": row.get::<_, Option<String>>("storyboard_base").ok().flatten(),
            "rawResponse": row.get::<_, Option<String>>("raw_response").ok().flatten(),
            "createdAt": row.get::<_, String>("created_at").ok(),
        }))).unwrap().filter_map(|r| r.ok()).collect()
    };

    let review: Option<serde_json::Value> = conn.query_row(
        "SELECT * FROM review_records WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1", params![task_id],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>("id").ok(), "taskId": row.get::<_, String>("task_id").ok(),
            "score": row.get::<_, Option<i32>>("score").ok().flatten(), "status": row.get::<_, String>("status").ok(),
            "summary": row.get::<_, Option<String>>("summary").ok().flatten(),
            "issuesJson": row.get::<_, Option<String>>("issues_json").ok().flatten(),
            "suggestionsJson": row.get::<_, Option<String>>("suggestions_json").ok().flatten(),
            "dimensionsJson": row.get::<_, Option<String>>("dimensions_json").ok().flatten(),
            "reviewModel": row.get::<_, Option<String>>("review_model").ok().flatten(),
            "createdAt": row.get::<_, String>("created_at").ok(),
        })),
    ).ok();

    let assets: Vec<serde_json::Value> = {
        let mut stmt = conn
            .prepare("SELECT * FROM asset_records WHERE task_id = ?1 ORDER BY created_at")
            .unwrap();
        stmt.query_map(params![task_id], |row| Ok(serde_json::json!({
            "id": row.get::<_, String>("id").ok(), "taskId": row.get::<_, String>("task_id").ok(),
            "assetType": row.get::<_, String>("asset_type").ok(),
            "assetDataJson": row.get::<_, Option<String>>("asset_data_json").ok().flatten(),
            "createdAt": row.get::<_, String>("created_at").ok(),
        }))).unwrap().filter_map(|r| r.ok()).collect()
    };

    let prompt_output: Option<serde_json::Value> = conn.query_row(
        "SELECT * FROM prompt_output_records WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1", params![task_id],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>("id").ok(), "taskId": row.get::<_, String>("task_id").ok(),
            "gridGroupsJson": row.get::<_, Option<String>>("grid_groups_json").ok().flatten(),
            "seedanceGroupsJson": row.get::<_, Option<String>>("seedance_groups_json").ok().flatten(),
            "generationModel": row.get::<_, Option<String>>("generation_model").ok().flatten(),
            "createdAt": row.get::<_, String>("created_at").ok(),
        })),
    ).ok();

    Some(
        serde_json::json!({ "task": task, "outputs": outputs, "review": review, "assets": assets, "promptOutput": prompt_output }),
    )
}

// ── Delete Tasks ──

pub fn delete_script_task(conn: &Connection, task_id: &str) {
    for tbl in &[
        "review_records",
        "script_outputs",
        "asset_records",
        "prompt_output_records",
        "seedance_analysis",
        "seedance_units",
    ] {
        conn.execute(
            &format!("DELETE FROM {} WHERE task_id = ?1", tbl),
            params![task_id],
        )
        .ok();
    }
    conn.execute("DELETE FROM script_tasks WHERE id = ?1", params![task_id])
        .ok();
}

pub fn delete_image_task(conn: &Connection, task_id: &str) {
    conn.execute(
        "DELETE FROM image_review_records WHERE task_id = ?1",
        params![task_id],
    )
    .ok();
    conn.execute(
        "DELETE FROM image_outputs WHERE task_id = ?1",
        params![task_id],
    )
    .ok();
    conn.execute("DELETE FROM image_tasks WHERE id = ?1", params![task_id])
        .ok();
}

pub fn delete_video_task(conn: &Connection, task_id: &str) {
    conn.execute(
        "DELETE FROM video_review_records WHERE task_id = ?1",
        params![task_id],
    )
    .ok();
    conn.execute(
        "DELETE FROM video_outputs WHERE task_id = ?1",
        params![task_id],
    )
    .ok();
    conn.execute("DELETE FROM video_tasks WHERE id = ?1", params![task_id])
        .ok();
}

// ── Projects ──

pub fn get_projects(conn: &Connection) -> Vec<serde_json::Value> {
    let mut stmt = conn.prepare("SELECT id, name, module_type, status, created_at, updated_at FROM projects ORDER BY updated_at DESC").unwrap();
    let rows: Vec<(String, String, String, String, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let mut projects = Vec::new();
    for (id, name, module_type, status, _created_at, updated_at) in rows {
        let mut all_tasks: Vec<serde_json::Value> = Vec::new();

        let mut s = conn.prepare("SELECT st.id, st.mode, st.stage, st.updated_at, rr.score, rr.status FROM script_tasks st LEFT JOIN review_records rr ON rr.id = (SELECT inner_rr.id FROM review_records inner_rr WHERE inner_rr.task_id = st.id ORDER BY inner_rr.created_at DESC LIMIT 1) WHERE st.project_id = ?1 ORDER BY st.updated_at DESC").unwrap();
        s.query_map(params![id], |row| Ok(serde_json::json!({"taskId": row.get::<_,String>(0).unwrap_or_default(), "moduleType":"script", "mode": row.get::<_,String>(1).unwrap_or_default(), "stage": row.get::<_,String>(2).unwrap_or_default(), "updatedAt": row.get::<_,String>(3).unwrap_or_default(), "reviewScore": row.get::<_,Option<i32>>(4).ok().flatten(), "reviewStatus": row.get::<_,Option<String>>(5).ok().flatten() }))).unwrap().for_each(|r| { if let Ok(v) = r { all_tasks.push(v); } });

        let mut it = conn.prepare("SELECT id, mode, stage, updated_at FROM image_tasks WHERE project_id = ?1 ORDER BY updated_at DESC").unwrap();
        it.query_map(params![id], |row| Ok(serde_json::json!({"taskId": row.get::<_,String>(0).unwrap_or_default(), "moduleType":"image", "mode": row.get::<_,String>(1).unwrap_or_default(), "stage": row.get::<_,String>(2).unwrap_or_default(), "updatedAt": row.get::<_,String>(3).unwrap_or_default() }))).unwrap().for_each(|r| { if let Ok(v) = r { all_tasks.push(v); } });

        let mut vt = conn.prepare("SELECT id, mode, stage, updated_at FROM video_tasks WHERE project_id = ?1 ORDER BY updated_at DESC").unwrap();
        vt.query_map(params![id], |row| Ok(serde_json::json!({"taskId": row.get::<_,String>(0).unwrap_or_default(), "moduleType":"video", "mode": row.get::<_,String>(1).unwrap_or_default(), "stage": row.get::<_,String>(2).unwrap_or_default(), "updatedAt": row.get::<_,String>(3).unwrap_or_default() }))).unwrap().for_each(|r| { if let Ok(v) = r { all_tasks.push(v); } });

        all_tasks.sort_by(|a, b| {
            b["updatedAt"]
                .as_str()
                .unwrap_or("")
                .cmp(a["updatedAt"].as_str().unwrap_or(""))
        });

        projects.push(serde_json::json!({
            "projectId": id, "projectName": name, "moduleType": module_type, "status": status,
            "taskCount": all_tasks.len(), "latestDate": all_tasks.first().and_then(|t| t["updatedAt"].as_str()).unwrap_or(&updated_at),
            "tasks": all_tasks,
        }));
    }
    projects
}

pub fn rename_project(conn: &Connection, project_id: &str, new_name: &str) {
    conn.execute(
        "UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_name.trim(), now(), project_id],
    )
    .ok();
}

pub fn delete_project(conn: &Connection, project_id: &str) {
    let script_tids: Vec<String> = conn
        .prepare("SELECT id FROM script_tasks WHERE project_id = ?1")
        .unwrap()
        .query_map(params![project_id], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    let image_tids: Vec<String> = conn
        .prepare("SELECT id FROM image_tasks WHERE project_id = ?1")
        .unwrap()
        .query_map(params![project_id], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    let video_tids: Vec<String> = conn
        .prepare("SELECT id FROM video_tasks WHERE project_id = ?1")
        .unwrap()
        .query_map(params![project_id], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    for tid in &script_tids {
        for tbl in &[
            "review_records",
            "script_outputs",
            "asset_records",
            "prompt_output_records",
            "seedance_analysis",
            "seedance_units",
            "script_tasks",
        ] {
            conn.execute(
                &format!("DELETE FROM {} WHERE task_id = ?1", tbl),
                params![tid],
            )
            .ok();
        }
    }
    for tid in &image_tids {
        conn.execute(
            "DELETE FROM image_review_records WHERE task_id = ?1",
            params![tid],
        )
        .ok();
        conn.execute("DELETE FROM image_outputs WHERE task_id = ?1", params![tid])
            .ok();
        conn.execute("DELETE FROM image_tasks WHERE id = ?1", params![tid])
            .ok();
    }
    for tid in &video_tids {
        conn.execute(
            "DELETE FROM video_review_records WHERE task_id = ?1",
            params![tid],
        )
        .ok();
        conn.execute("DELETE FROM video_outputs WHERE task_id = ?1", params![tid])
            .ok();
        conn.execute("DELETE FROM video_tasks WHERE id = ?1", params![tid])
            .ok();
    }
    conn.execute("DELETE FROM projects WHERE id = ?1", params![project_id])
        .ok();
}

// ── Asset Records ──

pub fn get_assets_by_task(conn: &Connection, task_id: &str) -> Vec<serde_json::Value> {
    let mut stmt = conn.prepare("SELECT id, asset_type, asset_data_json, created_at FROM asset_records WHERE task_id = ?1 ORDER BY created_at").unwrap();
    let rows: Vec<(String, String, String, String)> = stmt
        .query_map(params![task_id], |row| {
            Ok((
                row.get::<_, String>(0).unwrap_or_default(),
                row.get::<_, String>(1).unwrap_or_default(),
                row.get::<_, Option<String>>(2).ok().flatten().unwrap_or_else(|| "{}".to_string()),
                row.get::<_, String>(3).unwrap_or_default(),
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    rows.into_iter()
        .map(|(row_id, asset_type, raw, created_at)| {
            let mut data = serde_json::from_str::<serde_json::Value>(&raw).unwrap_or_else(|_| serde_json::json!({}));
            let canonical_id = data
                .get("id")
                .or_else(|| data.get("assetId"))
                .or_else(|| data.get("_assetUid"))
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| row_id.clone());

            if let Some(obj) = data.as_object_mut() {
                obj.entry("id").or_insert_with(|| serde_json::json!(canonical_id.clone()));
                obj.entry("assetId").or_insert_with(|| serde_json::json!(canonical_id.clone()));
                obj.entry("_assetUid").or_insert_with(|| serde_json::json!(canonical_id.clone()));
            }

            serde_json::json!({
                "id": canonical_id,
                "recordId": row_id,
                "assetType": asset_type,
                "assetDataJson": data.to_string(),
                "createdAt": created_at
            })
        })
        .collect()
}

pub fn update_assets(
    conn: &Connection,
    task_id: &str,
    characters: &str,
    scenes: &str,
    props: &str,
) {
    crate::services::asset_extraction::update_assets(conn, task_id, characters, scenes, props).ok();
}

// ── Prompt Output ──

pub fn get_prompt_output_by_task(conn: &Connection, task_id: &str) -> Option<serde_json::Value> {
    conn.query_row("SELECT * FROM prompt_output_records WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1", params![task_id], |row| {
        Ok(serde_json::json!({"id": row.get::<_,String>("id").ok(), "taskId": row.get::<_,String>("task_id").ok(),
            "gridGroupsJson": row.get::<_,Option<String>>("grid_groups_json").ok().flatten(),
            "seedanceGroupsJson": row.get::<_,Option<String>>("seedance_groups_json").ok().flatten(),
            "generationModel": row.get::<_,Option<String>>("generation_model").ok().flatten(),
            "createdAt": row.get::<_,String>("created_at").ok()}))
    }).ok()
}

pub fn update_prompt_output(conn: &Connection, task_id: &str, seedance_groups: &str) {
    let changed = conn
        .execute(
            "UPDATE prompt_output_records SET seedance_groups_json = ?1 WHERE task_id = ?2",
            params![seedance_groups, task_id],
        )
        .unwrap_or(0);

    if changed == 0 {
        conn.execute(
            "INSERT INTO prompt_output_records (id, task_id, grid_groups_json, seedance_groups_json, generation_model, created_at)
             VALUES (?1, ?2, '[]', ?3, 'manual-seedance-groups', ?4)",
            params![uuid(), task_id, seedance_groups, now()],
        )
        .ok();
    }
}

// ── Image/Video Generation & Review wrappers ──

// Helper for sync to async transition
fn block_on<F: std::future::Future>(f: F) -> F::Output {
    tokio::task::block_in_place(|| tokio::runtime::Handle::current().block_on(f))
}

pub fn run_image_generation(conn: &Connection, input: &serde_json::Value) -> serde_json::Value {
    crate::db::crud::block_on(crate::services::prompt_tasks::run_image_prompt_generation(
        conn, input,
    ))
    .unwrap_or_else(|e| serde_json::json!({ "error": e }))
}

pub fn run_video_generation(conn: &Connection, input: &serde_json::Value) -> serde_json::Value {
    crate::db::crud::block_on(crate::services::prompt_tasks::run_video_prompt_generation(
        conn, input,
    ))
    .unwrap_or_else(|e| serde_json::json!({ "error": e }))
}

pub fn run_image_review(conn: &Connection, input: &serde_json::Value) -> serde_json::Value {
    crate::db::crud::block_on(crate::services::prompt_tasks::run_image_prompt_review(
        conn, input,
    ))
    .unwrap_or_else(|e| serde_json::json!({ "error": e }))
}

pub fn run_video_review(conn: &Connection, input: &serde_json::Value) -> serde_json::Value {
    crate::db::crud::block_on(crate::services::prompt_tasks::run_video_prompt_review(
        conn, input,
    ))
    .unwrap_or_else(|e| serde_json::json!({ "error": e }))
}

pub fn run_script_review(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let task_id = input["taskId"].as_str().unwrap_or("").to_string();
    crate::db::crud::block_on(crate::services::script_review::run_script_review(
        conn, &task_id,
    ))
}

// ── Screenplay Finalize ──

#[derive(Debug, Deserialize)]
pub struct FinalizeScreenplayInput {
    pub project_name: String,
    pub duration: String,
    pub concept: Option<String>,
    pub scenes: Vec<serde_json::Value>,
    pub doctor: Option<serde_json::Value>,
    pub linked_script_task_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FinalizeScreenplayResult {
    pub project_id: String,
    pub task_id: String,
    pub was_create: bool,
}

pub fn finalize_screenplay(
    conn: &Connection,
    input: &FinalizeScreenplayInput,
) -> FinalizeScreenplayResult {
    let t = now();
    let task_id = uuid();
    let project_id = input.linked_script_task_id.as_ref().and_then(|linked| {
        conn.query_row("SELECT project_id FROM script_tasks WHERE id = ?1", params![linked], |row| row.get::<_,String>(0)).ok()
    }).unwrap_or_else(|| {
        let pid = uuid();
        conn.execute("INSERT INTO projects (id, name, module_type, status, created_at, updated_at) VALUES (?1, ?2, 'script', 'active', ?3, ?4)", params![pid, input.project_name, t, t]).ok();
        pid
    });

    conn.execute("INSERT INTO script_tasks (id, project_id, mode, input_summary, duration, stage, created_at, updated_at) VALUES (?1, ?2, 'plot', ?3, ?4, 'ready', ?5, ?6) ON CONFLICT(id) DO UPDATE SET stage = 'ready', updated_at = ?7",
        params![task_id, project_id, input.concept.as_deref().unwrap_or_default(), input.duration, t, t, t]).ok();

    let script_body: String = input
        .scenes
        .iter()
        .map(|s| {
            format!(
                "{}\n{}",
                s["header"].as_str().unwrap_or(""),
                s["body"].as_str().unwrap_or("")
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    let raw = serde_json::json!({"scenes": input.scenes, "doctor": input.doctor});

    conn.execute("INSERT INTO script_outputs (id, task_id, characters_json, plot_outline, script_body, raw_response, created_at) VALUES (?1, ?2, '[]', ?3, ?4, ?5, ?6)",
        params![uuid(), task_id, script_body, script_body, raw.to_string(), t]).ok();

    let was_create = input.linked_script_task_id.is_none();
    FinalizeScreenplayResult {
        project_id,
        task_id,
        was_create,
    }
}

// ── Seedance ──

pub fn seedance_phase_ad(conn: &Connection, task_id: &str) -> Result<serde_json::Value, String> {
    let tid = task_id.to_string();
    let analysis = crate::db::crud::block_on(
        crate::services::seedance_service::run_phase_ad(conn, &tid),
    )?;
    Ok(serde_json::to_value(&analysis).map_err(|e| e.to_string())?)
}

pub fn seedance_get_analysis(conn: &Connection, task_id: &str) -> Option<serde_json::Value> {
    conn.query_row("SELECT * FROM seedance_analysis WHERE task_id = ?1", params![task_id], |row| {
        Ok(serde_json::json!({"taskId": row.get::<_,String>("task_id").ok(), "paragraphIndexJson": row.get::<_,Option<String>>("paragraph_index_json").ok().flatten(), "structureType": row.get::<_,Option<String>>("structure_type").ok().flatten(), "emotionMapJson": row.get::<_,Option<String>>("emotion_map_json").ok().flatten(), "unitsPlanJson": row.get::<_,Option<String>>("units_plan_json").ok().flatten(), "totalSec": row.get::<_,Option<i32>>("total_sec").ok().flatten(), "totalUnits": row.get::<_,Option<i32>>("total_units").ok().flatten(), "createdAt": row.get::<_,String>("created_at").ok(), "updatedAt": row.get::<_,String>("updated_at").ok()}))
    }).ok()
}

pub fn seedance_list_units(conn: &Connection, task_id: &str) -> Vec<serde_json::Value> {
    let mut stmt = conn
        .prepare("SELECT * FROM seedance_units WHERE task_id = ?1 ORDER BY unit_index")
        .unwrap();
    stmt.query_map(params![task_id], |row| Ok(serde_json::json!({"id": row.get::<_,String>("id").ok(), "taskId": row.get::<_,String>("task_id").ok(), "unitIndex": row.get::<_,i32>("unit_index").ok(), "durationSec": row.get::<_,Option<i32>>("duration_sec").ok().flatten(), "sceneType": row.get::<_,Option<String>>("scene_type").ok().flatten(), "subShotCount": row.get::<_,Option<i32>>("sub_shot_count").ok().flatten(), "copyArea": row.get::<_,Option<String>>("copy_area").ok().flatten(), "noteAreaJson": row.get::<_,Option<String>>("note_area_json").ok().flatten(), "status": row.get::<_,String>("status").ok(), "retryCount": row.get::<_,i32>("retry_count").ok(), "errorMessage": row.get::<_,Option<String>>("error_message").ok().flatten(), "createdAt": row.get::<_,String>("created_at").ok(), "updatedAt": row.get::<_,String>("updated_at").ok() }))).unwrap().filter_map(|r| r.ok()).collect()
}

pub fn seedance_get_unit(
    conn: &Connection,
    task_id: &str,
    unit_index: i32,
) -> Option<serde_json::Value> {
    conn.query_row("SELECT * FROM seedance_units WHERE task_id = ?1 AND unit_index = ?2", params![task_id, unit_index], |row| {
        Ok(serde_json::json!({"id": row.get::<_,String>("id").ok(), "taskId": row.get::<_,String>("task_id").ok(), "unitIndex": row.get::<_,i32>("unit_index").ok(), "durationSec": row.get::<_,Option<i32>>("duration_sec").ok().flatten(), "sceneType": row.get::<_,Option<String>>("scene_type").ok().flatten(), "subShotCount": row.get::<_,Option<i32>>("sub_shot_count").ok().flatten(), "copyArea": row.get::<_,Option<String>>("copy_area").ok().flatten(), "noteAreaJson": row.get::<_,Option<String>>("note_area_json").ok().flatten(), "status": row.get::<_,String>("status").ok(), "retryCount": row.get::<_,i32>("retry_count").ok(), "errorMessage": row.get::<_,Option<String>>("error_message").ok().flatten(), "createdAt": row.get::<_,String>("created_at").ok(), "updatedAt": row.get::<_,String>("updated_at").ok() }))
    }).ok()
}

pub fn seedance_run_unit(
    conn: &Connection,
    task_id: &str,
    unit_index: i32,
) -> Result<serde_json::Value, String> {
    let tid = task_id.to_string();
    crate::db::crud::block_on(crate::services::seedance_service::run_unit_generation(
        conn,
        &tid,
        unit_index as usize,
    ))
}

pub fn seedance_run_all(conn: &Connection, task_id: &str) -> Result<serde_json::Value, String> {
    let tid = task_id.to_string();
    let results = crate::db::crud::block_on(
        crate::services::seedance_service::run_generate_all(conn, &tid, None),
    )?;
    Ok(serde_json::json!({"taskId": task_id, "completed": true, "results": results}))
}

// ── Prompt Generation ──

pub fn run_prompt_generation(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    crate::db::crud::block_on(crate::services::prompt_generation::run_prompt_generation(
        conn, input,
    ))
}

pub fn run_prompt_group_gen(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    crate::db::crud::block_on(
        crate::services::prompt_generation::run_prompt_group_generation(conn, input),
    )
}

pub fn get_scene_count(conn: &Connection, task_id: &str) -> Option<i64> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT grid_groups_json FROM prompt_output_records WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1",
            params![task_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();
    let parsed = raw.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())?;
    if let Some(shots) = parsed.get("shots").and_then(|v| v.as_array()) {
        return Some(shots.len() as i64);
    }
    if let Some(shots) = parsed
        .get("outline")
        .and_then(|value| value.get("shots"))
        .and_then(|value| value.as_array())
    {
        return Some(shots.len() as i64);
    }
    parsed.as_array().map(|items| items.len() as i64)
}

pub fn get_segment_titles(conn: &Connection, task_id: &str) -> Vec<String> {
    let s: Option<String> = conn
        .query_row(
            "SELECT grid_groups_json FROM prompt_output_records WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1",
            params![task_id],
            |row| row.get(0),
        )
        .ok();
    let parsed = match s.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()) {
        Some(value) => value,
        None => return vec![],
    };
    let shots = parsed
        .get("shots")
        .and_then(|value| value.as_array())
        .or_else(|| {
            parsed
                .get("outline")
                .and_then(|value| value.get("shots"))
                .and_then(|value| value.as_array())
        })
        .or_else(|| parsed.as_array());
    shots
        .map(|items| {
            items
                .iter()
                .filter_map(|g| {
                    g["title"]
                        .as_str()
                        .or_else(|| g["name"].as_str())
                        .map(String::from)
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn run_quality_check(_conn: &Connection, _task_id: &str) -> serde_json::Value {
    serde_json::json!({"passed": true, "issues": [], "score": 90})
}

pub fn generate_outline(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    crate::db::crud::block_on(crate::services::prompt_generation::generate_outline(
        conn, input,
    ))
}

pub fn confirm_outline(conn: &Connection, input: &serde_json::Value) {
    crate::services::prompt_generation::confirm_outline(conn, input);
}

pub fn get_outline(conn: &Connection, task_id: &str) -> Option<serde_json::Value> {
    crate::services::prompt_generation::get_outline(conn, task_id)
}

// ── Asset Extraction ──

pub fn run_asset_extraction(
    conn: &Connection,
    input: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let task_id = input["taskId"].as_str().unwrap_or("").to_string();
    crate::db::crud::block_on(crate::services::asset_extraction::run_asset_extraction(
        conn, &task_id,
    ))
}

// ── Asset Images ──

pub fn asset_image_save(
    conn: &Connection,
    payload: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let id = uuid();
    let t = now();
    let project_id = payload["projectId"]
        .as_str()
        .or_else(|| payload["project_id"].as_str())
        .unwrap_or("");
    let task_id = payload["taskId"]
        .as_str()
        .or_else(|| payload["task_id"].as_str())
        .unwrap_or("");
    let asset_type = payload["assetType"]
        .as_str()
        .or_else(|| payload["asset_type"].as_str())
        .unwrap_or("");
    let asset_id = payload["assetId"]
        .as_str()
        .or_else(|| payload["asset_id"].as_str())
        .unwrap_or("");
    let asset_name = payload["assetName"]
        .as_str()
        .or_else(|| payload["asset_name"].as_str())
        .unwrap_or("");
    let category = payload["category"].as_str().unwrap_or("reference");
    let file_path = payload["filePath"]
        .as_str()
        .or_else(|| payload["file_path"].as_str())
        .unwrap_or("");
    let file_name = payload["fileName"]
        .as_str()
        .or_else(|| payload["file_name"].as_str())
        .unwrap_or("");
    let file_size = payload["fileSize"]
        .as_i64()
        .or_else(|| payload["file_size"].as_i64())
        .unwrap_or(0);
    let mime_type = payload["mimeType"]
        .as_str()
        .or_else(|| payload["mime_type"].as_str())
        .unwrap_or("image/png");
    let width = payload["width"].as_i64();
    let height = payload["height"].as_i64();
    let source_prompt_id = payload["sourcePromptId"]
        .as_str()
        .or_else(|| payload["source_prompt_id"].as_str());
    let source_template_id = payload["sourceTemplateId"]
        .as_str()
        .or_else(|| payload["source_template_id"].as_str());
    let source_platform = payload["sourcePlatform"]
        .as_str()
        .or_else(|| payload["source_platform"].as_str());
    let visual_identity_json = payload["visualIdentityJson"]
        .as_str()
        .or_else(|| payload["visual_identity_json"].as_str());
    let tags_json = payload["tagsJson"]
        .as_str()
        .or_else(|| payload["tags_json"].as_str());
    let note = payload["note"].as_str().unwrap_or("");
    let sort_order = payload["sortOrder"]
        .as_i64()
        .or_else(|| payload["sort_order"].as_i64())
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO asset_images (id, project_id, task_id, asset_type, asset_id, asset_name, category, file_path, file_name, file_size, mime_type, width, height, source_prompt_id, source_template_id, source_platform, visual_identity_json, tags_json, note, sort_order, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)",
        params![
            id,
            project_id,
            task_id,
            asset_type,
            asset_id,
            asset_name,
            category,
            file_path,
            file_name,
            file_size,
            mime_type,
            width,
            height,
            source_prompt_id,
            source_template_id,
            source_platform,
            visual_identity_json,
            tags_json,
            note,
            sort_order,
            t,
            t,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "id": id, "createdAt": t }))
}

pub fn asset_image_list_by_project(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, task_id, asset_type, asset_id, asset_name, category,
                    file_path, file_name, file_size, mime_type, width, height,
                    source_prompt_id, source_template_id, source_platform,
                    visual_identity_json, tags_json, note, sort_order, created_at, updated_at
             FROM asset_images
             WHERE project_id = ?1
             ORDER BY asset_type, asset_name, sort_order, created_at",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0).unwrap_or_default(),
                "projectId": row.get::<_, String>(1).unwrap_or_default(),
                "taskId": row.get::<_, Option<String>>(2).ok().flatten().unwrap_or_default(),
                "assetType": row.get::<_, String>(3).unwrap_or_default(),
                "assetId": row.get::<_, Option<String>>(4).ok().flatten().unwrap_or_default(),
                "assetName": row.get::<_, Option<String>>(5).ok().flatten().unwrap_or_default(),
                "category": row.get::<_, String>(6).unwrap_or_default(),
                "filePath": row.get::<_, String>(7).unwrap_or_default(),
                "fileName": row.get::<_, String>(8).unwrap_or_default(),
                "fileSize": row.get::<_, i64>(9).unwrap_or(0),
                "mimeType": row.get::<_, Option<String>>(10).ok().flatten().unwrap_or_default(),
                "width": row.get::<_, Option<i64>>(11).ok().flatten(),
                "height": row.get::<_, Option<i64>>(12).ok().flatten(),
                "sourcePromptId": row.get::<_, Option<String>>(13).ok().flatten(),
                "sourceTemplateId": row.get::<_, Option<String>>(14).ok().flatten(),
                "sourcePlatform": row.get::<_, Option<String>>(15).ok().flatten(),
                "visualIdentityJson": row.get::<_, Option<String>>(16).ok().flatten(),
                "tagsJson": row.get::<_, Option<String>>(17).ok().flatten(),
                "note": row.get::<_, Option<String>>(18).ok().flatten().unwrap_or_default(),
                "sortOrder": row.get::<_, i64>(19).unwrap_or(0),
                "createdAt": row.get::<_, String>(20).unwrap_or_default(),
                "updatedAt": row.get::<_, String>(21).unwrap_or_default(),
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

pub fn asset_image_list_by_asset(
    conn: &Connection,
    asset_type: &str,
    asset_id: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, task_id, asset_type, asset_id, asset_name, category,
                    file_path, file_name, file_size, mime_type, width, height,
                    source_prompt_id, source_template_id, source_platform,
                    visual_identity_json, tags_json, note, sort_order, created_at, updated_at
             FROM asset_images
             WHERE asset_type = ?1 AND asset_id = ?2
             ORDER BY sort_order, created_at",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![asset_type, asset_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0).unwrap_or_default(),
                "projectId": row.get::<_, String>(1).unwrap_or_default(),
                "taskId": row.get::<_, Option<String>>(2).ok().flatten().unwrap_or_default(),
                "assetType": row.get::<_, String>(3).unwrap_or_default(),
                "assetId": row.get::<_, Option<String>>(4).ok().flatten().unwrap_or_default(),
                "assetName": row.get::<_, Option<String>>(5).ok().flatten().unwrap_or_default(),
                "category": row.get::<_, String>(6).unwrap_or_default(),
                "filePath": row.get::<_, String>(7).unwrap_or_default(),
                "fileName": row.get::<_, String>(8).unwrap_or_default(),
                "fileSize": row.get::<_, i64>(9).unwrap_or(0),
                "mimeType": row.get::<_, Option<String>>(10).ok().flatten().unwrap_or_default(),
                "width": row.get::<_, Option<i64>>(11).ok().flatten(),
                "height": row.get::<_, Option<i64>>(12).ok().flatten(),
                "sourcePromptId": row.get::<_, Option<String>>(13).ok().flatten(),
                "sourceTemplateId": row.get::<_, Option<String>>(14).ok().flatten(),
                "sourcePlatform": row.get::<_, Option<String>>(15).ok().flatten(),
                "visualIdentityJson": row.get::<_, Option<String>>(16).ok().flatten(),
                "tagsJson": row.get::<_, Option<String>>(17).ok().flatten(),
                "note": row.get::<_, Option<String>>(18).ok().flatten().unwrap_or_default(),
                "sortOrder": row.get::<_, i64>(19).unwrap_or(0),
                "createdAt": row.get::<_, String>(20).unwrap_or_default(),
                "updatedAt": row.get::<_, String>(21).unwrap_or_default(),
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

pub fn asset_image_delete(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM asset_images WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn asset_image_update(
    conn: &Connection,
    payload: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let id = payload["id"].as_str().unwrap_or("");
    if id.is_empty() {
        return Err("缺少 id".into());
    }
    let t = now();
    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(t.clone())];
    let mut idx = 2u32;

    for (json_key, col) in [
        ("category", "category"),
        ("note", "note"),
        ("visualIdentityJson", "visual_identity_json"),
        ("tagsJson", "tags_json"),
        ("assetName", "asset_name"),
    ] {
        if let Some(val) = payload[json_key].as_str() {
            sets.push(format!("{} = ?{}", col, idx));
            param_values.push(Box::new(val.to_string()));
            idx += 1;
        }
    }
    if let Some(val) = payload["sortOrder"].as_i64().or_else(|| payload["sort_order"].as_i64()) {
        sets.push(format!("sort_order = ?{}", idx));
        param_values.push(Box::new(val));
        idx += 1;
    }

    let sql = format!(
        "UPDATE asset_images SET {} WHERE id = ?{}",
        sets.join(", "),
        idx
    );
    param_values.push(Box::new(id.to_string()));

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_ref.as_slice())
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "id": id, "updatedAt": t }))
}

// ── Visual Prompt Outputs ──

pub fn visual_save_output(
    conn: &Connection,
    payload: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let id = uuid();
    let t = now();
    let project_id = payload["projectId"].as_str().unwrap_or("");
    let asset_type = payload["assetType"].as_str().unwrap_or("");
    let asset_id = payload["assetId"].as_str().unwrap_or("");
    let template_id = payload["templateId"].as_str().unwrap_or("");
    let prompt_text_en = payload["promptTextEn"]
        .as_str()
        .or_else(|| payload["prompt_text_en"].as_str())
        .or_else(|| payload["promptText"].as_str())
        .unwrap_or("");
    let review_text_zh = payload["reviewTextZh"]
        .as_str()
        .or_else(|| payload["review_text_zh"].as_str())
        .unwrap_or("");
    let source_asset_snapshot_json = payload["sourceAssetSnapshotJson"]
        .as_str()
        .or_else(|| payload["source_asset_snapshot_json"].as_str())
        .unwrap_or("{}");
    let source_asset_hash = payload["sourceAssetHash"]
        .as_str()
        .or_else(|| payload["source_asset_hash"].as_str())
        .unwrap_or("");
    let selected_template_ids_json = payload["selectedTemplateIdsJson"]
        .as_str()
        .or_else(|| payload["selected_template_ids_json"].as_str())
        .unwrap_or("[]");
    let generation_mode = payload["generationMode"]
        .as_str()
        .or_else(|| payload["generation_mode"].as_str())
        .unwrap_or("image");
    let quality_json = payload["qualityJson"]
        .as_str()
        .or_else(|| payload["quality_json"].as_str())
        .unwrap_or("{}");
    let version = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) + 1 FROM visual_prompt_outputs
             WHERE project_id = ?1 AND asset_type = ?2 AND asset_id = ?3 AND template_id = ?4 AND generation_mode = ?5",
            params![project_id, asset_type, asset_id, template_id, generation_mode],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(1);
    conn.execute(
        "INSERT INTO visual_prompt_outputs (id, project_id, script_task_id, asset_type, asset_id, shot_id, output_type, template_id, title, prompt_text, prompt_text_en, review_text_zh, source_asset_snapshot_json, source_asset_hash, selected_template_ids_json, generation_mode, quality_json, prompt_language, platform_preset, params_json, attribution_json, version, favorite, user_note, platform_note, copied_count, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,0,?26,?26)",
        params![
            id,
            project_id,
            payload["scriptTaskId"].as_str().or_else(|| payload["script_task_id"].as_str()).unwrap_or(""),
            asset_type,
            asset_id,
            payload["shotId"].as_str().unwrap_or(""),
            payload["outputType"].as_str().unwrap_or(""),
            template_id,
            payload["title"].as_str().unwrap_or(""),
            payload["promptText"].as_str().unwrap_or(prompt_text_en),
            prompt_text_en,
            review_text_zh,
            source_asset_snapshot_json,
            source_asset_hash,
            selected_template_ids_json,
            generation_mode,
            quality_json,
            payload["promptLanguage"].as_str().unwrap_or("en"),
            payload["platformPreset"].as_str().unwrap_or(""),
            payload["paramsJson"].as_str().unwrap_or("{}"),
            payload["attributionJson"].as_str().unwrap_or("{}"),
            version,
            if payload["favorite"].as_bool().unwrap_or(false) { 1 } else { 0 },
            payload["userNote"].as_str().or_else(|| payload["user_note"].as_str()).unwrap_or(""),
            payload["platformNote"].as_str().or_else(|| payload["platform_note"].as_str()).unwrap_or(""),
            t,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "id": id, "version": version, "createdAt": t }))
}

pub fn visual_list_outputs(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, script_task_id, asset_type, asset_id, shot_id, output_type, template_id, title, prompt_text, prompt_text_en, review_text_zh, source_asset_snapshot_json, source_asset_hash, selected_template_ids_json, generation_mode, quality_json, prompt_language, platform_preset, params_json, attribution_json, version, favorite, user_note, platform_note, copied_count, last_copied_at, created_at, updated_at
             FROM visual_prompt_outputs WHERE project_id = ?1 ORDER BY favorite DESC, created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt
        .query_map([project_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "projectId": row.get::<_, String>(1)?,
                "scriptTaskId": row.get::<_, String>(2)?,
                "assetType": row.get::<_, String>(3)?,
                "assetId": row.get::<_, String>(4)?,
                "shotId": row.get::<_, String>(5)?,
                "outputType": row.get::<_, String>(6)?,
                "templateId": row.get::<_, String>(7)?,
                "title": row.get::<_, String>(8)?,
                "promptText": row.get::<_, String>(9)?,
                "promptTextEn": row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                "reviewTextZh": row.get::<_, Option<String>>(11)?.unwrap_or_default(),
                "sourceAssetSnapshotJson": row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "{}".to_string()),
                "sourceAssetHash": row.get::<_, Option<String>>(13)?.unwrap_or_default(),
                "selectedTemplateIdsJson": row.get::<_, Option<String>>(14)?.unwrap_or_else(|| "[]".to_string()),
                "generationMode": row.get::<_, Option<String>>(15)?.unwrap_or_else(|| "image".to_string()),
                "qualityJson": row.get::<_, Option<String>>(16)?.unwrap_or_else(|| "{}".to_string()),
                "promptLanguage": row.get::<_, String>(17)?,
                "platformPreset": row.get::<_, String>(18)?,
                "paramsJson": row.get::<_, String>(19)?,
                "attributionJson": row.get::<_, String>(20)?,
                "version": row.get::<_, i32>(21)?,
                "favorite": row.get::<_, i32>(22)?,
                "userNote": row.get::<_, Option<String>>(23)?.unwrap_or_default(),
                "platformNote": row.get::<_, Option<String>>(24)?.unwrap_or_default(),
                "copiedCount": row.get::<_, Option<i32>>(25)?.unwrap_or_default(),
                "lastCopiedAt": row.get::<_, Option<String>>(26)?.unwrap_or_default(),
                "createdAt": row.get::<_, String>(27)?,
                "updatedAt": row.get::<_, String>(28)?
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

pub fn visual_update_output_meta(
    conn: &Connection,
    payload: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let id = payload["id"].as_str().unwrap_or("");
    if id.is_empty() {
        return Err("visual/update-output-meta 缺少 id".to_string());
    }

    let favorite = if payload.get("favorite").is_some() && !payload["favorite"].is_null() {
        Some(if payload["favorite"].as_bool().unwrap_or(false) { 1 } else { 0 })
    } else {
        None
    };
    let user_note = payload["userNote"]
        .as_str()
        .or_else(|| payload["user_note"].as_str())
        .map(|s| s.to_string());
    let platform_note = payload["platformNote"]
        .as_str()
        .or_else(|| payload["platform_note"].as_str())
        .map(|s| s.to_string());
    let t = now();

    conn.execute(
        "UPDATE visual_prompt_outputs
         SET favorite = COALESCE(?2, favorite),
             user_note = COALESCE(?3, user_note),
             platform_note = COALESCE(?4, platform_note),
             updated_at = ?5
         WHERE id = ?1",
        params![id, favorite, user_note, platform_note, t],
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "id": id,
        "favorite": favorite,
        "userNote": payload["userNote"].as_str().or_else(|| payload["user_note"].as_str()).unwrap_or(""),
        "platformNote": payload["platformNote"].as_str().or_else(|| payload["platform_note"].as_str()).unwrap_or(""),
        "updatedAt": t
    }))
}

pub fn visual_mark_copied(
    conn: &Connection,
    id: &str,
) -> Result<serde_json::Value, String> {
    if id.is_empty() {
        return Err("visual/mark-copied 缺少 id".to_string());
    }
    let t = now();
    conn.execute(
        "UPDATE visual_prompt_outputs
         SET copied_count = COALESCE(copied_count, 0) + 1,
             last_copied_at = ?2,
             updated_at = ?2
         WHERE id = ?1",
        params![id, t],
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "id": id, "lastCopiedAt": t }))
}

pub fn visual_delete_output(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM visual_prompt_outputs WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn visual_upsert_template(conn: &Connection, tmpl: &serde_json::Value) -> Result<(), String> {
    let t = now();
    let id = tmpl["id"].as_str().unwrap_or_default();
    conn.execute(
        "INSERT INTO visual_prompt_templates (id, source, source_repo, source_url, source_license, source_commit, title, description, category, subcategory, style_tags_json, subject_tags_json, language, prompt_text, arguments_json, preview_images_json, author, original_source_url, published_at, imported_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, category=excluded.category, prompt_text=excluded.prompt_text, arguments_json=excluded.arguments_json, imported_at=excluded.imported_at",
        params![
            id,
            tmpl["source"].as_str().unwrap_or("awesome-gpt-image-2"),
            tmpl["source_repo"].as_str().unwrap_or("YouMind-OpenLab/awesome-gpt-image-2"),
            tmpl["source_url"].as_str().unwrap_or(""),
            "CC BY 4.0",
            tmpl["source_commit"].as_str().unwrap_or(""),
            tmpl["title"].as_str().unwrap_or(""),
            tmpl["description"].as_str().unwrap_or(""),
            tmpl["category"].as_str().unwrap_or(""),
            tmpl["subcategory"].as_str().unwrap_or(""),
            tmpl["style_tags_json"].as_str().unwrap_or("[]"),
            tmpl["subject_tags_json"].as_str().unwrap_or("[]"),
            tmpl["language"].as_str().unwrap_or("en"),
            tmpl["prompt_text"].as_str().unwrap_or(""),
            tmpl["arguments_json"].as_str().unwrap_or("[]"),
            tmpl["preview_images_json"].as_str().unwrap_or("[]"),
            tmpl["author"].as_str().unwrap_or(""),
            tmpl["original_source_url"].as_str().unwrap_or(""),
            tmpl["published_at"].as_str().unwrap_or(""),
            t,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn visual_search_templates(
    conn: &Connection,
    keyword: Option<&str>,
    category: Option<&str>,
    language: Option<&str>,
) -> Result<Vec<serde_json::Value>, String> {
    let sql = r#"
        SELECT * FROM visual_prompt_templates
        WHERE (?1 IS NULL OR title LIKE ?1 OR description LIKE ?1 OR prompt_text LIKE ?1)
          AND (?2 IS NULL OR category = ?2 OR subcategory = ?2)
          AND (?3 IS NULL OR language = ?3)
        ORDER BY imported_at DESC
        LIMIT 200
    "#;

    let keyword_pattern = keyword.map(|k| format!("%{}%", k));
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = stmt
        .query_map(
            params![keyword_pattern, category, language],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "source": row.get::<_, String>(1)?,
                    "sourceRepo": row.get::<_, String>(2)?,
                    "sourceUrl": row.get::<_, String>(3)?,
                    "sourceLicense": row.get::<_, String>(4)?,
                    "sourceCommit": row.get::<_, String>(5)?,
                    "title": row.get::<_, String>(6)?,
                    "description": row.get::<_, String>(7)?,
                    "category": row.get::<_, String>(8)?,
                    "subcategory": row.get::<_, String>(9)?,
                    "styleTagsJson": row.get::<_, String>(10)?,
                    "subjectTagsJson": row.get::<_, String>(11)?,
                    "language": row.get::<_, String>(12)?,
                    "promptText": row.get::<_, String>(13)?,
                    "argumentsJson": row.get::<_, String>(14)?,
                    "previewImagesJson": row.get::<_, String>(15)?,
                    "author": row.get::<_, String>(16)?,
                    "originalSourceUrl": row.get::<_, String>(17)?,
                    "publishedAt": row.get::<_, String>(18)?,
                    "importedAt": row.get::<_, String>(19)?,
                }))
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

pub fn visual_get_template(
    conn: &Connection,
    id: &str,
) -> Result<Option<serde_json::Value>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM visual_prompt_templates WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map([id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "source": row.get::<_, String>(1)?,
                "sourceRepo": row.get::<_, String>(2)?,
                "sourceUrl": row.get::<_, String>(3)?,
                "sourceLicense": row.get::<_, String>(4)?,
                "sourceCommit": row.get::<_, String>(5)?,
                "title": row.get::<_, String>(6)?,
                "description": row.get::<_, String>(7)?,
                "category": row.get::<_, String>(8)?,
                "subcategory": row.get::<_, String>(9)?,
                "styleTagsJson": row.get::<_, String>(10)?,
                "subjectTagsJson": row.get::<_, String>(11)?,
                "language": row.get::<_, String>(12)?,
                "promptText": row.get::<_, String>(13)?,
                "argumentsJson": row.get::<_, String>(14)?,
                "previewImagesJson": row.get::<_, String>(15)?,
                "author": row.get::<_, String>(16)?,
                "originalSourceUrl": row.get::<_, String>(17)?,
                "publishedAt": row.get::<_, String>(18)?,
                "importedAt": row.get::<_, String>(19)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    let first = rows.next().transpose().map_err(|e| e.to_string())?;
    Ok(first)
}

pub fn parse_awesome_readme(content: &str) -> Vec<serde_json::Value> {
    let mut templates = Vec::new();
    let mut in_all_prompts = false;
    let mut current_no = String::new();
    let mut current_title = String::new();
    let mut current_description = String::new();
    let mut current_prompt = String::new();
    let mut current_author = String::new();
    let mut current_source_url = String::new();
    let mut current_language = "en".to_string();
    let mut current_images: Vec<String> = Vec::new();
    let mut section = "";
    let mut in_code = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("## ") && !trimmed.starts_with("### ") {
            if in_all_prompts {
                push_awesome_template(
                    &mut templates,
                    &current_no,
                    &current_title,
                    &current_description,
                    &current_prompt,
                    &current_author,
                    &current_source_url,
                    &current_language,
                    &current_images,
                );
                if !trimmed.contains("All Prompts") {
                    return templates;
                }
            }
            in_all_prompts = trimmed.contains("All Prompts");
            continue;
        }

        if !in_all_prompts {
            continue;
        }

        if trimmed.starts_with("### ") {
            push_awesome_template(
                &mut templates,
                &current_no,
                &current_title,
                &current_description,
                &current_prompt,
                &current_author,
                &current_source_url,
                &current_language,
                &current_images,
            );
            let raw_title = trimmed.trim_start_matches("### ").trim();
            current_no = parse_prompt_no(raw_title);
            current_title = raw_title.to_string();
            current_description.clear();
            current_prompt.clear();
            current_author.clear();
            current_source_url.clear();
            current_language = "en".to_string();
            current_images.clear();
            section = "";
            in_code = false;
            continue;
        }

        if current_title.is_empty() {
            continue;
        }

        if trimmed.starts_with("#### ") {
            let heading = trimmed.trim_start_matches("#### ").trim();
            section = if heading.contains("Description") {
                "description"
            } else if heading.contains("Prompt") {
                "prompt"
            } else if heading.contains("Generated Images") {
                "images"
            } else if heading.contains("Details") {
                "details"
            } else {
                ""
            };
            in_code = false;
            continue;
        }

        match section {
            "description" => {
                if !trimmed.is_empty() {
                    if !current_description.is_empty() {
                        current_description.push('\n');
                    }
                    current_description.push_str(trimmed);
                }
            }
            "prompt" => {
                if trimmed.starts_with("```") {
                    in_code = !in_code;
                    continue;
                }
                if in_code {
                    current_prompt.push_str(line);
                    current_prompt.push('\n');
                }
            }
            "images" => {
                for url in extract_markdown_urls(trimmed) {
                    current_images.push(url);
                }
            }
            "details" => {
                if let Some(rest) = trimmed.strip_prefix("- **Author:**") {
                    current_author = markdown_link_label(rest.trim()).unwrap_or_else(|| rest.trim().to_string());
                } else if let Some(rest) = trimmed.strip_prefix("- **Source:**") {
                    current_source_url = markdown_link_url(rest.trim()).unwrap_or_else(|| rest.trim().to_string());
                } else if let Some(rest) = trimmed.strip_prefix("- **Languages:**") {
                    current_language = rest.trim().to_string();
                }
            }
            _ => {}
        }
    }

    push_awesome_template(
        &mut templates,
        &current_no,
        &current_title,
        &current_description,
        &current_prompt,
        &current_author,
        &current_source_url,
        &current_language,
        &current_images,
    );

    templates
}

fn push_awesome_template(
    templates: &mut Vec<serde_json::Value>,
    no: &str,
    raw_title: &str,
    description: &str,
    prompt: &str,
    author: &str,
    source_url: &str,
    language: &str,
    images: &[String],
) {
    let prompt = prompt.trim();
    if raw_title.trim().is_empty() || prompt.is_empty() {
        return;
    }

    let title_without_no = raw_title
        .split_once(':')
        .map(|(_, rest)| rest.trim())
        .unwrap_or(raw_title.trim());
    let (category, title) = title_without_no
        .split_once(" - ")
        .map(|(category, title)| (category.trim(), title.trim()))
        .unwrap_or(("External Templates", title_without_no));
    let id_suffix = if no.is_empty() {
        slugify(title)
    } else {
        format!("{:0>4}", no)
    };
    let preview_images_json = serde_json::to_string(images).unwrap_or_else(|_| "[]".to_string());

    templates.push(serde_json::json!({
        "id": format!("awesome-gpt-image-2-{}", id_suffix),
        "source": "awesome-gpt-image-2",
        "source_repo": "YouMind-OpenLab/awesome-gpt-image-2",
        "source_url": "https://github.com/YouMind-OpenLab/awesome-gpt-image-2",
        "source_license": "CC BY 4.0",
        "title": title,
        "description": description.trim(),
        "category": category,
        "subcategory": category,
        "style_tags_json": "[]",
        "subject_tags_json": "[]",
        "prompt_text": prompt,
        "language": if language.trim().is_empty() { "en" } else { language.trim() },
        "author": author.trim(),
        "original_source_url": source_url.trim(),
        "published_at": "",
        "preview_images_json": preview_images_json,
        "arguments_json": extract_raycast_args(prompt),
    }));
}

fn parse_prompt_no(raw_title: &str) -> String {
    raw_title
        .strip_prefix("No. ")
        .and_then(|rest| rest.split(':').next())
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
}

fn slugify(value: &str) -> String {
    let slug = value
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() {
        uuid()
    } else {
        slug
    }
}

fn markdown_link_label(value: &str) -> Option<String> {
    let start = value.find('[')? + 1;
    let end = value[start..].find(']')? + start;
    Some(value[start..end].to_string())
}

fn markdown_link_url(value: &str) -> Option<String> {
    let start = value.find("](")? + 2;
    let end = value[start..].find(')')? + start;
    Some(value[start..end].to_string())
}

fn extract_markdown_urls(value: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut rest = value;
    while let Some(start) = rest.find("](") {
        let after = &rest[start + 2..];
        if let Some(end) = after.find(')') {
            urls.push(after[..end].to_string());
            rest = &after[end + 1..];
        } else {
            break;
        }
    }
    let mut html_rest = value;
    while let Some(start) = html_rest.find("src=\"") {
        let after = &html_rest[start + 5..];
        if let Some(end) = after.find('"') {
            urls.push(after[..end].to_string());
            html_rest = &after[end + 1..];
        } else {
            break;
        }
    }
    urls
}

fn extract_raycast_args(prompt_text: &str) -> String {
    let mut args: Vec<serde_json::Value> = Vec::new();
    let normalized = prompt_text.replace("\\\"", "\"");
    let re = regex_lite::Regex::new(r#"\{argument\s+name="([^"]+)"[^}]*\}"#).ok();
    if let Some(re) = re {
        let mut seen = std::collections::HashSet::new();
        for cap in re.captures_iter(&normalized) {
            let name = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            if seen.contains(name) {
                continue;
            }
            seen.insert(name);
            let default = cap
                .get(0)
                .and_then(|m| {
                    let full = m.as_str();
                    let start = full.find("default=\"")? + 9;
                    let rest = &full[start..];
                    let end = rest.find('"').unwrap_or(rest.len());
                    Some(&rest[..end])
                })
                .unwrap_or("")
                .to_string();
            args.push(serde_json::json!({
                "key": name.to_string(),
                "label": name.to_string(),
                "type": "text",
                "default": default,
            }));
        }
    }
    serde_json::to_string(&args).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_awesome_readme_all_prompts_sections() {
        let readme = r#"
# Awesome GPT Image 2

## 📋 All Prompts

### No. 1: Character - Three View Sheet

#### Description
A production-ready character turnaround template.

#### Prompt
```
Create a three-view sheet for {argument name="subject" default="a paper bride"} in {argument name="style" default="cinematic horror"}.
```

#### Generated Images
[Preview](https://example.com/preview.png)
<img src="https://example.com/preview-2.png" width="600">

#### Details
- **Author:** [OpenLab](https://example.com/author)
- **Source:** [Original](https://example.com/source)
- **Languages:** en

## Other Section
"#;

        let parsed = parse_awesome_readme(readme);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0]["id"], "awesome-gpt-image-2-0001");
        assert_eq!(parsed[0]["category"], "Character");
        assert_eq!(parsed[0]["title"], "Three View Sheet");
        assert_eq!(parsed[0]["author"], "OpenLab");
        assert_eq!(parsed[0]["original_source_url"], "https://example.com/source");

        let args: serde_json::Value =
            serde_json::from_str(parsed[0]["arguments_json"].as_str().unwrap()).unwrap();
        assert_eq!(args.as_array().unwrap().len(), 2);
        assert_eq!(args[0]["key"], "subject");
        assert_eq!(args[0]["default"], "a paper bride");

        let images: serde_json::Value =
            serde_json::from_str(parsed[0]["preview_images_json"].as_str().unwrap()).unwrap();
        assert_eq!(images[0], "https://example.com/preview.png");
        assert_eq!(images[1], "https://example.com/preview-2.png");
    }
}
