use serde_json::{json, Value};

// ── Template files (embedded at compile time) ──

const SELFCHECK_TEMPLATE: &str = include_str!("prompts/selfcheck.txt");
const CHECKPOINT_TEMPLATE: &str = include_str!("prompts/checkpoint.txt");

// ── PromptSlug template files ──

const SLUG_SCRIPT_PLANNING: &str = include_str!("prompts/slug_script_planning.txt");
const SLUG_SCRIPT_WRITING: &str = include_str!("prompts/slug_script_writing.txt");
const SLUG_SCRIPT_REVIEW: &str = include_str!("prompts/slug_script_review.txt");
const SLUG_ASSET_CHARACTER: &str = include_str!("prompts/slug_asset_character.txt");
const SLUG_ASSET_SCENE: &str = include_str!("prompts/slug_asset_scene.txt");
const SLUG_ASSET_PROP: &str = include_str!("prompts/slug_asset_prop.txt");
const SLUG_PROMPT_SEGMENT_PLANNING: &str = include_str!("prompts/slug_prompt_segment_planning.txt");
const SLUG_PROMPT_SEEDANCE_SCENE: &str = include_str!("prompts/slug_prompt_seedance_scene.txt");
const SLUG_IMAGE_PROMPT_GENERATION: &str = include_str!("prompts/slug_image_prompt_generation.txt");
const SLUG_VIDEO_PROMPT_GENERATION: &str = include_str!("prompts/slug_video_prompt_generation.txt");
const SLUG_PROMPT_REVIEW: &str = include_str!("prompts/slug_prompt_review.txt");

// ── ContextType template files ──

const CTX_SEEDANCE_PHASE_AD: &str = include_str!("prompts/ctx_seedance_phase_ad.txt");
const CTX_SEEDANCE_UNIT_EFG: &str = include_str!("prompts/ctx_seedance_unit_efg.txt");
const PROMPT_MANIFEST: &str = include_str!("prompts/manifest.json");

fn canonical_entry(
    files: &[Value],
    order: u8,
    phase: &str,
    phase_label: &str,
    stage: &str,
    usage_key: &str,
    route: &str,
    page: &str,
    command: &str,
    required_input: &str,
    produced_artifact: &str,
) -> Value {
    let meta = files
        .iter()
        .find(|item| item["usageKey"].as_str() == Some(usage_key));

    json!({
        "order": order,
        "phase": phase,
        "phaseLabel": phase_label,
        "stage": stage,
        "usageKey": usage_key,
        "route": route,
        "page": page,
        "command": command,
        "requiredInput": required_input,
        "producedArtifact": produced_artifact,
        "promptFile": meta.and_then(|item| item["file"].as_str()).unwrap_or(""),
        "category": meta.and_then(|item| item["category"].as_str()).unwrap_or(""),
        "callEntry": meta.and_then(|item| item["callEntry"].as_str()).unwrap_or(""),
        "promptSlug": meta.and_then(|item| item["promptSlug"].as_str()),
        "contextType": meta.and_then(|item| item["contextType"].as_str()),
        "activePath": meta.and_then(|item| item["activePath"].as_str()).unwrap_or(""),
        "rawArchivePath": meta.and_then(|item| item["rawArchivePath"].as_str()).unwrap_or(""),
        "activeSha256": meta.and_then(|item| item["activeSha256"].as_str()).unwrap_or(""),
        "byteSize": meta.and_then(|item| item["byteSize"].as_u64()).unwrap_or(0),
        "lineCount": meta.and_then(|item| item["lineCount"].as_u64()).unwrap_or(0),
        "exactMatch": meta.and_then(|item| item["exactMatch"].as_bool()).unwrap_or(false),
        "auditStatus": meta.and_then(|item| item["auditStatus"].as_str()).unwrap_or("missing"),
    })
}

