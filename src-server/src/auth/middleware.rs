use axum::{
    extract::FromRequestParts,
    http::request::Parts,
    RequestPartsExt,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use crate::error::AppError;
use crate::AppState;

/// 认证通过的用户信息提取器
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub is_admin: bool,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        // 尝试提取 Authorization: Bearer <token>
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| AppError::Unauthorized("Missing or invalid Authorization header".to_string()))?;

        // 验证 Token
        let token: &str = bearer.token();
        let claims = crate::auth::jwt::decode_token(&state.config.jwt_secret, token)?;

        let role = if claims.role.trim().is_empty() {
            "user".to_string()
        } else {
            claims.role
        };
        let is_admin = role == "admin";

        let db_path = state.db_path.clone();
        let uid = claims.sub.clone();
        tokio::task::spawn_blocking(move || {
            if let Ok(conn) = crate::db::open_database_connection(std::path::Path::new(&db_path)) {
                let _ = conn.execute(
                    "UPDATE users SET last_seen_at = datetime('now') WHERE id = ?1",
                    [uid],
                );
            }
        })
        .await
        .ok();

        Ok(AuthUser {
            user_id: claims.sub,
            username: claims.username,
            role,
            is_admin,
        })
    }
}

#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

impl FromRequestParts<AppState> for AdminUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        if !user.is_admin {
            return Err(AppError::Forbidden("Admin privileges required".to_string()));
        }
        Ok(AdminUser(user))
    }
}
