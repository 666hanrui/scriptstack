/// 本地文件解析工具（用于 Tauri 文件选择对话框）
///
/// 从原 services/longform.rs 中提取的纯文件解析逻辑，
/// 不依赖数据库、网络、LLM 等重量级模块。

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::{Cursor, Read};
use std::path::Path;

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
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
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

fn normalize_text(input: &str) -> String {
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
    let text =
        pdf_extract::extract_text(path).map_err(|e| format!("PDF 文字层提取失败: {}", e))?;
    let text = normalize_text(&text);
    if text.trim().chars().count() < 20 {
        return Err("PDF 没有可用文字层，可能是扫描版；本期暂不支持 OCR。".into());
    }
    Ok(text)
}

fn detect_material_type(text: &str) -> String {
    let sample = text.chars().take(4000).collect::<String>();
    let scene_re = regex_lite::Regex::new(r"(【\s*(场景|场)\s*[一二三四五六七八九十百零〇\d]+|^\s*(场景|场)\s*[一二三四五六七八九十百零〇\d]+[：:])").unwrap();
    let chapter_re = regex_lite::Regex::new(
        r"(?m)^\s*第[一二三四五六七八九十百千万零〇\d]+[章节回卷]",
    )
    .unwrap();
    let dialogue_re = regex_lite::Regex::new(r"(?m)^\s*.{1,12}\s*[：:]").unwrap();
    if scene_re.is_match(&sample) {
        "script".into()
    } else if sample.contains("人物设定")
        || sample.contains("角色设定")
        || sample.contains("人物小传")
    {
        "character_bible".into()
    } else if chapter_re.find_iter(text).count() >= 2 || text.chars().count() > 8000 {
        "novel".into()
    } else if dialogue_re.find_iter(&sample).count() >= 8 {
        "script".into()
    } else if sample.contains("大纲") || sample.contains("梗概") || sample.contains("故事线") {
        "outline".into()
    } else {
        "mixed".into()
    }
}

/// 解析本地文件（txt / md / docx / pdf）→ JSON
pub fn parse_source_file(path: &Path) -> Result<Value, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("读取文件失败: {}", e))?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
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