/// Canonical product flow for the original 23 prompts.
///
/// This is intentionally explicit: the UI can render it, audits can compare it,
/// and future migrations have a single contract to preserve instead of relying
/// on scattered page labels.
pub fn canonical_flow_contract() -> Value {
    let manifest: Value = serde_json::from_str(PROMPT_MANIFEST).unwrap_or_else(|_| json!({}));
    let files = manifest["files"].as_array().cloned().unwrap_or_default();

    let entries = vec![
        canonical_entry(&files, 1, "screenplay", "剧本工作流", "Step 1 / 破题 / 概念生成", "screenplay_step stepNumber=1", "/workflow", "WorkflowValley / StepEngine", "workflow/generate", "project.init + concept + config", "step_1 active version"),
        canonical_entry(&files, 2, "screenplay", "剧本工作流", "Step 2 / 人物", "screenplay_step stepNumber=2", "/workflow", "WorkflowValley / StepEngine", "workflow/generate", "Step 1 structured output", "step_2 active version"),
        canonical_entry(&files, 3, "screenplay", "剧本工作流", "Step 3 / 世界观", "screenplay_step stepNumber=3", "/workflow", "WorkflowValley / StepEngine", "workflow/generate", "Step 1-2 structured output", "step_3 active version"),
        canonical_entry(&files, 4, "screenplay", "剧本工作流", "Step 4 / 大纲", "screenplay_step stepNumber=4", "/workflow", "WorkflowValley / StepEngine", "workflow/generate", "Step 1-3 structured output", "step_4 active version"),
        canonical_entry(&files, 5, "screenplay", "剧本工作流", "Step 5 / 分场", "screenplay_step stepNumber=5", "/workflow", "WorkflowValley / StepEngine", "workflow/generate", "Step 1-4 structured output", "step_5 active version"),
        canonical_entry(&files, 6, "screenplay", "剧本工作流", "Step 6 / 对白", "screenplay_step stepNumber=6", "/workflow", "WorkflowValley / StepEngine", "workflow/generate", "Step 1-5 structured output + duration redline", "step_6 active version"),
        canonical_entry(&files, 7, "screenplay", "剧本工作流", "Step 7 / 成稿", "screenplay_step stepNumber=7", "/workflow", "WorkflowValley / StepEngine", "workflow/generate", "Step 1-6 output + after-step-6 checkpoint", "step_7 active version"),
        canonical_entry(&files, 8, "screenplay", "剧本工作流", "Step 8 / 医生收束", "screenplay_step stepNumber=8", "/workflow", "WorkflowValley / StepEngine", "workflow/generate", "Step 1-7 output + after-step-6 checkpoint", "step_8 active version"),
        canonical_entry(&files, 9, "screenplay_quality", "剧本工作流质量门", "Selfcheck / 单步自检", "screenplay_selfcheck", "/workflow", "WorkflowValley / StepEngine", "workflow/selfcheck", "current step output", "cached selfcheck report"),
        canonical_entry(&files, 10, "screenplay_quality", "剧本工作流质量门", "Checkpoint / Step 6 后检查点", "screenplay_checkpoint", "/workflow", "WorkflowValley / StepEngine + AiDoctorPanel", "workflow/regenerate-checkpoint", "project snapshot after Step 6", "after-step-6 checkpoint"),
        canonical_entry(&files, 11, "script_task", "剧本任务", "Script Planning / 剧本规划", "promptSlug=script_planning", "/scripts", "ScriptTasksPage", "script/generate", "input summary + mode + audience + style", "script planning sections"),
        canonical_entry(&files, 12, "script_task", "剧本任务", "Script Writing / 正文生成", "promptSlug=script_writing", "/scripts", "ScriptTasksPage", "script/generate", "planning result + generation settings", "script body"),
        canonical_entry(&files, 13, "script_task", "剧本任务", "Script Review / 剧本审核", "promptSlug=script_review", "/scripts", "ScriptTasksPage", "script/review", "script task body", "script review score/issues/suggestions"),
        canonical_entry(&files, 14, "asset_matrix", "资产矩阵", "Asset Character / 角色资产", "promptSlug=asset_character", "/assets", "AssetsForge", "asset/extract", "script task body", "characters json"),
        canonical_entry(&files, 15, "asset_matrix", "资产矩阵", "Asset Scene / 场景资产", "promptSlug=asset_scene", "/assets", "AssetsForge", "asset/extract", "script task body", "scenes json"),
        canonical_entry(&files, 16, "asset_matrix", "资产矩阵", "Asset Prop / 道具资产", "promptSlug=asset_prop", "/assets", "AssetsForge", "asset/extract", "script task body", "props json"),
        canonical_entry(&files, 17, "frame_prompt", "逐镜提示词", "Prompt Segment Planning / 分镜大纲", "promptSlug=prompt_segment_planning", "/frame-prompt", "FramePromptLab", "prompt/generate-outline", "script task body + assets", "outline shots"),
        canonical_entry(&files, 18, "frame_prompt", "逐镜提示词", "Prompt Seedance Scene / 单镜提示词", "promptSlug=prompt_seedance_scene", "/frame-prompt", "FramePromptLab", "prompt/run-generation + prompt/run-group-generation", "confirmed outline + scene index + feedback", "seedanceGroups json"),
        canonical_entry(&files, 19, "seedance", "Seedance", "Seedance Phase A-D / 镜头结构分析", "contextType=seedance_phase_ad", "/seedance", "SeedancePage", "seedance/phase-ad", "script body + duration + assets", "seedance analysis + units"),
        canonical_entry(&files, 20, "seedance", "Seedance", "Seedance Unit E/F/G / 镜头单元生成", "contextType=seedance_unit_efg", "/seedance", "SeedancePage", "seedance/run-unit + seedance/run-all", "unit + script fragment + analysis + assets", "unit copyArea + noteAreaJson"),
        canonical_entry(&files, 21, "independent_prompt", "独立提示词", "Image Prompt Generation / 图像提示词", "promptSlug=image_prompt_generation", "/image", "PromptLab(image)", "prompt/image", "source script + visual style + image goal", "image prompt task"),
        canonical_entry(&files, 22, "independent_prompt", "独立提示词", "Video Prompt Generation / 视频提示词", "promptSlug=video_prompt_generation", "/video", "PromptLab(video)", "prompt/video", "script beats + video style + motion focus", "video prompt task"),
        canonical_entry(&files, 23, "prompt_review", "提示词审核", "Prompt Review / 提示词质量审核", "promptSlug=prompt_review", "/frame-prompt", "PromptLab + FramePromptLab", "prompt/image-review + prompt/video-review + prompt/quality-check", "generated prompt output", "prompt review score/issues/suggestions"),
    ];

    json!({
        "version": 1,
        "source": "src-tauri/src/llm/prompts/manifest.json",
        "authority": manifest["authority"].clone(),
        "promptManifestVersion": manifest["version"].clone(),
        "total": entries.len(),
        "manifestTotal": manifest["total"].clone(),
        "exactMatches": manifest["exactMatches"].clone(),
        "failures": manifest["failures"].clone(),
        "entries": entries,
    })
}

