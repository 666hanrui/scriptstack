use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static PROJECTS_DIR: OnceLock<PathBuf> = OnceLock::new();

fn projects_dir() -> &'static PathBuf {
    PROJECTS_DIR.get().expect("screenplay_store::init_projects_dir must be called before any project operations")
}

fn project_file(project_id: &str) -> PathBuf {
    projects_dir().join(format!("{}.json", project_id))
}

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

#[derive(Debug, Serialize, Deserialize, Clone)]
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
    pub fn create(init: ProjectInit) -> Self {
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

        let current_step = if effective_init.path.as_deref() == Some("import") { 8 } else { 1 };

        Self {
            project_id: new_project_id(),
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

    pub fn save(&self) {
        let file = project_file(&self.project_id);
        if let Ok(json) = serde_json::to_string_pretty(self) {
            std::fs::write(&file, &json).ok();
        }
    }

    pub fn load(project_id: &str) -> Option<Self> {
        let file = project_file(project_id);
        if !file.exists() { return None; }
        std::fs::read_to_string(&file).ok().and_then(|s| serde_json::from_str(&s).ok())
    }

    pub fn list_recent(limit: usize) -> Vec<serde_json::Value> {
        let dir = projects_dir();
        let mut items: Vec<serde_json::Value> = Vec::new();
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(rec) = serde_json::from_str::<ProjectRecord>(&content) {
                        let version_count: usize = rec.steps.values().map(|bucket| bucket.versions.len()).sum();
                        let active_version_count: usize = rec
                            .steps
                            .values()
                            .map(|bucket| bucket.versions.iter().filter(|v| v.is_active).count())
                            .sum();
                        let status = if rec.linked_script_task_id.is_some() {
                            "finalized"
                        } else if rec.current_step >= 8 {
                            "ready_to_finalize"
                        } else {
                            "in_progress"
                        };
                        items.push(serde_json::json!({
                            "projectId": rec.project_id,
                            "createdAt": rec.created_at,
                            "updatedAt": rec.updated_at,
                            "name": rec.init.name,
                            "concept": rec.init.concept.as_deref().map(|s| truncate_chars(s, 40)),
                            "init": rec.init,
                            "currentStep": rec.current_step,
                            "doneSteps": rec.done_steps,
                            "linkedScriptTaskId": rec.linked_script_task_id,
                            "status": status,
                            "taskCount": if rec.linked_script_task_id.is_some() { 1 } else { 0 },
                            "versionCount": version_count,
                            "activeVersionCount": active_version_count,
                        }));
                    } else if let Ok(rec) = serde_json::from_str::<serde_json::Value>(&content) {
                        let project_id = rec["projectId"].as_str().or_else(|| rec["project_id"].as_str()).map(String::from).unwrap_or_default();
                        let updated_at = rec["updatedAt"].as_str().or_else(|| rec["updated_at"].as_str()).map(String::from).unwrap_or_default();
                        let created_at = rec["createdAt"].as_str().or_else(|| rec["created_at"].as_str()).map(String::from).unwrap_or_default();
                        let current_step = rec["currentStep"].as_u64().or_else(|| rec["current_step"].as_u64()).unwrap_or(1);
                        let done_steps = rec["doneSteps"].as_array().cloned().or_else(|| rec["done_steps"].as_array().cloned()).unwrap_or_default();
                        let linked_task = rec["linkedScriptTaskId"].as_str().or_else(|| rec["linked_script_task_id"].as_str()).map(String::from);
                        let name = rec["init"]["name"].as_str();
                        let concept = rec["init"]["concept"].as_str();
                        let steps = rec["steps"].as_object();
                        let version_count: usize = steps
                            .map(|map| map.values().filter_map(|bucket| bucket["versions"].as_array()).map(|v| v.len()).sum())
                            .unwrap_or(0);
                        let active_version_count: usize = steps
                            .map(|map| {
                                map.values()
                                    .filter_map(|bucket| bucket["versions"].as_array())
                                    .map(|versions| versions.iter().filter(|v| v["isActive"].as_bool().or_else(|| v["is_active"].as_bool()).unwrap_or(false)).count())
                                    .sum()
                            })
                            .unwrap_or(0);
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
                            "name": name,
                            "concept": concept.map(|s| truncate_chars(s, 40)),
                            "init": rec["init"].clone(),
                            "currentStep": current_step,
                            "doneSteps": done_steps,
                            "linkedScriptTaskId": linked_task,
                            "status": status,
                            "taskCount": if linked_task.is_some() { 1 } else { 0 },
                            "versionCount": version_count,
                            "activeVersionCount": active_version_count,
                        }));
                    }
                }
            }
        }
        items.sort_by(|a, b| b["updatedAt"].as_str().unwrap_or("").cmp(a["updatedAt"].as_str().unwrap_or("")));
        items.truncate(limit);
        items
    }
}

pub fn init_projects_dir(app_data_dir: &Path) {
    let dir = app_data_dir.join("screenplay-projects");
    std::fs::create_dir_all(&dir).ok();
    PROJECTS_DIR.set(dir).expect("screenplay_store PROJECTS_DIR already initialized — init_projects_dir must be called exactly once before any project operations");
}

