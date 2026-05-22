use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, Response},
    routing::get,
    Router,
};
use serde::Deserialize;

use crate::{error::AppError, AppState};

#[derive(Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/files", get(get_file))
}

fn data_dir(config: &crate::config::ServerConfig) -> std::path::PathBuf {
    let upload_dir = std::path::PathBuf::from(&config.upload_dir);
    upload_dir
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or(upload_dir)
}

fn mime_for_path(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => "image/png",
    }
}

fn allowed_roots(config: &crate::config::ServerConfig) -> Vec<std::path::PathBuf> {
    let mut roots = vec![
        data_dir(config),
        std::path::PathBuf::from(&config.upload_dir),
        std::path::PathBuf::from(&config.db_path)
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| data_dir(config)),
    ];
    roots.sort();
    roots.dedup();
    roots
        .into_iter()
        .filter_map(|root| std::fs::canonicalize(root).ok())
        .collect()
}

pub async fn get_file(
    State(state): State<AppState>,
    Query(query): Query<FileQuery>,
) -> Result<Response<Body>, AppError> {
    if query.path.trim().is_empty() {
        return Err(AppError::BadRequest("缺少文件路径".into()));
    }

    let requested = std::path::PathBuf::from(&query.path);
    let canonical = std::fs::canonicalize(&requested)
        .map_err(|_| AppError::NotFound("文件不存在".into()))?;
    let allowed = allowed_roots(&state.config);
    if !allowed.iter().any(|root| canonical.starts_with(root)) {
        return Err(AppError::Forbidden("文件路径不在服务端数据目录内".into()));
    }

    let bytes = tokio::fs::read(&canonical)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let mime = mime_for_path(&canonical);

    Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .body(Body::from(bytes))
        .map_err(|e| AppError::Internal(e.to_string()))
}
