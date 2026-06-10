use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

pub mod config;
pub mod error;
pub mod auth;
pub mod routes;
pub mod db;
pub mod llm;
pub mod services;
pub mod utils;

use config::ServerConfig;

/// 全局应用状态
#[derive(Clone)]
pub struct AppState {
    pub db_path: String,
    pub config: ServerConfig,
}

#[tokio::main]
async fn main() {
    // 1. 初始化日志与环境变量
    dotenvy::dotenv().ok();
    env_logger::init();

    // 2. 加载配置
    let config = ServerConfig::from_env();
    log::info!("Starting ScriptStack Server on {}", config.listen_addr);

    // 3. 初始化数据库 (db::init_database 会在 db/mod.rs 迁移后可用)
    // 这里如果路径不存在，会自动创建
    let db_path = std::path::Path::new(&config.db_path);
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).unwrap_or_default();
    }
    let conn = db::init_database(db_path).expect("Failed to initialize database");
    db::schema::ensure_admin_user(&conn, &config).expect("Failed to seed admin user");
    drop(conn);
    
    // 构建状态池
    let state = AppState {
        db_path: db_path.to_string_lossy().to_string(),
        config: config.clone(),
    };

    // 4. 配置中间件
    let cors = CorsLayer::new()
        // 开发环境允许所有跨域，生产环境应当限制 origins
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 5. 组装路由
    let app = axum::Router::new()
        .merge(routes::auth::router())
        .merge(routes::files::router())
        .merge(routes::invoke::router())
        .merge(routes::stream::router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    // 6. 启动服务
    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await.unwrap();
    log::info!("Listening on {}", config.listen_addr);
    axum::serve(listener, app).await.unwrap();
}