pub fn create_project(init: ProjectInit) -> ProjectRecord {
    let rec = ProjectRecord::create(init);
    rec.save();
    rec
}

pub fn load_project(project_id: &str) -> Option<ProjectRecord> { ProjectRecord::load(project_id) }
pub fn save_project(rec: &ProjectRecord) { rec.save(); }
pub fn list_recent_projects(limit: usize) -> Vec<serde_json::Value> { ProjectRecord::list_recent(limit) }

pub fn delete_project_file(project_id: &str) -> bool {
    let file = project_file(project_id);
    file.exists().then(|| std::fs::remove_file(&file).ok()).is_some()
}

pub fn rename_project(project_id: &str, new_name: &str) -> bool {
    let mut rec = match load_project(project_id) { Some(r) => r, None => return false };
    rec.init.name = Some(new_name.trim().to_string());
    rec.save();
    true
}

pub fn append_version(
    project_id: &str,
    step_number: u8,
    label: Option<String>,
    output: Option<String>,
    structured: Option<serde_json::Value>,
    user_feedback: Option<String>,
) -> VersionEntry {
    let mut rec = load_project(project_id).expect("Project not found");
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
    rec.save();
    version
}

pub fn approve_step(project_id: &str, step_number: u8, next_step: Option<u8>) -> ProjectRecord {
    let mut rec = load_project(project_id).expect("Project not found");
    if !rec.done_steps.contains(&step_number) { rec.done_steps.push(step_number); }
    rec.current_step = next_step.map(|n| n.clamp(0, 9)).unwrap_or_else(|| (step_number + 1).min(9));
    rec.save();
    rec
}

pub fn rollback_to(project_id: &str, target_step: u8) -> ProjectRecord {
    let mut rec = load_project(project_id).expect("Project not found");
    rec.current_step = target_step;
    rec.done_steps.retain(|n| *n < target_step);
    rec.save();
    rec
}

pub fn set_active_version(project_id: &str, step_number: u8, version_id: &str) {
    let mut rec = load_project(project_id).expect("Project not found");
    if let Some(bucket) = rec.steps.get_mut(&step_number.to_string()) {
        for v in &mut bucket.versions { v.is_active = v.id == version_id; }
    }
    rec.save();
}

pub fn get_active_version(project_id: &str, step_number: u8) -> Option<VersionEntry> {
    let rec = load_project(project_id)?;
    let bucket = rec.steps.get(&step_number.to_string())?;
    let active = bucket.versions.iter().find(|v| v.is_active);
    Some(active.cloned().unwrap_or_else(|| bucket.versions.last().cloned().unwrap()))
}

pub fn list_versions(project_id: &str, step_number: u8) -> Vec<VersionEntry> {
    load_project(project_id).and_then(|rec| rec.steps.get(&step_number.to_string()).cloned()).map(|b| b.versions).unwrap_or_default()
}

pub fn set_step_selection(project_id: &str, step_number: u8, selection_id: Option<String>) {
    let mut rec = load_project(project_id).expect("Project not found");
    if let Some(sid) = selection_id { rec.selections.insert(step_number.to_string(), sid); } else { rec.selections.remove(&step_number.to_string()); }
    rec.save();
}

pub fn save_selfcheck(project_id: &str, step_number: u8, items: Vec<serde_json::Value>) {
    let mut rec = load_project(project_id).expect("Project not found");
    rec.selfchecks.insert(step_number.to_string(), SelfcheckData { items, created_at: now() });
    rec.save();
}

pub fn get_selfcheck(project_id: &str, step_number: u8) -> Option<SelfcheckData> {
    load_project(project_id).and_then(|rec| rec.selfchecks.get(&step_number.to_string()).cloned())
}

pub fn save_checkpoint(project_id: &str, trigger: &str, content: &str) -> bool {
    let mut rec = match load_project(project_id) { Some(r) => r, None => return false };
    rec.checkpoints.insert(trigger.to_string(), content.to_string());
    rec.save();
    true
}

pub fn get_checkpoint(project_id: &str, trigger: &str) -> Option<String> {
    load_project(project_id).and_then(|rec| rec.checkpoints.get(trigger).cloned())
}

pub fn set_linked_script_task_id(project_id: &str, task_id: &str) {
    let mut rec = load_project(project_id).expect("Project not found");
    rec.linked_script_task_id = Some(task_id.to_string());
    rec.save();
}

pub fn build_project_snapshot(project_id: &str) -> serde_json::Value {
    let rec = match load_project(project_id) {
        Some(r) => r,
        None => return serde_json::json!({"steps":{}, "selections":{}, "checkpoints":{}}),
    };
    let mut steps = serde_json::json!({});
    for n in 1..=8 {
        if let Some(version) = get_active_version(project_id, n) {
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

pub fn update_active_step_structured(project_id: &str, step_number: u8, structured: serde_json::Value) -> bool {
    let mut rec = match load_project(project_id) { Some(r) => r, None => return false };
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

    rec.save();
    true
}