/// Build system prompt and user message for a given LLM context type.
pub fn build_prompt(context_type: &str, params: &Value) -> (String, String) {
    match context_type {
        "screenplay_step" => build_step_prompt(params),
        "screenplay_selfcheck" => build_selfcheck_prompt(params),
        "screenplay_checkpoint" => build_checkpoint_prompt(params),
        "seedance_phase_ad" => build_seedance_phase_ad_prompt(params),
        "seedance_unit_efg" => build_seedance_unit_efg_prompt(params),
        "visual_smart_asset_prompt" => build_visual_smart_asset_prompt(params),
        _ => (
            "你是一个专业的AI助手。".to_string(),
            format!(
                "请根据以下信息生成内容：\n{}",
                serde_json::to_string_pretty(params).unwrap_or_default()
            ),
        ),
    }
}

/// Build system prompt and user messages for a promptSlug-based LLM call.
/// Returns (system_prompt, user_messages_vec) where user_messages are
/// the original user messages from the caller.
pub fn build_prompt_slug(slug: &str, user_messages: &[Value]) -> (String, Vec<Value>) {
    let system = match slug {
        "script_planning" => SLUG_SCRIPT_PLANNING,
        "script_writing" => SLUG_SCRIPT_WRITING,
        "script_review" => SLUG_SCRIPT_REVIEW,
        "asset_character" => SLUG_ASSET_CHARACTER,
        "asset_scene" => SLUG_ASSET_SCENE,
        "asset_prop" => SLUG_ASSET_PROP,
        "prompt_segment_planning" => SLUG_PROMPT_SEGMENT_PLANNING,
        "prompt_seedance_scene" => SLUG_PROMPT_SEEDANCE_SCENE,
        "image_prompt_generation" => SLUG_IMAGE_PROMPT_GENERATION,
        "video_prompt_generation" => SLUG_VIDEO_PROMPT_GENERATION,
        "prompt_review" => SLUG_PROMPT_REVIEW,
        _ => "你是一个专业的AI助手。",
    };
    (system.to_string(), user_messages.to_vec())
}

