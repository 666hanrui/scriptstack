use std::env;

/// 服务端配置，从环境变量读取
#[derive(Debug, Clone)]
pub struct ServerConfig {
    // 服务
    pub listen_addr: String,
    pub jwt_secret: String,
    pub jwt_expire_hours: u64,
    pub upload_dir: String,
    pub max_upload_size_mb: u64,
    pub admin_username: String,
    pub admin_password: String,
    pub admin_email: String,

    // LLM 文字模型
    pub llm_text_endpoint: String,
    pub llm_text_key: String,
    pub llm_text_model: String,
    pub llm_text_mode: String,

    // LLM 图片模型
    pub llm_image_endpoint: String,
    pub llm_image_key: String,
    pub llm_image_model: String,

    // 数据库
    pub db_path: String,

    // 质量阈值
    pub review_threshold: u8,
}

impl ServerConfig {
    pub fn from_env() -> Self {
        // 支持从仓库根目录或 src-server 目录启动服务。
        dotenvy::dotenv().ok();
        dotenvy::from_filename("src-server/.env").ok();
        Self {
            listen_addr: env::var("SCRIPTSTACK_LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:3000".into()),
            jwt_secret: env::var("SCRIPTSTACK_JWT_SECRET").unwrap_or_else(|_| "dev_secret_key_change_me_in_prod".into()),
            jwt_expire_hours: env::var("SCRIPTSTACK_JWT_EXPIRE_HOURS").ok().and_then(|v| v.parse().ok()).unwrap_or(72),
            upload_dir: env::var("SCRIPTSTACK_UPLOAD_DIR").unwrap_or_else(|_| "./data/uploads".into()),
            max_upload_size_mb: env::var("SCRIPTSTACK_MAX_UPLOAD_MB").ok().and_then(|v| v.parse().ok()).unwrap_or(50),
            admin_username: env::var("SCRIPTSTACK_ADMIN_USERNAME").unwrap_or_default(),
            admin_password: env::var("SCRIPTSTACK_ADMIN_PASSWORD").unwrap_or_default(),
            admin_email: env::var("SCRIPTSTACK_ADMIN_EMAIL").unwrap_or_default(),
            llm_text_endpoint: env::var("SCRIPTSTACK_LLM_TEXT_ENDPOINT").unwrap_or_default(),
            llm_text_key: env::var("SCRIPTSTACK_LLM_TEXT_KEY").unwrap_or_default(),
            llm_text_model: env::var("SCRIPTSTACK_LLM_TEXT_MODEL").unwrap_or_else(|_| "deepseek-chat".into()),
            llm_text_mode: env::var("SCRIPTSTACK_LLM_TEXT_MODE").unwrap_or_else(|_| "openai".into()),
            llm_image_endpoint: env::var("SCRIPTSTACK_LLM_IMAGE_ENDPOINT").unwrap_or_default(),
            llm_image_key: env::var("SCRIPTSTACK_LLM_IMAGE_KEY").unwrap_or_default(),
            llm_image_model: env::var("SCRIPTSTACK_LLM_IMAGE_MODEL").unwrap_or_default(),
            db_path: env::var("SCRIPTSTACK_DB_PATH").unwrap_or_else(|_| "./data/scriptstack.db".into()),
            review_threshold: env::var("SCRIPTSTACK_REVIEW_THRESHOLD").ok().and_then(|v| v.parse().ok()).unwrap_or(70),
        }
    }

    /// 构建 LLM RuntimeConfig（用于 llm 模块调用）
    pub fn to_runtime_config(&self) -> crate::llm::config::RuntimeConfig {
        crate::llm::config::RuntimeConfig {
            mode: String::new(),
            api_base_url: self.llm_text_endpoint.clone(),
            api_key: self.llm_text_key.clone(),
            default_model: self.llm_text_model.clone(),
            text_mode: self.llm_text_mode.clone(),
            image_endpoint: self.llm_image_endpoint.clone(),
            image_key: self.llm_image_key.clone(),
            image_model: self.llm_image_model.clone(),
            review_threshold: self.review_threshold,
            enable_local_save: false,
        }
    }
}
