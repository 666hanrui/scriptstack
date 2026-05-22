use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use crate::error::AppError;

/// JWT Payload
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,       // user_id
    pub username: String,
    #[serde(default = "default_role")]
    pub role: String,
    pub exp: usize,        // expiration time (unix timestamp)
    pub iat: usize,        // issued at
}

fn default_role() -> String {
    "user".to_string()
}

/// 签发 JWT
pub fn encode_token(secret: &str, user_id: &str, username: &str, role: &str, expire_hours: u64) -> Result<String, AppError> {
    let now = Utc::now();
    let expiration = now + Duration::hours(expire_hours as i64);

    let claims = Claims {
        sub: user_id.to_string(),
        username: username.to_string(),
        role: if role.trim().is_empty() { "user" } else { role }.to_string(),
        iat: now.timestamp() as usize,
        exp: expiration.timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes())
    ).map_err(|e| AppError::Internal(format!("Failed to create token: {}", e)))
}

/// 验证 JWT
pub fn decode_token(secret: &str, token: &str) -> Result<Claims, AppError> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default()
    ).map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

    Ok(token_data.claims)
}