// ── Step prompt builder ──

fn build_step_prompt(params: &Value) -> (String, String) {
    let step_number = params["stepNumber"].as_u64().unwrap_or(1);
    let init = &params["init"];
    let project_snapshot = &params["projectSnapshot"];
    let user_feedback = params["userFeedback"].as_str().unwrap_or("");

    let duration = init["duration"]
        .as_str()
        .filter(|s| !s.is_empty())
        .unwrap_or("2分钟");
    let seconds = parse_seconds(duration);

    let mut system = build_step_system(step_number, duration, &seconds);

    // Prep config block at the top so step templates' "顶部" references find it
    let mut config_block = String::new();
    if let Some(f) = init["format"].as_str().filter(|s| !s.is_empty()) {
        config_block.push_str(&format!("format: {}\n", f));
    }
    if let Some(u) = init["ultrashortMode"].as_str().filter(|s| !s.is_empty()) {
        config_block.push_str(&format!("ultrashortMode: {}\n", u));
    }
    if let Some(g) = init["genres"].as_array() {
        let genres: Vec<&str> = g.iter().filter_map(|v| v.as_str()).collect();
        if !genres.is_empty() {
            config_block.push_str(&format!("genres: {}\n", genres.join("、")));
        }
    }
    if init["chinese"].as_bool().unwrap_or(false) {
        config_block.push_str("chinese: true\n");
    }
    if !config_block.is_empty() {
        system = format!("## 项目配置\n{}\n\n{}", config_block, system);
    }

    let user = build_user_message(step_number, init, project_snapshot, user_feedback);

    (system, user)
}

fn build_step_system(step_number: u64, duration: &str, seconds: &str) -> String {
    let template = match step_number {
        1 => include_str!("prompts/step1.txt"),
        2 => include_str!("prompts/step2.txt"),
        3 => include_str!("prompts/step3.txt"),
        4 => include_str!("prompts/step4.txt"),
        5 => include_str!("prompts/step5.txt"),
        6 => include_str!("prompts/step6.txt"),
        7 => include_str!("prompts/step7.txt"),
        8 => include_str!("prompts/step8.txt"),
        _ => return String::new(),
    };

    template
        .replace("{duration}", duration)
        .replace("{seconds}", seconds)
}

fn parse_seconds(duration: &str) -> String {
    let cleaned: String = duration.chars().filter(|c| c.is_ascii_digit()).collect();
    if let Ok(n) = cleaned.parse::<u32>() {
        (n * 60).to_string()
    } else {
        "120".to_string()
    }
}

// ── User message builder ──

