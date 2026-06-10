/// ScriptStack Tauri 桌面客户端 — 薄壳模式
///
/// 核心业务逻辑全部在云端服务 (src-server) 运行。
/// 本地客户端仅提供：
/// 1. WebView 容器（加载远端前端页面）
/// 2. 原生文件选择对话框（select_text_file）
/// 3. 故事版资料包导出与打开本地文件夹
/// 4. get_version 版本查询

mod file_parser;

mod cmd {
    use tauri::AppHandle;
    use tauri_plugin_dialog::DialogExt;
    use serde::Deserialize;
    use std::path::{Path, PathBuf};

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct ExportBundleFile {
        pub relative_path: String,
        pub content: String,
        pub encoding: Option<String>,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct ExportStoryboardBundlePayload {
        pub bundle_name: String,
        pub files: Vec<ExportBundleFile>,
        pub open_folder: Option<bool>,
    }

    fn sanitize_segment(input: &str) -> String {
        let cleaned: String = input
            .chars()
            .map(|ch| match ch {
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => '_',
                _ => ch,
            })
            .collect();
        let trimmed = cleaned.trim().trim_matches('.');
        if trimmed.is_empty() {
            "untitled".to_string()
        } else {
            trimmed.chars().take(120).collect()
        }
    }

    fn safe_relative_path(relative_path: &str) -> Result<PathBuf, String> {
        let mut out = PathBuf::new();
        for part in relative_path.split('/') {
            if part.is_empty() || part == "." {
                continue;
            }
            if part == ".." {
                return Err("导出路径不能包含上级目录".to_string());
            }
            out.push(sanitize_segment(part));
        }
        if out.as_os_str().is_empty() {
            return Err("导出文件路径为空".to_string());
        }
        Ok(out)
    }

    fn decode_file(file: &ExportBundleFile) -> Result<Vec<u8>, String> {
        let encoding = file.encoding.as_deref().unwrap_or("utf8");
        if encoding.eq_ignore_ascii_case("base64") || encoding.eq_ignore_ascii_case("data-url") {
            use base64::Engine;
            let clean = file
                .content
                .split_once(',')
                .map(|(_, body)| body)
                .unwrap_or(file.content.as_str());
            base64::engine::general_purpose::STANDARD
                .decode(clean)
                .map_err(|err| format!("Base64 解码失败：{}", err))
        } else {
            Ok(file.content.as_bytes().to_vec())
        }
    }

    fn reveal_folder(path: &Path) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        let mut command = std::process::Command::new("open");
        #[cfg(target_os = "windows")]
        let mut command = std::process::Command::new("explorer");
        #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
        let mut command = std::process::Command::new("xdg-open");

        command.arg(path);
        command.spawn().map_err(|err| format!("打开文件夹失败：{}", err))?;
        Ok(())
    }

    /// 版本号
    #[tauri::command]
    pub fn get_version() -> String {
        "3.0.3-cloud".to_string()
    }

    /// 选择本地文本文件（txt / md / docx / pdf），解析后返回内容
    /// 这是唯一保留在客户端的重量级命令，因为它需要原生文件对话框
    #[tauri::command]
    pub async fn select_text_file(app: AppHandle) -> Result<serde_json::Value, String> {
        let picked = app
            .dialog()
            .file()
            .add_filter("Text / Script", &["txt", "md", "markdown", "docx", "pdf"])
            .blocking_pick_file();
        let Some(file_path) = picked else {
            return Ok(serde_json::json!({ "cancelled": true, "content": "" }));
        };
        let path = file_path.into_path().map_err(|e| e.to_string())?;
        let parsed = crate::file_parser::parse_source_file(&path)?;
        Ok(serde_json::json!({
            "cancelled": false,
            "filePath": parsed["filePath"],
            "fileName": parsed["fileName"],
            "fileHash": parsed["fileHash"],
            "fileSize": parsed["fileSize"],
            "mimeType": parsed["mimeType"],
            "encoding": parsed["encoding"],
            "materialType": parsed["materialType"],
            "content": parsed["content"],
        }))
    }

    /// 占位：图片选择（暂用前端 <input type="file"> 替代）
    #[tauri::command]
    pub fn select_image_file() -> serde_json::Value {
        serde_json::json!({ "cancelled": true, "base64": "", "mimeType": "" })
    }

    /// 导出故事版资料包到用户选择的本地文件夹，并按需打开该目录。
    #[tauri::command]
    pub async fn export_storyboard_bundle(
        app: AppHandle,
        payload: ExportStoryboardBundlePayload,
    ) -> Result<serde_json::Value, String> {
        if payload.files.is_empty() {
            return Err("没有可导出的故事版文件".to_string());
        }

        let picked = app
            .dialog()
            .file()
            .set_title("选择故事版资料包导出位置")
            .blocking_pick_folder();
        let Some(folder) = picked else {
            return Ok(serde_json::json!({ "cancelled": true }));
        };
        let base_dir = folder.into_path().map_err(|err| err.to_string())?;
        let root = base_dir.join(sanitize_segment(&payload.bundle_name));
        std::fs::create_dir_all(&root).map_err(|err| err.to_string())?;

        let mut written = 0usize;
        for file in &payload.files {
            let relative = safe_relative_path(&file.relative_path)?;
            let target = root.join(relative);
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
            }
            let bytes = decode_file(file)?;
            std::fs::write(&target, bytes).map_err(|err| err.to_string())?;
            written += 1;
        }

        let mut opened = false;
        if payload.open_folder.unwrap_or(true) {
            opened = reveal_folder(&root).is_ok();
        }

        Ok(serde_json::json!({
            "cancelled": false,
            "folderPath": root.to_string_lossy().to_string(),
            "filesWritten": written,
            "opened": opened,
        }))
    }
}

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            log::info!("ScriptStack (cloud mode) started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd::get_version,
            cmd::select_text_file,
            cmd::select_image_file,
            cmd::export_storyboard_bundle,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ScriptStack");
}
