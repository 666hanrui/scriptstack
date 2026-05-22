use rusqlite::{params, Connection};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::db::crud;
use crate::llm::{config::RuntimeConfig, server_proxy};

fn now() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

fn uuid() -> String {
    Uuid::new_v4().to_string()
}

fn truncate_chars(input: &str, max: usize) -> String {
    input.chars().take(max).collect()
}

fn char_count(input: &str) -> usize {
    input.chars().count()
}

fn slice_chars(input: &str, start: usize, end: usize) -> String {
    input
        .chars()
        .skip(start)
        .take(end.saturating_sub(start))
        .collect()
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

fn path_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("导入材料")
        .to_string()
}

fn guess_mime(path: &Path) -> String {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase().as_str() {
        "txt" => "text/plain",
        "md" | "markdown" => "text/markdown",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn decode_text_bytes(bytes: &[u8]) -> (String, String) {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return (s.to_string(), "utf-8".into());
    }

    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let enc = detector.guess(None, true);
    let (cow, _, had_errors) = enc.decode(bytes);
    if !had_errors {
        return (cow.into_owned(), enc.name().to_lowercase());
    }

    let (cow, _, _) = encoding_rs::GBK.decode(bytes);
    (cow.into_owned(), "gbk-fallback".into())
}

fn extract_docx_text(bytes: &[u8]) -> Result<String, String> {
    let reader = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("DOCX 解压失败: {}", e))?;
    let mut document = archive
        .by_name("word/document.xml")
        .map_err(|_| "DOCX 中缺少 word/document.xml".to_string())?;
    let mut xml = String::new();
    document
        .read_to_string(&mut xml)
        .map_err(|e| format!("DOCX XML 读取失败: {}", e))?;

    let mut reader = quick_xml::Reader::from_str(&xml);
    reader.config_mut().trim_text(false);
    let mut buf = Vec::new();
    let mut out = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Text(e)) => {
                let raw = String::from_utf8_lossy(e.as_ref());
                let text = quick_xml::escape::unescape(&raw)
                    .map(|s| s.into_owned())
                    .unwrap_or_else(|_| raw.to_string());
                out.push_str(&text);
            }
            Ok(quick_xml::events::Event::End(e)) => {
                let name = e.name();
                let name = name.as_ref();
                if name.ends_with(b"p") || name.ends_with(b"tr") {
                    out.push('\n');
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(e) => return Err(format!("DOCX XML 解析失败: {}", e)),
            _ => {}
        }
        buf.clear();
    }

    Ok(normalize_text(&out))
}

fn extract_pdf_text(path: &Path) -> Result<String, String> {
    let text = pdf_extract::extract_text(path).map_err(|e| format!("PDF 文字层提取失败: {}", e))?;
    let text = normalize_text(&text);
    if text.trim().chars().count() < 20 {
        return Err("PDF 没有可用文字层，可能是扫描版；本期暂不支持 OCR。".into());
    }
    Ok(text)
}

pub fn parse_source_file(path: &Path) -> Result<Value, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("读取文件失败: {}", e))?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let (content, encoding) = match ext.as_str() {
        "docx" => (extract_docx_text(&bytes)?, "docx-xml".into()),
        "pdf" => (extract_pdf_text(path)?, "pdf-text-layer".into()),
        _ => {
            let (text, enc) = decode_text_bytes(&bytes);
            (normalize_text(&text), enc)
        }
    };
    let material_type = detect_material_type(&content);
    Ok(json!({
        "filePath": path.to_string_lossy(),
        "fileName": path_file_name(path),
        "fileHash": sha256_hex(&bytes),
        "fileSize": bytes.len(),
        "mimeType": guess_mime(path),
        "encoding": encoding,
        "content": content,
        "materialType": material_type,
    }))
}

pub fn normalize_text(input: &str) -> String {
    input
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .lines()
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\n")
        .replace("\n\n\n", "\n\n")
        .trim()
        .to_string()
}

pub fn detect_material_type(text: &str) -> String {
    let sample = text.chars().take(4000).collect::<String>();
    let scene_re = regex_lite::Regex::new(r"(【\s*(场景|场)\s*[一二三四五六七八九十百零〇\d]+|^\s*(场景|场)\s*[一二三四五六七八九十百零〇\d]+[：:])").unwrap();
    let chapter_re = regex_lite::Regex::new(r"(?m)^\s*第[一二三四五六七八九十百千万零〇\d]+[章节回卷]").unwrap();
    let dialogue_re = regex_lite::Regex::new(r"(?m)^\s*.{1,12}\s*[：:]").unwrap();
    if scene_re.is_match(&sample) {
        "script".into()
    } else if sample.contains("人物设定") || sample.contains("角色设定") || sample.contains("人物小传") {
        "character_bible".into()
    } else if chapter_re.find_iter(text).count() >= 2 || char_count(text) > 8000 {
        "novel".into()
    } else if dialogue_re.find_iter(&sample).count() >= 8 {
        "script".into()
    } else if sample.contains("大纲") || sample.contains("梗概") || sample.contains("故事线") {
        "outline".into()
    } else {
        "mixed".into()
    }
}