fn build_user_message(
    step_number: u64,
    init: &Value,
    project_snapshot: &Value,
    user_feedback: &str,
) -> String {
    let name = init["name"].as_str().filter(|s| !s.is_empty());
    let concept = init["concept"].as_str().filter(|s| !s.is_empty());

    let mut msg = String::new();

    // Include project concept (the user's original idea)
    if let Some(c) = concept {
        msg.push_str(&format!("## 项目核心概念\n{}\n\n", c));
    }
    if let Some(n) = name {
        if name != concept {
            msg.push_str(&format!("## 项目名称\n{}\n\n", n));
        }
    }

    // Include project config fields for template branching
    if let Some(f) = init["format"].as_str().filter(|s| !s.is_empty()) {
        msg.push_str(&format!("## 项目格式\n{}\n\n", f));
    }
    if let Some(u) = init["ultrashortMode"].as_str().filter(|s| !s.is_empty()) {
        msg.push_str(&format!("## 超短片模式\n{}\n\n", u));
    }
    if let Some(g) = init["genres"].as_array() {
        let genres: Vec<&str> = g.iter().filter_map(|v| v.as_str()).collect();
        if !genres.is_empty() {
            msg.push_str(&format!("## 题材\n{}\n\n", genres.join("、")));
        }
    }
    if init["chinese"].as_bool().unwrap_or(false) {
        msg.push_str("## 中式叙事\n启用\n\n");
    }

    if step_number == 6 || step_number == 7 {
        let duration = init["duration"]
            .as_str()
            .filter(|s| !s.is_empty())
            .unwrap_or("2分钟");
        msg.push_str(&format!(
            "\n## ⚠ 时长红线\n\
             本步涉及具体场景时长。所有场景 duration 加起来必须 ≈ **{}** (±10%)。\n\
             输出前先自己把 duration 字段转秒累加一次，验证在目标区间内再输出。\n\n",
            duration
        ));
    }

    // Include previous steps' structured output as context
    if let Some(snapshot) = project_snapshot.as_object() {
        if let Some(steps) = snapshot.get("steps").and_then(|s| s.as_object()) {
            for n in 1..step_number {
                let key = n.to_string();
                if let Some(step_data) = steps.get(&key) {
                    if let Some(structured) = step_data.get("structured") {
                        if !structured.is_null() {
                            let pretty =
                                serde_json::to_string_pretty(structured).unwrap_or_default();
                            let truncated: String = pretty.chars().take(1500).collect();
                            msg.push_str(&format!("### 第{}步产出\n{}\n\n", n, truncated));
                        }
                    }
                }
            }
        }
    }

    if !user_feedback.is_empty() {
        msg.push_str(&format!("## 用户修改要求\n{}\n\n", user_feedback));
    }

    msg.push_str("请严格按 system 中 \"当前任务\" 的输出格式要求产出，不要输出任何 meta 解释。");

    msg
}

// ── Selfcheck prompt builder ──

fn build_selfcheck_prompt(params: &Value) -> (String, String) {
    let step_number = params["stepNumber"].as_u64().unwrap_or(1);
    let current_output = params["currentOutput"].as_str().unwrap_or("(无产出)");
    let init = &params["init"];

    let concept = init["concept"].as_str().unwrap_or("");
    let duration = init["duration"]
        .as_str()
        .filter(|s| !s.is_empty())
        .unwrap_or("");
    let _name = init["name"].as_str().unwrap_or("");

    let system = SELFCHECK_TEMPLATE.replace("{stepNumber}", &step_number.to_string());

    let user = format!(
        "## 待自检 · 第 {} 步 (当前产出)\n\n\
         项目概念：{}\n时长：{}\n\n\
         ```\n{}\n```\n\n\
         请严格按 system 中 \"输出格式\" 给出 markdown 自检报告 \
         (## CHECK N 块 · === 分隔)。不要输出任何其他文字。",
        step_number, concept, duration, current_output
    );

    (system, user)
}

// ── Checkpoint prompt builder ──

fn build_checkpoint_prompt(params: &Value) -> (String, String) {
    let init = &params["init"];
    let _project_snapshot = &params["projectSnapshot"];

    let name = init["name"].as_str().unwrap_or("");
    let concept = init["concept"].as_str().unwrap_or("");
    let duration = init["duration"]
        .as_str()
        .filter(|s| !s.is_empty())
        .unwrap_or("");
    let format_val = init["format"].as_str().unwrap_or("");
    let project_snapshot_str =
        serde_json::to_string_pretty(&params["projectSnapshot"]).unwrap_or_default();

    let system = CHECKPOINT_TEMPLATE.to_string();

    let user = format!(
        "## 项目信息\n\
         - 项目名: {}\n\
         - 格式: {}\n\
         - 时长: {}\n\
         - 概念: {}\n\n\
         ## 前置步骤产出 (请据此生成检查点)\n\n\
         {}\n\n\
         请按 system 中的模板产出检查点。字段完整，简洁精准，800-1200 字。",
        name, format_val, duration, concept, project_snapshot_str
    );

    (system, user)
}

