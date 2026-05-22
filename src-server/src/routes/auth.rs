use axum::{
    routing::{post, get},
    Router, Json, extract::State,
};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use rand::{distributions::Alphanumeric, Rng};
use crate::{AppState, error::AppError};
use crate::auth::middleware::AuthUser;
use crate::auth::jwt::encode_token;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/refresh", post(refresh))
        .route("/api/auth/status", get(status))
}

#[derive(Deserialize)]
pub struct RegisterReq {
    pub username: String,
    pub email: Option<String>,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginReq {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct RefreshReq {
    pub refresh_token: String,
}

#[derive(Serialize)]
pub struct AuthRes {
    pub token: String,
    pub refresh_token: String,
    pub expires_in: u64, // hours
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub is_admin: bool,
}

fn hash_password(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt.as_bytes());
    hex::encode(hasher.finalize())
}

fn generate_salt() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(16)
        .map(char::from)
        .collect()
}

fn generate_refresh_token() -> String {
    uuid::Uuid::new_v4().to_string()
}

async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterReq>,
) -> Result<Json<AuthRes>, AppError> {
    if req.username.trim().is_empty() || req.password.is_empty() {
        return Err(AppError::BadRequest("Username and password required".into()));
    }

    let salt = generate_salt();
    let hashed = hash_password(&req.password, &salt);
    let refresh_token = generate_refresh_token();
    let email = req.email.unwrap_or_default();

    let db = state.db.clone();
    let req_username = req.username.clone();
    let rt_clone = refresh_token.clone();
    let user_id = tokio::task::spawn_blocking(move || -> Result<String, AppError> {
        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        // 检查用户名是否已存在
        let mut stmt = conn.prepare("SELECT id FROM users WHERE username = ?1")?;
        if stmt.exists([&req_username])? {
            return Err(AppError::BadRequest("Username already exists".into()));
        }

        conn.execute(
            "INSERT INTO users (username, email, password_hash, salt, refresh_token) VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &req_username,
                &email,
                &hashed,
                &salt,
                &rt_clone,
            ),
        )?;
        
        let id = conn.last_insert_rowid().to_string();
        Ok(id)
    }).await.map_err(|e| AppError::Internal(e.to_string()))??;

    let role = "user".to_string();
    let token = encode_token(&state.config.jwt_secret, &user_id, &req.username, &role, state.config.jwt_expire_hours)?;

    Ok(Json(AuthRes {
        token,
        refresh_token,
        expires_in: state.config.jwt_expire_hours,
        user_id,
        username: req.username,
        role,
        is_admin: false,
    }))
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginReq>,
) -> Result<Json<AuthRes>, AppError> {
    let db = state.db.clone();
    let req_username = req.username.clone();
    let (user_id, db_hash, salt, mut refresh_token, role) = tokio::task::spawn_blocking(move || -> Result<(String, String, String, String, String), AppError> {
        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        let mut stmt = conn.prepare("SELECT id, password_hash, salt, refresh_token, COALESCE(role, 'user') FROM users WHERE username = ?1")?;
        let mut rows = stmt.query([&req_username])?;
        
        if let Some(row) = rows.next()? {
            let id: i64 = row.get(0)?;
            let hash: String = row.get(1)?;
            let salt: String = row.get(2)?;
            let rtoken: Option<String> = row.get(3)?;
            let role: String = row.get(4)?;
            Ok((id.to_string(), hash, salt, rtoken.unwrap_or_default(), role))
        } else {
            Err(AppError::Unauthorized("Invalid username or password".into()))
        }
    }).await.map_err(|e| AppError::Internal(e.to_string()))??;

    let hashed = hash_password(&req.password, &salt);
    if hashed != db_hash {
        return Err(AppError::Unauthorized("Invalid username or password".into()));
    }

    // 如果没有 refresh_token，生成一个并更新
    if refresh_token.is_empty() {
        refresh_token = generate_refresh_token();
        let db = state.db.clone();
        let rt = refresh_token.clone();
        let uid = user_id.clone();
        tokio::task::spawn_blocking(move || -> Result<(), AppError> {
            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            conn.execute("UPDATE users SET refresh_token = ?1 WHERE id = ?2", (&rt, &uid))?;
            Ok(())
        }).await.map_err(|e| AppError::Internal(e.to_string()))??;
    }

    {
        let db = state.db.clone();
        let uid = user_id.clone();
        tokio::task::spawn_blocking(move || -> Result<(), AppError> {
            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            conn.execute(
                "UPDATE users SET last_login_at = datetime('now'), last_seen_at = datetime('now') WHERE id = ?1",
                [&uid],
            )?;
            Ok(())
        }).await.map_err(|e| AppError::Internal(e.to_string()))??;
    }

    let token = encode_token(&state.config.jwt_secret, &user_id, &req.username, &role, state.config.jwt_expire_hours)?;
    let is_admin = role == "admin";

    Ok(Json(AuthRes {
        token,
        refresh_token,
        expires_in: state.config.jwt_expire_hours,
        user_id,
        username: req.username,
        role,
        is_admin,
    }))
}

async fn refresh(
    State(state): State<AppState>,
    Json(req): Json<RefreshReq>,
) -> Result<Json<AuthRes>, AppError> {
    let db = state.db.clone();
    let (user_id, username, role) = tokio::task::spawn_blocking(move || -> Result<(String, String, String), AppError> {
        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        let mut stmt = conn.prepare("SELECT id, username, COALESCE(role, 'user') FROM users WHERE refresh_token = ?1")?;
        let mut rows = stmt.query([&req.refresh_token])?;
        
        if let Some(row) = rows.next()? {
            let id: i64 = row.get(0)?;
            let uname: String = row.get(1)?;
            let role: String = row.get(2)?;
            Ok((id.to_string(), uname, role))
        } else {
            Err(AppError::Unauthorized("Invalid refresh token".into()))
        }
    }).await.map_err(|e| AppError::Internal(e.to_string()))??;

    // 更新 refresh_token 以实现轮换 (Rotation)
    let new_refresh_token = generate_refresh_token();
    let db = state.db.clone();
    let rt = new_refresh_token.clone();
    let uid = user_id.clone();
    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let conn = db.lock().unwrap_or_else(|e| e.into_inner());
        conn.execute(
            "UPDATE users SET refresh_token = ?1, last_seen_at = datetime('now') WHERE id = ?2",
            (&rt, &uid),
        )?;
        Ok(())
    }).await.map_err(|e| AppError::Internal(e.to_string()))??;

    let token = encode_token(&state.config.jwt_secret, &user_id, &username, &role, state.config.jwt_expire_hours)?;
    let is_admin = role == "admin";

    Ok(Json(AuthRes {
        token,
        refresh_token: new_refresh_token,
        expires_in: state.config.jwt_expire_hours,
        user_id,
        username,
        role,
        is_admin,
    }))
}

async fn status(
    user: AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "status": "ok",
        "user_id": user.user_id,
        "username": user.username,
        "role": user.role,
        "isAdmin": user.is_admin,
        "is_admin": user.is_admin,
    })))
}