pub fn ensure_series_project(
    conn: &Connection,
    project_id: Option<&str>,
    name: &str,
) -> Result<String, String> {
    if let Some(id) = project_id.filter(|s| !s.trim().is_empty()) {
        let exists = conn
            .query_row("SELECT 1 FROM projects WHERE id = ?1", params![id], |_| Ok(()))
            .is_ok();
        if exists {
            return Ok(id.to_string());
        }
    }

    let id = uuid();
    let t = now();
    conn.execute(
        "INSERT INTO projects (id, parent_id, name, module_type, status, metadata_json, created_at, updated_at)
         VALUES (?1, NULL, ?2, 'series', 'active', ?3, ?4, ?5)",
        params![
            id,
            if name.trim().is_empty() { "未命名长篇项目" } else { name.trim() },
            json!({"kind": "series_root"}).to_string(),
            t,
            t
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn create_series_project(conn: &Connection, payload: &Value) -> Result<Value, String> {
    let name = payload["name"].as_str().unwrap_or("未命名长篇项目");
    let project_id = ensure_series_project(conn, None, name)?;
    Ok(json!({ "projectId": project_id, "name": name }))
}

fn is_placeholder_key(key: &str) -> bool {
    let trimmed = key.trim();
    trimmed.is_empty()
        || trimmed.eq_ignore_ascii_case("sk-your-key-here")
        || trimmed.contains("your-key")
        || trimmed.contains("change-me")
}

fn runtime_config(
    conn: &Connection,
    config: &crate::config::ServerConfig,
) -> RuntimeConfig {
    let mut runtime = config.to_runtime_config();
    let settings = crud::get_app_settings(conn);
    if !settings.text_endpoint.trim().is_empty() {
        runtime.api_base_url = settings.text_endpoint;
    }
    if !settings.text_key.trim().is_empty() {
        runtime.api_key = settings.text_key;
    }
    if !settings.text_model.trim().is_empty() {
        runtime.default_model = settings.text_model;
    }
    if !settings.text_mode.trim().is_empty() {
        runtime.text_mode = settings.text_mode;
    }
    runtime.review_threshold = settings.review_threshold.clamp(0, 100) as u8;
    runtime.enable_local_save = settings.enable_local_save;
    if is_placeholder_key(&runtime.api_key) {
        runtime.api_key.clear();
    }
    runtime
}

fn extract_json_object(text: &str) -> Option<Value> {
    let trimmed = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    serde_json::from_str::<Value>(trimmed).ok().or_else(|| {
        let start = trimmed.find('{')?;
        let end = trimmed.rfind('}')?;
        if end <= start {
            return None;
        }
        serde_json::from_str::<Value>(&trimmed[start..=end]).ok()
    })
}

fn value_lines(value: &Value) -> String {
    if let Some(items) = value.as_array() {
        return items
            .iter()
            .filter_map(|item| item.as_str().map(|s| format!("- {}", s)).or_else(|| Some(format!("- {}", item))))
            .collect::<Vec<_>>()
            .join("\n");
    }
    value.as_str().unwrap_or("").to_string()
}

fn story_bible_markdown(plan: &Value) -> String {
    let bible = &plan["storyBible"];
    let season = &plan["seasonOutline"];
    let mut out = String::new();
    out.push_str(&format!("# {}\n\n", plan["seriesTitle"].as_str().unwrap_or("未命名长故事")));
    out.push_str(&format!("## 核心概念\n{}\n\n", plan["corePremise"].as_str().unwrap_or("")));
    out.push_str(&format!("## Logline\n{}\n\n", plan["logline"].as_str().unwrap_or("")));
    out.push_str(&format!("## 类型承诺\n{}\n\n", value_lines(&plan["genrePromise"])));
    out.push_str("## 故事圣经\n\n");
    out.push_str(&format!("- 主题：{}\n", bible["theme"].as_str().unwrap_or("")));
    out.push_str(&format!("- 世界观：{}\n", bible["world"].as_str().unwrap_or("")));
    out.push_str(&format!("- 叙事气质：{}\n", bible["tone"].as_str().unwrap_or("")));
    out.push_str(&format!("- 视觉基调：{}\n", bible["visualTone"].as_str().unwrap_or("")));
    out.push_str(&format!("- 核心冲突：{}\n", bible["coreConflict"].as_str().unwrap_or("")));
    out.push_str(&format!("- 长线主线：{}\n\n", bible["longArc"].as_str().unwrap_or("")));
    out.push_str("### 角色关系\n");
    if let Some(chars) = bible["characterWeb"].as_array() {
        for item in chars {
            out.push_str(&format!(
                "- {}：{}；欲望：{}；恐惧：{}；秘密：{}；弧线：{}\n",
                item["name"].as_str().unwrap_or("未命名角色"),
                item["role"].as_str().unwrap_or(""),
                item["desire"].as_str().unwrap_or(""),
                item["fear"].as_str().unwrap_or(""),
                item["secret"].as_str().unwrap_or(""),
                item["arc"].as_str().unwrap_or("")
            ));
        }
    }
    out.push_str("\n### 场景种子\n");
    out.push_str(&value_lines(&bible["sceneSeeds"]));
    out.push_str("\n\n### 道具种子\n");
    out.push_str(&value_lines(&bible["propSeeds"]));
    out.push_str("\n\n### 规则与限制\n");
    out.push_str(&value_lines(&bible["rulesAndConstraints"]));
    out.push_str("\n\n## 长线结构\n");
    out.push_str(&format!(
        "- 总集数/章节数：{}\n- 结构：{}\n\n",
        season["totalEpisodes"].as_u64().unwrap_or(0),
        season["structure"].as_str().unwrap_or("")
    ));
    if let Some(acts) = season["acts"].as_array() {
        for act in acts {
            out.push_str(&format!(
                "- {}（{}）：{}\n",
                act["name"].as_str().unwrap_or("阶段"),
                act["episodeRange"].as_str().unwrap_or(""),
                act["function"].as_str().unwrap_or("")
            ));
        }
    }
    out.push_str("\n## 分集 / 分章大纲\n");
    if let Some(episodes) = plan["episodeOutlines"].as_array() {
        for episode in episodes {
            out.push_str(&format!(
                "\n### {}. {}\n{}\n\n- 开场：{}\n- 冲突：{}\n- 变化：{}\n- 承接：{}\n- 结尾：{}\n",
                episode["episodeIndex"].as_u64().unwrap_or(0),
                episode["title"].as_str().unwrap_or("未命名"),
                episode["logline"].as_str().unwrap_or(""),
                episode["openingHook"].as_str().unwrap_or(""),
                episode["mainConflict"].as_str().unwrap_or(""),
                episode["characterShift"].as_str().unwrap_or(""),
                episode["continuityNotes"].as_str().unwrap_or(""),
                episode["endingHook"].as_str().unwrap_or("")
            ));
            out.push_str("\n节拍：\n");
            out.push_str(&value_lines(&episode["keyBeats"]));
            out.push('\n');
        }
    }
    out
}

fn insert_source_material_text(
    conn: &Connection,
    project_id: &str,
    name: &str,
    material_type: &str,
    content: &str,
    metadata: Value,
) -> Result<String, String> {
    let id = uuid();
    let t = now();
    conn.execute(
        "INSERT INTO source_materials (id, project_id, name, material_type, file_path, file_name, file_hash, mime_type, encoding, content_text, metadata_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, 'text/plain', 'generated', ?7, ?8, ?9, ?10)",
        params![
            id,
            project_id,
            name,
            material_type,
            format!("{}.md", name),
            sha256_hex(content.as_bytes()),
            content,
            metadata.to_string(),
            t,
            t,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

fn upsert_planned_episode(
    conn: &Connection,
    series_project_id: &str,
    episode: &Value,
) -> Result<String, String> {
    let episode_id = uuid();
    let t = now();
    let idx = episode["episodeIndex"].as_i64().unwrap_or_else(|| next_episode_index(conn, series_project_id));
    let title = episode["title"].as_str().unwrap_or("未命名单元");
    let summary = episode["logline"]
        .as_str()
        .or_else(|| episode["sourceForWorkflow"].as_str())
        .unwrap_or("");
    conn.execute(
        "INSERT OR REPLACE INTO episodes (id, series_project_id, episode_project_id, script_task_id, episode_index, title, status, source_summary, created_at, updated_at)
         VALUES (
            COALESCE((SELECT id FROM episodes WHERE series_project_id = ?1 AND episode_index = ?2), ?3),
            ?1, NULL, NULL, ?2, ?4, 'planned', ?5,
            COALESCE((SELECT created_at FROM episodes WHERE series_project_id = ?1 AND episode_index = ?2), ?6),
            ?6
         )",
        params![series_project_id, idx, episode_id, title, summary, t],
    )
    .map_err(|e| e.to_string())?;
    Ok(episode_id)
}

pub fn incubate_idea(
    conn: &Connection,
    config: &crate::config::ServerConfig,
    payload: &Value,
) -> Result<Value, String> {
    let idea = payload["idea"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "缺少故事想法".to_string())?;
    let episode_count = payload["episodeCount"]
        .as_u64()
        .or_else(|| payload["episode_count"].as_u64())
        .unwrap_or(12)
        .clamp(1, 120);
    let format = payload["format"].as_str().unwrap_or("short_drama");
    let title_hint = payload["name"]
        .as_str()
        .or_else(|| payload["title"].as_str())
        .unwrap_or_else(|| {
            let end = idea.char_indices().nth(24).map(|(idx, _)| idx).unwrap_or(idea.len());
            &idea[..end]
        });

    let runtime = runtime_config(conn, config);
    let mut raw_text = String::new();
    let params = server_proxy::ContextualLlmParams {
        runtime_config: runtime,
        context_type: "longform_idea_incubator".into(),
        context_params: json!({
            "idea": idea,
            "format": format,
            "episodeCount": episode_count,
            "episodeDuration": payload["episodeDuration"].as_str().or_else(|| payload["duration"].as_str()).unwrap_or("2分钟"),
            "genres": payload["genres"].as_str().unwrap_or(""),
            "audience": payload["audience"].as_str().unwrap_or("短视频观众"),
            "tone": payload["tone"].as_str().unwrap_or("强冲突、强钩子、强情绪"),
            "notes": payload["notes"].as_str().unwrap_or(""),
        }),
        temperature: Some(0.72),
        max_tokens_override: Some(8192),
    };
    let full_text = tokio::runtime::Handle::current()
        .block_on(server_proxy::request_contextual_llm_stream(params, |chunk| {
            raw_text.push_str(chunk);
        }))
        .map_err(|e| format!("长故事孵化失败：{}", e))?;
    if raw_text.trim().is_empty() {
        raw_text = full_text;
    }

    let mut plan = extract_json_object(&raw_text).ok_or_else(|| {
        format!(
            "长故事孵化结果不是合法 JSON，请重试。模型原文前 300 字：{}",
            truncate_chars(&raw_text, 300)
        )
    })?;
    if plan["seriesTitle"].as_str().unwrap_or("").trim().is_empty() {
        plan["seriesTitle"] = json!(title_hint);
    }
    if plan["format"].as_str().unwrap_or("").trim().is_empty() {
        plan["format"] = json!(format);
    }
    if !plan["episodeOutlines"].is_array() {
        plan["episodeOutlines"] = json!([]);
    }

    let series_title = plan["seriesTitle"].as_str().unwrap_or(title_hint);
    let series_project_id = ensure_series_project(conn, None, series_title)?;
    let idea_material_id = insert_source_material_text(
        conn,
        &series_project_id,
        "创意原点",
        "idea",
        idea,
        json!({"source": "longform_incubator", "format": format}),
    )?;
    let bible_md = story_bible_markdown(&plan);
    let bible_material_id = insert_source_material_text(
        conn,
        &series_project_id,
        "故事圣经与分集大纲",
        "story_bible",
        &bible_md,
        json!({"source": "longform_incubator", "rawPlan": plan.clone()}),
    )?;

    let mut planned_episode_ids = Vec::new();
    if let Some(episodes) = plan["episodeOutlines"].as_array() {
        for episode in episodes {
            if let Ok(id) = upsert_planned_episode(conn, &series_project_id, episode) {
                planned_episode_ids.push(id);
            }
        }
    }

    Ok(json!({
        "seriesProjectId": series_project_id,
        "projectId": series_project_id,
        "ideaMaterialId": idea_material_id,
        "storyBibleMaterialId": bible_material_id,
        "plannedEpisodeIds": planned_episode_ids,
        "plan": plan,
        "storyBibleMarkdown": bible_md,
    }))
}

pub fn import_source_file(conn: &Connection, payload: &Value) -> Result<Value, String> {
    let file_path = payload["filePath"]
        .as_str()
        .or_else(|| payload["file_path"].as_str())
        .unwrap_or("");
    let parsed = if !file_path.trim().is_empty() {
        parse_source_file(Path::new(file_path))?
    } else {
        let content = payload["content"]
            .as_str()
            .or_else(|| payload["text"].as_str())
            .unwrap_or("");
        if content.trim().is_empty() {
            return Err("缺少 filePath 或 content".into());
        }
        let text = normalize_text(content);
        let bytes = text.as_bytes();
        json!({
            "filePath": Value::Null,
            "fileName": payload["fileName"].as_str().unwrap_or("粘贴文本"),
            "fileHash": sha256_hex(bytes),
            "fileSize": bytes.len(),
            "mimeType": "text/plain",
            "encoding": "inline-text",
            "content": text,
            "materialType": detect_material_type(content),
        })
    };

    let content = parsed["content"].as_str().unwrap_or("").to_string();
    let fallback_name = parsed["fileName"].as_str().unwrap_or("导入材料");
    let project_name = payload["projectName"]
        .as_str()
        .or_else(|| payload["project_name"].as_str())
        .unwrap_or(fallback_name);
    let project_id = ensure_series_project(
        conn,
        payload["projectId"].as_str().or_else(|| payload["project_id"].as_str()),
        project_name,
    )?;
    let material_type = payload["materialType"]
        .as_str()
        .or_else(|| payload["material_type"].as_str())
        .unwrap_or_else(|| parsed["materialType"].as_str().unwrap_or("mixed"));
    let id = uuid();
    let t = now();
    let name = payload["name"].as_str().unwrap_or(fallback_name);
    conn.execute(
        "INSERT INTO source_materials (id, project_id, name, material_type, file_path, file_name, file_hash, mime_type, encoding, content_text, metadata_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            id,
            project_id,
            name,
            material_type,
            parsed["filePath"].as_str(),
            parsed["fileName"].as_str(),
            parsed["fileHash"].as_str(),
            parsed["mimeType"].as_str(),
            parsed["encoding"].as_str(),
            content,
            json!({
                "fileSize": parsed["fileSize"],
                "detectedMaterialType": parsed["materialType"],
            }).to_string(),
            t,
            t,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(json!({
        "projectId": project_id,
        "sourceMaterialId": id,
        "name": name,
        "materialType": material_type,
        "charCount": char_count(&content),
        "fileName": parsed["fileName"],
        "filePath": parsed["filePath"],
        "encoding": parsed["encoding"],
    }))
}

pub fn list_source_materials(conn: &Connection, payload: &Value) -> Result<Vec<Value>, String> {
    let project_id = payload["projectId"].as_str().or_else(|| payload["project_id"].as_str()).unwrap_or("");
    let mut sql = "SELECT id, project_id, name, material_type, file_path, file_name, file_hash, mime_type, encoding, length(content_text), created_at, updated_at FROM source_materials".to_string();
    if !project_id.is_empty() {
        sql.push_str(" WHERE project_id = ?1");
    }
    sql.push_str(" ORDER BY updated_at DESC");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let map_row = |row: &rusqlite::Row<'_>| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "projectId": row.get::<_, String>(1)?,
            "name": row.get::<_, String>(2)?,
            "materialType": row.get::<_, String>(3)?,
            "filePath": row.get::<_, Option<String>>(4)?,
            "fileName": row.get::<_, Option<String>>(5)?,
            "fileHash": row.get::<_, Option<String>>(6)?,
            "mimeType": row.get::<_, Option<String>>(7)?,
            "encoding": row.get::<_, Option<String>>(8)?,
            "charCount": row.get::<_, i64>(9)?,
            "createdAt": row.get::<_, String>(10)?,
            "updatedAt": row.get::<_, String>(11)?,
        }))
    };
    let rows = if project_id.is_empty() {
        stmt.query_map([], map_row)
    } else {
        stmt.query_map(params![project_id], map_row)
    }
    .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn material_content(conn: &Connection, source_material_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT content_text FROM source_materials WHERE id = ?1",
        params![source_material_id],
        |row| row.get::<_, String>(0),
    )
    .map_err(|_| "找不到 Source Material".to_string())
}

fn line_start_char_offsets(text: &str) -> Vec<(usize, String)> {
    let mut out = Vec::new();
    let mut char_pos = 0usize;
    for line in text.lines() {
        out.push((char_pos, line.to_string()));
        char_pos += line.chars().count() + 1;
    }
    out
}

pub fn rough_segments(text: &str, target_chars: usize) -> Vec<Value> {
    let total = char_count(text);
    if total == 0 {
        return vec![];
    }

    let chapter_re = regex_lite::Regex::new(r"^\s*(第[一二三四五六七八九十百千万零〇\d]+[章节回卷][^\n]*|Chapter\s+\d+[^\n]*)").unwrap();
    let mut boundaries: Vec<(usize, String)> = line_start_char_offsets(text)
        .into_iter()
        .filter(|(_, line)| chapter_re.is_match(line))
        .collect();

    if boundaries.len() < 2 {
        boundaries.clear();
        boundaries.push((0, "片段 1".into()));
        let paragraphs = text.split("\n\n").collect::<Vec<_>>();
        let mut cursor = 0usize;
        let mut next_cut = target_chars.max(1200);
        for para in paragraphs {
            let len = char_count(para) + 2;
            if cursor >= next_cut {
                boundaries.push((cursor, format!("片段 {}", boundaries.len() + 1)));
                next_cut = cursor + target_chars.max(1200);
            }
            cursor += len;
        }
    }

    if boundaries.first().map(|(pos, _)| *pos).unwrap_or(0) != 0 {
        boundaries.insert(0, (0, "开篇".into()));
    }
    boundaries.sort_by_key(|(pos, _)| *pos);
    boundaries.dedup_by_key(|(pos, _)| *pos);

    boundaries
        .iter()
        .enumerate()
        .filter_map(|(index, (start, title))| {
            let end = boundaries.get(index + 1).map(|(pos, _)| *pos).unwrap_or(total);
            if end <= *start {
                return None;
            }
            let body = slice_chars(text, *start, end).trim().to_string();
            if body.is_empty() {
                return None;
            }
            Some(json!({
                "chunkIndex": index + 1,
                "title": title.trim(),
                "startChar": start,
                "endChar": end,
                "charCount": char_count(&body),
                "preview": truncate_chars(&body.replace('\n', " "), 160),
                "content": body,
            }))
        })
        .collect()
}

pub fn segment_source_material(conn: &Connection, payload: &Value) -> Result<Value, String> {
    let source_id = payload["sourceMaterialId"]
        .as_str()
        .or_else(|| payload["source_material_id"].as_str())
        .ok_or_else(|| "缺少 sourceMaterialId".to_string())?;
    let target = payload["targetChars"]
        .as_u64()
        .or_else(|| payload["target_chars"].as_u64())
        .unwrap_or(4000) as usize;
    let content = material_content(conn, source_id)?;
    let segments = rough_segments(&content, target);
    Ok(json!({
        "sourceMaterialId": source_id,
        "targetChars": target,
        "segments": segments,
    }))
}

pub fn confirm_source_chunks(conn: &Connection, payload: &Value) -> Result<Value, String> {
    let source_id = payload["sourceMaterialId"]
        .as_str()
        .or_else(|| payload["source_material_id"].as_str())
        .ok_or_else(|| "缺少 sourceMaterialId".to_string())?;
    let content = material_content(conn, source_id)?;
    let chunks = payload["chunks"]
        .as_array()
        .ok_or_else(|| "缺少 chunks 数组".to_string())?;
    let t = now();
    conn.execute("DELETE FROM source_chunks WHERE source_material_id = ?1", params![source_id])
        .map_err(|e| e.to_string())?;
    let mut saved = Vec::new();
    for (i, chunk) in chunks.iter().enumerate() {
        let idx = chunk["chunkIndex"].as_i64().unwrap_or((i + 1) as i64);
        let start = chunk["startChar"].as_i64().unwrap_or(0).max(0) as usize;
        let end = chunk["endChar"]
            .as_i64()
            .unwrap_or(char_count(&content) as i64)
            .max(start as i64) as usize;
        let body = chunk["content"]
            .as_str()
            .map(|s| s.to_string())
            .unwrap_or_else(|| slice_chars(&content, start, end));
        let title = chunk["title"]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| format!("片段 {}", idx));
        let id = uuid();
        conn.execute(
            "INSERT INTO source_chunks (id, source_material_id, chunk_index, title, start_char, end_char, content_text, status, metadata_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'confirmed', ?8, ?9, ?10)",
            params![id, source_id, idx, title, start as i64, end as i64, body, json!({}).to_string(), t, t],
        )
        .map_err(|e| e.to_string())?;
        saved.push(json!({"id": id, "chunkIndex": idx, "title": title, "charCount": char_count(&body)}));
    }
    Ok(json!({ "sourceMaterialId": source_id, "chunks": saved }))
}

pub fn list_source_chunks(conn: &Connection, payload: &Value) -> Result<Vec<Value>, String> {
    let source_id = payload["sourceMaterialId"].as_str().or_else(|| payload["source_material_id"].as_str()).unwrap_or("");
    if source_id.is_empty() {
        return Ok(vec![]);
    }
    let mut stmt = conn.prepare(
        "SELECT id, source_material_id, chunk_index, title, start_char, end_char, content_text, status, created_at, updated_at
         FROM source_chunks WHERE source_material_id = ?1 ORDER BY chunk_index",
    ).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![source_id], |row| {
            let body: String = row.get(6)?;
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "sourceMaterialId": row.get::<_, String>(1)?,
                "chunkIndex": row.get::<_, i64>(2)?,
                "title": row.get::<_, String>(3)?,
                "startChar": row.get::<_, i64>(4)?,
                "endChar": row.get::<_, i64>(5)?,
                "content": body,
                "charCount": char_count(&body),
                "preview": truncate_chars(&body.replace('\n', " "), 160),
                "status": row.get::<_, String>(7)?,
                "createdAt": row.get::<_, String>(8)?,
                "updatedAt": row.get::<_, String>(9)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn next_episode_index(conn: &Connection, series_project_id: &str) -> i64 {
    conn.query_row(
        "SELECT COALESCE(MAX(episode_index), 0) + 1 FROM episodes WHERE series_project_id = ?1",
        params![series_project_id],
        |row| row.get::<_, i64>(0),
    )
    .unwrap_or(1)
}

pub fn create_episode_from_sources(conn: &Connection, payload: &Value) -> Result<Value, String> {
    let series_id = ensure_series_project(
        conn,
        payload["seriesProjectId"]
            .as_str()
            .or_else(|| payload["series_project_id"].as_str())
            .or_else(|| payload["projectId"].as_str()),
        payload["seriesName"].as_str().unwrap_or("未命名长篇项目"),
    )?;
    let chunk_ids = payload["sourceChunkIds"]
        .as_array()
        .or_else(|| payload["source_chunk_ids"].as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect::<Vec<_>>();
    let idx = payload["episodeIndex"]
        .as_i64()
        .or_else(|| payload["episode_index"].as_i64())
        .unwrap_or_else(|| next_episode_index(conn, &series_id));
    let title = payload["title"]
        .as_str()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("第 {} 集", idx));
    let duration = payload["duration"].as_str().unwrap_or("2分钟");
    let t = now();
    let episode_project_id = uuid();
    let episode_id = uuid();
    let task_id = uuid();

    let mut source_blocks = Vec::new();
    for chunk_id in &chunk_ids {
        if let Ok((chunk_title, body)) = conn.query_row(
            "SELECT title, content_text FROM source_chunks WHERE id = ?1",
            params![chunk_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        ) {
            source_blocks.push(format!("【{}】\n{}", chunk_title, body));
        }
    }
    let combined = if source_blocks.is_empty() {
        payload["sourceText"].as_str().unwrap_or("").to_string()
    } else {
        source_blocks.join("\n\n")
    };
    let summary = truncate_chars(&combined.replace('\n', " "), 200);

    conn.execute(
        "INSERT INTO projects (id, parent_id, name, module_type, status, metadata_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'script', 'active', ?4, ?5, ?6)",
        params![
            episode_project_id,
            series_id,
            title,
            json!({"kind": "episode", "episodeIndex": idx}).to_string(),
            t,
            t
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO script_tasks (id, project_id, mode, input_summary, genre, style, duration, stage, created_at, updated_at)
         VALUES (?1, ?2, 'plot', ?3, '', '', ?4, 'ready', ?5, ?6)",
        params![task_id, episode_project_id, summary, duration, t, t],
    )
    .map_err(|e| e.to_string())?;
    if !combined.trim().is_empty() {
        let raw = json!({"source": "episode_source_chunks", "chunkIds": chunk_ids});
        conn.execute(
            "INSERT INTO script_outputs (id, task_id, characters_json, plot_outline, script_body, raw_response, created_at)
             VALUES (?1, ?2, '[]', ?3, ?4, ?5, ?6)",
            params![uuid(), task_id, combined, combined, raw.to_string(), t],
        )
        .map_err(|e| e.to_string())?;
    }
    conn.execute(
        "INSERT INTO episodes (id, series_project_id, episode_project_id, script_task_id, episode_index, title, status, source_summary, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'draft', ?7, ?8, ?9)",
        params![episode_id, series_id, episode_project_id, task_id, idx, title, summary, t, t],
    )
    .map_err(|e| e.to_string())?;
    for (order, chunk_id) in chunk_ids.iter().enumerate() {
        conn.execute(
            "INSERT OR IGNORE INTO episode_source_links (id, episode_id, source_chunk_id, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![uuid(), episode_id, chunk_id, order as i64, t],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(json!({
        "seriesProjectId": series_id,
        "episodeId": episode_id,
        "episodeProjectId": episode_project_id,
        "scriptTaskId": task_id,
        "taskId": task_id,
        "projectId": episode_project_id,
        "episodeIndex": idx,
        "title": title,
        "sourceCharCount": char_count(&combined),
    }))
}

pub fn list_series_episodes(conn: &Connection, payload: &Value) -> Result<Vec<Value>, String> {
    let series_id = payload["seriesProjectId"].as_str().or_else(|| payload["series_project_id"].as_str()).unwrap_or("");
    if series_id.is_empty() {
        return Ok(vec![]);
    }
    let mut stmt = conn.prepare(
        "SELECT id, series_project_id, episode_project_id, script_task_id, episode_index, title, status, source_summary, created_at, updated_at
         FROM episodes WHERE series_project_id = ?1 ORDER BY episode_index",
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![series_id], |row| {
        Ok(json!({
            "id": row.get::<_, String>(0)?,
            "seriesProjectId": row.get::<_, String>(1)?,
            "episodeProjectId": row.get::<_, Option<String>>(2)?,
            "scriptTaskId": row.get::<_, Option<String>>(3)?,
            "episodeIndex": row.get::<_, i64>(4)?,
            "title": row.get::<_, String>(5)?,
            "status": row.get::<_, String>(6)?,
            "sourceSummary": row.get::<_, Option<String>>(7)?,
            "createdAt": row.get::<_, String>(8)?,
            "updatedAt": row.get::<_, String>(9)?,
        }))
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn load_script_body(conn: &Connection, task_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT script_body FROM script_outputs WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1",
        params![task_id],
        |row| row.get::<_, String>(0),
    )
    .map_err(|_| "当前 Episode 还没有剧本正文".to_string())
}

pub fn generate_episode_snapshot(conn: &Connection, payload: &Value) -> Result<Value, String> {
    let task_id = payload["taskId"]
        .as_str()
        .or_else(|| payload["task_id"].as_str())
        .or_else(|| payload["scriptTaskId"].as_str())
        .or_else(|| payload["script_task_id"].as_str())
        .ok_or_else(|| "缺少 taskId".to_string())?;
    let episode_id = payload["episodeId"].as_str().or_else(|| payload["episode_id"].as_str()).map(|s| s.to_string()).or_else(|| {
        conn.query_row("SELECT id FROM episodes WHERE script_task_id = ?1", params![task_id], |row| row.get::<_, String>(0)).ok()
    });
    let body = load_script_body(conn, task_id)?;
    let lines = body.lines().filter(|l| !l.trim().is_empty()).collect::<Vec<_>>();
    let ending = lines.iter().rev().take(5).rev().cloned().collect::<Vec<_>>().join("\n");
    let mut asset_names = Vec::new();
    if let Ok(mut stmt) = conn.prepare("SELECT asset_data_json FROM asset_records WHERE task_id = ?1 AND asset_type IN ('character','prop','scene')") {
        if let Ok(rows) = stmt.query_map(params![task_id], |row| row.get::<_, String>(0)) {
            for raw in rows.flatten() {
                if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                    if let Some(name) = v["name"].as_str() {
                        asset_names.push(name.to_string());
                    }
                }
            }
        }
    }
    let snapshot = json!({
        "episodeMetadata": {
            "episodeId": episode_id,
            "scriptTaskId": task_id,
            "completedAt": now(),
            "bodyCharCount": char_count(&body),
        },
        "charactersMemory": {},
        "propsTracking": {},
        "knownAssets": asset_names,
        "activePlotThreads": [
            "下一集必须承接上一集结尾状态，不重置人物关系、伤势、道具归属和未解决冲突。"
        ],
        "endingExitState": ending,
        "source": "local_snapshot_v1"
    });
    let id = uuid();
    let t = now();
    conn.execute(
        "INSERT INTO story_state_snapshots (id, episode_id, script_task_id, snapshot_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, episode_id, task_id, snapshot.to_string(), t],
    )
    .map_err(|e| e.to_string())?;
    Ok(json!({"id": id, "snapshot": snapshot, "createdAt": t}))
}

pub fn generate_next_episode_options(conn: &Connection, payload: &Value) -> Result<Value, String> {
    let task_id = payload["taskId"].as_str().or_else(|| payload["task_id"].as_str()).unwrap_or("");
    let snapshot_json = if !task_id.is_empty() {
        conn.query_row(
            "SELECT snapshot_json FROM story_state_snapshots WHERE script_task_id = ?1 ORDER BY created_at DESC LIMIT 1",
            params![task_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "{}".into())
    } else {
        payload["snapshot"].to_string()
    };
    let snapshot: Value = serde_json::from_str(&snapshot_json).unwrap_or_else(|_| json!({}));
    let exit = snapshot["endingExitState"].as_str().unwrap_or("上一集留下了未解决的冲突。");
    let base = truncate_chars(exit.replace('\n', " ").as_str(), 80);
    Ok(json!({
        "options": [
            {"id": "A", "title": "承压升级", "anchor": format!("承接「{}」，让主角被迫立刻处理上一集留下的危险，冲突升级但不解开核心谜底。", base)},
            {"id": "B", "title": "关系反转", "anchor": format!("承接「{}」，让一个重要关系发生误解或背叛，推动下一集进入新的选择困境。", base)},
            {"id": "C", "title": "线索外翻", "anchor": format!("承接「{}」，让一个道具、地点或旧线索暴露新含义，把故事推向更大的幕后真相。", base)}
        ],
        "snapshot": snapshot,
    }))
}

fn project_id_for_task(conn: &Connection, task_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT project_id FROM script_tasks WHERE id = ?1",
        params![task_id],
        |row| row.get::<_, String>(0),
    )
    .map_err(|_| "找不到 task 对应的 project_id".to_string())
}

fn load_props(conn: &Connection, task_id: &str, selected: &[String]) -> Result<Vec<Value>, String> {
    let mut stmt = conn.prepare("SELECT id, asset_data_json FROM asset_records WHERE task_id = ?1 AND asset_type = 'prop' ORDER BY created_at").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![task_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
    let mut props = Vec::new();
    for row in rows.flatten() {
        let (row_id, raw) = row;
        let parsed: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));
        let asset_id = parsed["id"].as_str().or_else(|| parsed["assetId"].as_str()).unwrap_or(&row_id).to_string();
        if !selected.is_empty() && !selected.contains(&asset_id) {
            continue;
        }
        let name = parsed["name"].as_str().unwrap_or("未命名道具").to_string();
        props.push(json!({"assetId": asset_id, "assetName": name, "data": parsed}));
    }
    Ok(props)
}

fn grid_for_count(count: usize) -> (usize, usize, usize) {
    if count <= 4 {
        (2, 2, 4)
    } else if count <= 9 {
        (3, 3, 9)
    } else if count <= 16 {
        (4, 4, 16)
    } else {
        (3, 3, 9)
    }
}

fn cell_label(row: usize, col: usize) -> String {
    let letter = (b'A' + row as u8) as char;
    format!("{}{}", letter, col + 1)
}

pub fn create_asset_sheet_plan(conn: &Connection, payload: &Value) -> Result<Value, String> {
    let task_id = payload["taskId"]
        .as_str()
        .or_else(|| payload["task_id"].as_str())
        .ok_or_else(|| "缺少 taskId".to_string())?;
    let selected = payload["assetIds"]
        .as_array()
        .or_else(|| payload["asset_ids"].as_array())
        .map(|items| items.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>())
        .unwrap_or_default();
    let props = load_props(conn, task_id, &selected)?;
    if props.is_empty() {
        return Err("没有可用于合板的道具资产，请先运行资产提取。".into());
    }
    let project_id = project_id_for_task(conn, task_id)?;
    let t = now();
    let mut batches = Vec::new();
    let mut offset = 0usize;
    while offset < props.len() {
        let remaining = props.len() - offset;
        let (rows, cols, capacity) = grid_for_count(remaining);
        let page = props.iter().skip(offset).take(capacity).cloned().collect::<Vec<_>>();
        let batch_id = uuid();
        let title = format!("道具资产合板 {}-{}", offset + 1, offset + page.len());
        let mut prompt_lines = vec![
            format!("Create a clean cinematic prop asset sheet in a strict {}x{} grid.", rows, cols),
            "Pure neutral background, orthographic flat-lay product design, consistent lighting and style, no text labels, no watermark.".into(),
            "Each cell must contain exactly one isolated prop centered in its cell.".into(),
            "Cell map:".into(),
        ];
        let mut cells = Vec::new();
        for (i, prop) in page.iter().enumerate() {
            let row = i / cols;
            let col = i % cols;
            let label = cell_label(row, col);
            let name = prop["assetName"].as_str().unwrap_or("prop");
            prompt_lines.push(format!("- {}: {}", label, name));
            let cell_id = uuid();
            conn.execute(
                "INSERT INTO asset_sheet_cells (id, batch_id, asset_id, asset_name, row_index, col_index, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    cell_id,
                    batch_id,
                    prop["assetId"].as_str().unwrap_or(""),
                    name,
                    row as i64,
                    col as i64,
                    t,
                    t
                ],
            )
            .map_err(|e| e.to_string())?;
            cells.push(json!({"id": cell_id, "assetId": prop["assetId"], "assetName": name, "rowIndex": row, "colIndex": col, "cellLabel": label}));
        }
        let prompt = prompt_lines.join("\n");
        conn.execute(
            "INSERT INTO asset_sheet_batches (id, project_id, task_id, asset_type, title, grid_rows, grid_cols, source_prompt, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'prop', ?4, ?5, ?6, ?7, 'planned', ?8, ?9)",
            params![batch_id, project_id, task_id, title, rows as i64, cols as i64, prompt, t, t],
        )
        .map_err(|e| e.to_string())?;
        batches.push(json!({"id": batch_id, "title": title, "gridRows": rows, "gridCols": cols, "prompt": prompt, "cells": cells}));
        offset += page.len();
    }
    Ok(json!({"taskId": task_id, "projectId": project_id, "batches": batches}))
}

fn write_base64_file(app_data_dir: &Path, payload: &Value) -> Result<PathBuf, String> {
    use base64::Engine;
    let data = payload["base64"].as_str().or_else(|| payload["data"].as_str()).ok_or_else(|| "缺少 base64 合板图".to_string())?;
    let clean = data.split_once(',').map(|(_, b)| b).unwrap_or(data);
    let bytes = base64::engine::general_purpose::STANDARD.decode(clean).map_err(|e| format!("Base64 解码失败: {}", e))?;
    let dir = app_data_dir.join("asset_sheets");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ext = payload["mimeType"].as_str().map(|m| if m.contains("webp") { "webp" } else if m.contains("jpeg") || m.contains("jpg") { "jpg" } else { "png" }).unwrap_or("png");
    let path = dir.join(format!("{}.{}", uuid(), ext));
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn crop_asset_sheet(conn: &Connection, app_data_dir: &Path, payload: &Value) -> Result<Value, String> {
    let batch_id = payload["batchId"].as_str().or_else(|| payload["batch_id"].as_str()).ok_or_else(|| "缺少 batchId".to_string())?;
    let (project_id, task_id, rows, cols) = conn.query_row(
        "SELECT project_id, task_id, grid_rows, grid_cols FROM asset_sheet_batches WHERE id = ?1",
        params![batch_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?, row.get::<_, i64>(2)?, row.get::<_, i64>(3)?)),
    ).map_err(|_| "找不到合板批次".to_string())?;
    let sheet_path = if let Some(path) = payload["filePath"].as_str().or_else(|| payload["file_path"].as_str()) {
        PathBuf::from(path)
    } else {
        write_base64_file(app_data_dir, payload)?
    };
    let img = image::open(&sheet_path).map_err(|e| format!("打开合板图失败: {}", e))?;
    let image_width = img.width();
    let image_height = img.height();
    let cell_w = image_width / cols.max(1) as u32;
    let cell_h = image_height / rows.max(1) as u32;
    let out_dir = app_data_dir.join("asset_images").join("prop");
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    let overrides = payload["cells"].as_array().cloned().unwrap_or_default();
    let override_for = |cell_id: &str| -> Option<Value> {
        overrides.iter().find(|v| v["id"].as_str() == Some(cell_id)).cloned()
    };

    let mut stmt = conn.prepare(
        "SELECT id, asset_id, asset_name, row_index, col_index FROM asset_sheet_cells WHERE batch_id = ?1 ORDER BY row_index, col_index",
    ).map_err(|e| e.to_string())?;
    let cells = stmt.query_map(params![batch_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, i64>(3)?, row.get::<_, i64>(4)?))
    }).map_err(|e| e.to_string())?;

    let mut saved = Vec::new();
    for cell in cells.flatten() {
        let (cell_id, asset_id, asset_name, row, col) = cell;
        let ov = override_for(&cell_id).unwrap_or_else(|| json!({}));
        let x = ov["x"].as_u64().unwrap_or((col.max(0) as u32 * cell_w) as u64) as u32;
        let y = ov["y"].as_u64().unwrap_or((row.max(0) as u32 * cell_h) as u64) as u32;
        let w = ov["width"].as_u64().unwrap_or(cell_w as u64) as u32;
        let h = ov["height"].as_u64().unwrap_or(cell_h as u64) as u32;
        let crop_w = w.min(image_width.saturating_sub(x));
        let crop_h = h.min(image_height.saturating_sub(y));
        if crop_w == 0 || crop_h == 0 {
            continue;
        }
        let child_id = uuid();
        let file_name = format!("{}.png", child_id);
        let child_path = out_dir.join(&file_name);
        let cropped = img.crop_imm(x, y, crop_w, crop_h);
        cropped.save(&child_path).map_err(|e| format!("保存裁切图失败: {}", e))?;
        let file_size = std::fs::metadata(&child_path).map(|m| m.len() as i64).unwrap_or(0);
        let image_payload = json!({
            "id": child_id,
            "projectId": project_id,
            "taskId": task_id.clone().unwrap_or_default(),
            "assetType": "prop",
            "assetId": asset_id,
            "assetName": asset_name,
            "category": "reference",
            "filePath": child_path.to_string_lossy(),
            "fileName": file_name,
            "fileSize": file_size,
            "mimeType": "image/png",
            "width": crop_w,
            "height": crop_h,
            "sourcePlatform": "asset-sheet-crop",
            "note": format!("从合板 {} 裁切，row={}, col={}", batch_id, row, col),
        });
        let image_meta = crate::db::crud::asset_image_save(conn, &image_payload)?;
        let image_id = image_meta["id"].as_str().unwrap_or(&child_id).to_string();
        let t = now();
        conn.execute(
            "UPDATE asset_sheet_cells SET x = ?1, y = ?2, width = ?3, height = ?4, child_image_id = ?5, child_file_path = ?6, updated_at = ?7 WHERE id = ?8",
            params![x as i64, y as i64, crop_w as i64, crop_h as i64, image_id, child_path.to_string_lossy(), t, cell_id],
        ).map_err(|e| e.to_string())?;
        saved.push(json!({"cellId": cell_id, "assetId": image_payload["assetId"], "assetName": image_payload["assetName"], "imageId": image_id, "filePath": child_path.to_string_lossy(), "x": x, "y": y, "width": crop_w, "height": crop_h}));
    }
    let t = now();
    conn.execute(
        "UPDATE asset_sheet_batches SET sheet_file_path = ?1, status = 'cropped', updated_at = ?2 WHERE id = ?3",
        params![sheet_path.to_string_lossy(), t, batch_id],
    ).map_err(|e| e.to_string())?;
    Ok(json!({"batchId": batch_id, "sheetFilePath": sheet_path.to_string_lossy(), "images": saved}))
}
