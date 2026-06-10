use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn truncate_chars(input: &str, max_chars: usize) -> String {
    input.chars().take(max_chars).collect()
}

fn new_project_id() -> String {
    use rand::Rng;
    format!("sp_{:012x}", rand::thread_rng().gen::<u64>())
}

fn new_version_id() -> String {
    use rand::Rng;
    format!("v_{:08x}", rand::thread_rng().gen::<u32>())
}

fn now() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInit {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub concept: Option<String>,
    #[serde(default)]
    pub duration: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(alias = "imported_script", default)]
    pub imported_script: Option<String>,
    #[serde(alias = "imported_file_name", default)]
    pub imported_file_name: Option<String>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(alias = "ultrashort_mode", default)]
    pub ultrashort_mode: Option<String>,
    #[serde(default)]
    pub genres: Option<Vec<String>>,
    #[serde(default)]
    pub chinese: Option<bool>,
    #[serde(default)]
    pub master: Option<String>,
    #[serde(alias = "client_request_id", default)]
    pub client_request_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VersionEntry {
    pub id: String,
    #[serde(alias = "step_number", default)]
    pub step_number: u8,
    #[serde(alias = "version_number", default)]
    pub version_number: u32,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub output: Option<String>,
    #[serde(default)]
    pub structured: Option<serde_json::Value>,
    #[serde(alias = "user_feedback", default)]
    pub user_feedback: Option<String>,
    #[serde(alias = "created_at")]
    pub created_at: String,
    #[serde(alias = "is_active", default)]
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepBucket {
    #[serde(default)]
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SelfcheckData {
    pub items: Vec<serde_json::Value>,
    #[serde(alias = "created_at")]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    #[serde(alias = "project_id")]
    pub project_id: String,
    #[serde(default)]
    pub user_id: String,
    pub init: ProjectInit,
    #[serde(alias = "created_at")]
    pub created_at: String,
    #[serde(alias = "updated_at")]
    pub updated_at: String,
    #[serde(alias = "current_step", default)]
    pub current_step: u8,
    #[serde(alias = "done_steps", default)]
    pub done_steps: Vec<u8>,
    #[serde(default)]
    pub steps: HashMap<String, StepBucket>,
    #[serde(default)]
    pub selections: HashMap<String, String>,
    #[serde(default)]
    pub selfchecks: HashMap<String, SelfcheckData>,
    #[serde(alias = "linked_script_task_id", default)]
    pub linked_script_task_id: Option<String>,
    #[serde(default)]
    pub checkpoints: HashMap<String, String>,
    #[serde(alias = "structural_choices", default)]
    pub structural_choices: Option<serde_json::Value>,
}

impl ProjectRecord {
    pub fn create(user_id: &str, init: ProjectInit) -> Self {
        let t = now();
        let mut effective_init = init;
        effective_init.name = effective_init
            .name
            .filter(|n| !n.trim().is_empty())
            .or_else(|| {
                effective_init
                    .concept
                    .as_ref()
                    .map(|c| truncate_chars(c, 30))
            })
            .or_else(|| Some("未命名剧本".into()));

        let current_step = 1;

        Self {
            project_id: new_project_id(),
            user_id: user_id.to_string(),
            init: effective_init,
            created_at: t.clone(),
            updated_at: t,
            current_step,
            done_steps: vec![0],
            steps: HashMap::new(),
            selections: HashMap::new(),
            selfchecks: HashMap::new(),
            linked_script_task_id: None,
            checkpoints: HashMap::new(),
            structural_choices: None,
        }
    }

    pub fn save(&self, conn: &Connection) -> Result<(), String> {
        let init_json = serde_json::to_string(&self.init).unwrap_or_default();
        let done_steps_json = serde_json::to_string(&self.done_steps).unwrap_or_default();
        let steps_json = serde_json::to_string(&self.steps).unwrap_or_default();
        let selections_json = serde_json::to_string(&self.selections).unwrap_or_default();
        let selfchecks_json = serde_json::to_string(&self.selfchecks).unwrap_or_default();
        let checkpoints_json = serde_json::to_string(&self.checkpoints).unwrap_or_default();
        let structural_choices_json = serde_json::to_string(&self.structural_choices).unwrap_or_default();

        conn.execute(
            r#"
            INSERT INTO screenplay_projects (
                id, user_id, name, init_json, current_step, done_steps,
                steps_json, selections_json, selfchecks_json,
                checkpoints_json, structural_choices_json,
                linked_script_task_id, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
            )
            ON CONFLICT(id) DO UPDATE SET
                user_id = excluded.user_id,
                name = excluded.name,
                init_json = excluded.init_json,
                current_step = excluded.current_step,
                done_steps = excluded.done_steps,
                steps_json = excluded.steps_json,
                selections_json = excluded.selections_json,
                selfchecks_json = excluded.selfchecks_json,
                checkpoints_json = excluded.checkpoints_json,
                structural_choices_json = excluded.structural_choices_json,
                linked_script_task_id = excluded.linked_script_task_id,
                updated_at = excluded.updated_at
            "#,
            params![
                self.project_id,
                self.user_id,
                self.init.name,
                init_json,
                self.current_step,
                done_steps_json,
                steps_json,
                selections_json,
                selfchecks_json,
                checkpoints_json,
                structural_choices_json,
                self.linked_script_task_id,
                self.created_at,
                self.updated_at
            ],
        ).map_err(|e| e.to_string())?;
        
        Ok(())
    }

    pub fn load(conn: &Connection, project_id: &str, user_id: &str) -> Option<Self> {
        let mut stmt = conn.prepare(
            r#"
            SELECT 
                id, user_id, init_json, created_at, updated_at,
                current_step, done_steps, steps_json, selections_json,
                selfchecks_json, linked_script_task_id, checkpoints_json,
                structural_choices_json
            FROM screenplay_projects
            WHERE id = ?1 AND user_id = ?2
            "#
        ).ok()?;
        
        let mut rows = stmt.query(params![project_id, user_id]).ok()?;
        if let Some(row) = rows.next().ok().flatten() {
            let init_json: String = row.get(2).unwrap_or_default();
            let done_steps_json: String = row.get(6).unwrap_or_default();
            let steps_json: String = row.get(7).unwrap_or_default();
            let selections_json: String = row.get(8).unwrap_or_default();
            let selfchecks_json: String = row.get(9).unwrap_or_default();
            let checkpoints_json: String = row.get(11).unwrap_or_default();
            let structural_choices_json: String = row.get(12).unwrap_or_default();

            Some(Self {
                project_id: row.get(0).unwrap_or_default(),
                user_id: row.get(1).unwrap_or_default(),
                init: serde_json::from_str(&init_json).unwrap_or_else(|_| ProjectInit {
                    name: None, concept: None, duration: None, path: None, imported_script: None,
                    imported_file_name: None, format: None, ultrashort_mode: None, genres: None,
                    chinese: None, master: None, client_request_id: None,
                }),
                created_at: row.get(3).unwrap_or_default(),
                updated_at: row.get(4).unwrap_or_default(),
                current_step: row.get(5).unwrap_or_default(),
                done_steps: serde_json::from_str(&done_steps_json).unwrap_or_else(|_| vec![0]),
                steps: serde_json::from_str(&steps_json).unwrap_or_default(),
                selections: serde_json::from_str(&selections_json).unwrap_or_default(),
                selfchecks: serde_json::from_str(&selfchecks_json).unwrap_or_default(),
                linked_script_task_id: row.get(10).ok().flatten(),
                checkpoints: serde_json::from_str(&checkpoints_json).unwrap_or_default(),
                structural_choices: serde_json::from_str(&structural_choices_json).ok(),
            })
        } else {
            None
        }
    }

    pub fn list_recent(conn: &Connection, user_id: &str, limit: usize) -> Vec<serde_json::Value> {
        let mut stmt = match conn.prepare(
            r#"
            SELECT 
                id, created_at, updated_at, name, init_json,
                current_step, done_steps, linked_script_task_id, steps_json
            FROM screenplay_projects
            WHERE user_id = ?1
            ORDER BY updated_at DESC
            LIMIT ?2
            "#
        ) {
            Ok(stmt) => stmt,
            Err(_) => return vec![],
        };
        
        let mut items = vec![];
        let mut rows = match stmt.query(params![user_id, limit as i64]) {
            Ok(rows) => rows,
            Err(_) => return items,
        };

        while let Some(row) = rows.next().ok().flatten() {
            let project_id: String = row.get(0).unwrap_or_default();
            let created_at: String = row.get(1).unwrap_or_default();
            let updated_at: String = row.get(2).unwrap_or_default();
            let init_json: String = row.get(4).unwrap_or_default();
            let current_step: u8 = row.get(5).unwrap_or(1);
            let done_steps_json: String = row.get(6).unwrap_or_default();
            let linked_task: Option<String> = row.get(7).ok().flatten();
            let steps_json: String = row.get(8).unwrap_or_default();

            let init: ProjectInit = serde_json::from_str(&init_json).unwrap_or_else(|_| ProjectInit {
                name: None, concept: None, duration: None, path: None, imported_script: None,
                imported_file_name: None, format: None, ultrashort_mode: None, genres: None,
                chinese: None, master: None, client_request_id: None,
            });
            let done_steps: Vec<u8> = serde_json::from_str(&done_steps_json).unwrap_or_else(|_| vec![0]);
            let steps: HashMap<String, StepBucket> = serde_json::from_str(&steps_json).unwrap_or_default();

            let version_count: usize = steps.values().map(|bucket| bucket.versions.len()).sum();
            let active_version_count: usize = steps.values()
                .map(|bucket| bucket.versions.iter().filter(|v| v.is_active).count())
                .sum();
            
            let status = if linked_task.is_some() {
                "finalized"
            } else if current_step >= 8 {
                "ready_to_finalize"
            } else {
                "in_progress"
            };

            items.push(serde_json::json!({
                "projectId": project_id,
                "createdAt": created_at,
                "updatedAt": updated_at,
                "name": init.name,
                "concept": init.concept.as_deref().map(|s| truncate_chars(s, 40)),
                "init": init,
                "currentStep": current_step,
                "doneSteps": done_steps,
                "linkedScriptTaskId": linked_task,
                "status": status,
                "taskCount": if linked_task.is_some() { 1 } else { 0 },
                "versionCount": version_count,
                "activeVersionCount": active_version_count,
            }));
        }

        items
    }
}

pub fn create_project(conn: &Connection, user_id: &str, init: ProjectInit) -> ProjectRecord {
    if let Some(existing) = find_by_client_request_id(conn, user_id, init.client_request_id.as_deref()) {
        return existing;
    }
    let rec = ProjectRecord::create(user_id, init);
    let _ = rec.save(conn);
    rec
}

fn find_by_client_request_id(conn: &Connection, user_id: &str, request_id: Option<&str>) -> Option<ProjectRecord> {
    let request_id = request_id?.trim();
    if request_id.is_empty() {
        return None;
    }

    let mut stmt = conn
        .prepare(
            r#"
            SELECT id
            FROM screenplay_projects
            WHERE user_id = ?1
            ORDER BY created_at DESC
            LIMIT 200
            "#,
        )
        .ok()?;
    let rows = stmt.query_map(params![user_id], |row| row.get::<_, String>(0)).ok()?;

    for row in rows.flatten() {
        if let Some(project) = ProjectRecord::load(conn, &row, user_id) {
            if project.init.client_request_id.as_deref() == Some(request_id) {
                return Some(project);
            }
        }
    }
    None
}

pub fn load_project(conn: &Connection, project_id: &str, user_id: &str) -> Option<ProjectRecord> { 
    ProjectRecord::load(conn, project_id, user_id) 
}

pub fn save_project(conn: &Connection, rec: &ProjectRecord) { 
    let _ = rec.save(conn); 
}

pub fn list_recent_projects(conn: &Connection, user_id: &str, limit: usize) -> Vec<serde_json::Value> { 
    ProjectRecord::list_recent(conn, user_id, limit) 
}

pub fn delete_project(conn: &Connection, project_id: &str, user_id: &str) -> bool {
    conn.execute(
        "DELETE FROM screenplay_projects WHERE id = ?1 AND user_id = ?2",
        params![project_id, user_id]
    ).is_ok_and(|v| v > 0)
}

pub fn rename_project(conn: &Connection, project_id: &str, user_id: &str, new_name: &str) -> bool {
    let mut rec = match load_project(conn, project_id, user_id) { Some(r) => r, None => return false };
    rec.init.name = Some(new_name.trim().to_string());
    rec.updated_at = now();
    let _ = rec.save(conn);
    true
}

pub fn append_version(
    conn: &Connection,
    project_id: &str,
    user_id: &str,
    step_number: u8,
    label: Option<String>,
    output: Option<String>,
    structured: Option<serde_json::Value>,
    user_feedback: Option<String>,
) -> Option<VersionEntry> {
    let mut rec = load_project(conn, project_id, user_id)?;
    let bucket = rec.steps.entry(step_number.to_string()).or_insert(StepBucket { versions: vec![] });
    for v in &mut bucket.versions { v.is_active = false; }
    let version = VersionEntry {
        id: new_version_id(),
        step_number,
        version_number: (bucket.versions.len() + 1) as u32,
        label,
        output,
        structured,
        user_feedback,
        created_at: now(),
        is_active: true,
    };
    bucket.versions.push(version.clone());
    rec.current_step = step_number;
    rec.updated_at = now();
    let _ = rec.save(conn);
    Some(version)
}

pub fn approve_step(conn: &Connection, project_id: &str, user_id: &str, step_number: u8, next_step: Option<u8>) -> Option<ProjectRecord> {
    let mut rec = load_project(conn, project_id, user_id)?;
    if !rec.done_steps.contains(&step_number) { rec.done_steps.push(step_number); }
    rec.current_step = next_step.map(|n| n.clamp(0, 9)).unwrap_or_else(|| (step_number + 1).min(9));
    rec.updated_at = now();
    let _ = rec.save(conn);
    Some(rec)
}

pub fn rollback_to(conn: &Connection, project_id: &str, user_id: &str, target_step: u8) -> Option<ProjectRecord> {
    let mut rec = load_project(conn, project_id, user_id)?;
    rec.current_step = target_step;
    rec.done_steps.retain(|n| *n < target_step);
    rec.updated_at = now();
    let _ = rec.save(conn);
    Some(rec)
}

pub fn set_active_version(conn: &Connection, project_id: &str, user_id: &str, step_number: u8, version_id: &str) {
    if let Some(mut rec) = load_project(conn, project_id, user_id) {
        if let Some(bucket) = rec.steps.get_mut(&step_number.to_string()) {
            for v in &mut bucket.versions { v.is_active = v.id == version_id; }
        }
        rec.updated_at = now();
        let _ = rec.save(conn);
    }
}

pub fn get_active_version(conn: &Connection, project_id: &str, user_id: &str, step_number: u8) -> Option<VersionEntry> {
    let rec = load_project(conn, project_id, user_id)?;
    let bucket = rec.steps.get(&step_number.to_string())?;
    let active = bucket.versions.iter().find(|v| v.is_active);
    Some(active.cloned().unwrap_or_else(|| bucket.versions.last().cloned().unwrap()))
}

pub fn list_versions(conn: &Connection, project_id: &str, user_id: &str, step_number: u8) -> Vec<VersionEntry> {
    load_project(conn, project_id, user_id).and_then(|rec| rec.steps.get(&step_number.to_string()).cloned()).map(|b| b.versions).unwrap_or_default()
}

pub fn set_step_selection(conn: &Connection, project_id: &str, user_id: &str, step_number: u8, selection_id: Option<String>) {
    if let Some(mut rec) = load_project(conn, project_id, user_id) {
        if let Some(sid) = selection_id { rec.selections.insert(step_number.to_string(), sid); } else { rec.selections.remove(&step_number.to_string()); }
        rec.updated_at = now();
        let _ = rec.save(conn);
    }
}

pub fn save_selfcheck(conn: &Connection, project_id: &str, user_id: &str, step_number: u8, items: Vec<serde_json::Value>) {
    if let Some(mut rec) = load_project(conn, project_id, user_id) {
        rec.selfchecks.insert(step_number.to_string(), SelfcheckData { items, created_at: now() });
        rec.updated_at = now();
        let _ = rec.save(conn);
    }
}

pub fn get_selfcheck(conn: &Connection, project_id: &str, user_id: &str, step_number: u8) -> Option<SelfcheckData> {
    load_project(conn, project_id, user_id).and_then(|rec| rec.selfchecks.get(&step_number.to_string()).cloned())
}

pub fn save_checkpoint(conn: &Connection, project_id: &str, user_id: &str, trigger: &str, content: &str) -> bool {
    let mut rec = match load_project(conn, project_id, user_id) { Some(r) => r, None => return false };
    rec.checkpoints.insert(trigger.to_string(), content.to_string());
    rec.updated_at = now();
    let _ = rec.save(conn);
    true
}

pub fn get_checkpoint(conn: &Connection, project_id: &str, user_id: &str, trigger: &str) -> Option<String> {
    load_project(conn, project_id, user_id).and_then(|rec| rec.checkpoints.get(trigger).cloned())
}

pub fn set_linked_script_task_id(conn: &Connection, project_id: &str, user_id: &str, task_id: &str) {
    if let Some(mut rec) = load_project(conn, project_id, user_id) {
        rec.linked_script_task_id = Some(task_id.to_string());
        rec.updated_at = now();
        let _ = rec.save(conn);
    }
}

pub fn build_project_snapshot(conn: &Connection, project_id: &str, user_id: &str) -> serde_json::Value {
    let rec = match load_project(conn, project_id, user_id) {
        Some(r) => r,
        None => return serde_json::json!({"steps":{}, "selections":{}, "checkpoints":{}}),
    };
    let mut steps = serde_json::json!({});
    for n in 1..=8 {
        if let Some(version) = get_active_version(conn, project_id, user_id, n) {
            let mut step_value = serde_json::json!({});
            if let Some(structured) = version.structured { step_value["structured"] = structured; }
            if let Some(output) = version.output.as_deref() { step_value["outputPreview"] = serde_json::Value::String(truncate_chars(output, 3000)); }
            if step_value.as_object().map(|o| !o.is_empty()).unwrap_or(false) { steps[&n.to_string()] = step_value; }
        }
    }
    let ckpt = rec.checkpoints.get("after-step-6").map(|s| truncate_chars(s, 3000)).unwrap_or_default();
    let mut checkpoints = serde_json::json!({});
    if !ckpt.is_empty() { checkpoints["after-step-6"] = serde_json::Value::String(ckpt); }
    serde_json::json!({ "steps": steps, "selections": rec.selections, "checkpoints": checkpoints })
}

pub fn update_active_step_structured(conn: &Connection, project_id: &str, user_id: &str, step_number: u8, structured: serde_json::Value) -> bool {
    let mut rec = match load_project(conn, project_id, user_id) { Some(r) => r, None => return false };
    let bucket = match rec.steps.get_mut(&step_number.to_string()) { Some(b) => b, None => return false };
    let idx = bucket.versions.iter().position(|v| v.is_active).unwrap_or_else(|| bucket.versions.len().wrapping_sub(1));
    let active = match bucket.versions.get_mut(idx) { Some(v) => v, None => return false };

    if let Some(manual_output) = structured.get("_manualOutput").and_then(|v| v.as_str()) {
        active.output = Some(manual_output.to_string());
        let parsed = crate::utils::step_parser::parse_step_output(step_number, manual_output);
        let fallback = structured.as_object().map(|obj| {
            let mut next = obj.clone();
            next.remove("_manualOutput");
            serde_json::Value::Object(next)
        });
        active.structured = parsed.or(fallback);
        active.label = Some("手动覆写".into());
    } else {
        active.structured = Some(structured);
    }

    rec.updated_at = now();
    let _ = rec.save(conn);
    true
}