// ── Seedance prompt builders ──

fn build_seedance_phase_ad_prompt(params: &Value) -> (String, String) {
    let system = CTX_SEEDANCE_PHASE_AD.to_string();
    let script_body = params["scriptBody"].as_str().unwrap_or("");
    let duration = params["duration"].as_str().unwrap_or("");
    let assets_json = params["assetsJson"].as_str().unwrap_or("{}");

    let user = format!(
        "## 剧本正文\n\n{}\n\n## 时长\n{}\n\n## 资产清单\n\n{}",
        script_body, duration, assets_json
    );

    (system, user)
}

fn build_seedance_unit_efg_prompt(params: &Value) -> (String, String) {
    let system = CTX_SEEDANCE_UNIT_EFG.to_string();

    let unit = serde_json::to_string_pretty(&params["unit"]).unwrap_or_default();
    let script_fragment = params["scriptFragment"].as_str().unwrap_or("");
    let analysis_context =
        serde_json::to_string_pretty(&params["analysisContext"]).unwrap_or_default();
    let assets_json = params["assetsJson"].as_str().unwrap_or("{}");
    let unit_index = params["unitIndex"].as_i64().unwrap_or(0);
    let planned_entry_state = params["plannedEntryState"].as_str().unwrap_or("");
    let previous_plan_exit = params["previousPlanExit"].as_str().unwrap_or("");

    let user = format!(
        "## 单元信息\n\n{}\n\n## 剧本片段\n\n{}\n\n## 分析上下文\n\n{}\n\n## 资产清单\n\n{}\n\n## 单元序号\n{}\n\n## 起幅锚点\n{}\n\n## 上一单元落幅\n{}",
        unit, script_fragment, analysis_context, assets_json, unit_index, planned_entry_state, previous_plan_exit
    );

    (system, user)
}

fn build_visual_smart_asset_prompt(params: &Value) -> (String, String) {
    let system = r#"You are ScriptStack's Visual Standard-Part Compiler.

Your job is to convert a Chinese creative asset into a high-density, model-facing English AIPROMPT.

Hard rules:
1. Output JSON only, no markdown fences, no commentary.
2. promptTextEn must be 100% English. Do not include any Chinese characters.
3. Do not summarize or simplify. Preserve the Chinese source asset's era, materials, craft, lighting, composition, color rules, negative constraints, camera/engine/style specs, and visual anchors.
4. This is not literal translation. Rewrite as professional cinematic image/video prompt English while keeping every important visual detail.
5. reviewTextZh must be generated by back-translating the final English prompt, so the user can judge what the model will actually receive.
6. Select the best local template candidates if they help. Return their IDs in selectedTemplateIds.
7. Scene prompts marked as empty establishing shots must not introduce people, silhouettes, shadows, or humanoid figures.
8. Prop prompts must not introduce hands or people unless the source explicitly requires usage context.
9. Strictly output the generated English AIPROMPT in the "promptTextEn" field as specified in the schema. Do not output it under "promptText" or any other key name, even if the candidate templates use "promptText".

Required JSON schema:
{
  "selectedTemplateIds": ["template-id"],
  "promptTextEn": "pure English AIPROMPT",
  "reviewTextZh": "structured Chinese review mirror translated from promptTextEn",
  "quality": {
    "containsChinese": false,
    "hasUnfilledPlaceholders": false,
    "preservedVisualAnchors": true,
    "preservedNegativeConstraints": true,
    "assetTypeCompatible": true,
    "notes": []
  }
}"#
        .to_string();

    let user = format!(
        "## Generation Mode\n{}\n\n## Asset Type\n{}\n\n## Chinese Source Asset Snapshot\n{}\n\n## Candidate English Templates\n{}\n\nReturn the JSON object only.",
        params["mode"].as_str().unwrap_or("image"),
        params["assetType"].as_str().unwrap_or("asset"),
        serde_json::to_string_pretty(&params["asset"]).unwrap_or_default(),
        serde_json::to_string_pretty(&params["candidateTemplates"]).unwrap_or_default()
    );

    (system, user)
}
