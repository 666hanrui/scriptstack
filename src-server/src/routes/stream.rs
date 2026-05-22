/// SSE 流式端点
///
/// 处理需要流式响应的 LLM 调用（剧本生成、诊断等）
/// 前端通过 POST /api/stream 发起，后端返回 text/event-stream

use axum::{
    extract::State,
    response::{sse::{Event, KeepAlive, Sse}, IntoResponse, Response},
    routing::post,
    Json, Router,
};

use serde::Deserialize;
use std::convert::Infallible;
use tokio_stream::wrappers::ReceiverStream;

use crate::auth::middleware::AuthUser;
use crate::AppState;

#[derive(Deserialize)]
pub struct StreamRequest {
    pub cmd: String,
    #[serde(default)]
    pub args: serde_json::Value,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/stream", post(handle_stream))
}

pub async fn handle_stream(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<StreamRequest>,
) -> Response {
    let db = state.db.clone();
    let config = state.config.clone();
    let cmd = req.cmd;
    let args = req.args;
    let user_id = auth_user.user_id.to_string();

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(2048);

    tokio::task::spawn_blocking(move || {
        let result = dispatch_stream_blocking(&cmd, db, config, args, &user_id, tx.clone());

        match result {
            Ok(final_value) => {
                let _ = tx.blocking_send(Ok(
                    Event::default().data(
                        serde_json::json!({ "done": true, "result": final_value }).to_string()
                    )
                ));
            }
            Err(e) => {
                let _ = tx.blocking_send(Ok(
                    Event::default().data(
                        serde_json::json!({ "error": e }).to_string()
                    )
                ));
            }
        }
        let _ = tx.blocking_send(Ok(Event::default().data("[DONE]")));
    });

    let stream = ReceiverStream::new(rx);
    Sse::new(stream).keep_alive(KeepAlive::default()).into_response()
}

type Tx = tokio::sync::mpsc::Sender<Result<Event, Infallible>>;
type Db = std::sync::Arc<std::sync::Mutex<rusqlite::Connection>>;

fn try_send_event(tx: &Tx, payload: serde_json::Value) {
    let _ = tx.try_send(Ok(Event::default().data(payload.to_string())));
}

// ── Blocking Dispatch ──

fn dispatch_stream_blocking(
    cmd: &str,
    db: Db,
    config: crate::config::ServerConfig,
    args: serde_json::Value,
    user_id: &str,
    tx: Tx,
) -> Result<serde_json::Value, String> {
    let rt = tokio::runtime::Handle::current();

    match cmd {
        "screenplay_generate_step" => {
            let project_id = args["projectId"].as_str().unwrap_or("").to_string();
            let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;
            let user_feedback = args["userFeedback"]
                .as_str()
                .or_else(|| args["user_feedback"].as_str())
                .map(|s| s.to_string());
            
            let tx_c = tx.clone();
            let pid = project_id.clone();
            let on_chunk = move |chunk: &str| {
                try_send_event(&tx_c, serde_json::json!({
                    "chunk": chunk,
                    "projectId": pid,
                    "stepNumber": step,
                }));
            };

            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            let future = crate::services::screenplay::generate_step_async(
                &*conn,
                &config,
                &project_id,
                user_id,
                step,
                user_feedback,
                on_chunk,
            );
            
            let result = rt.block_on(future).map_err(|e| e.to_string())?;
            Ok(result)
        }
        "screenplay_selfcheck_step" => {
            let project_id = args["projectId"].as_str().unwrap_or("").to_string();
            let step = args["stepNumber"].as_i64().unwrap_or(1) as u8;

            let tx_c = tx.clone();
            let on_chunk = move |chunk: &str| {
                try_send_event(&tx_c, serde_json::json!({ "chunk": chunk }));
            };

            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            let future = crate::services::screenplay::selfcheck_step_async(
                &*conn,
                &config,
                &project_id,
                user_id,
                step,
                on_chunk,
            );
            
            let result = rt.block_on(future).map_err(|e| e.to_string())?;
            Ok(result)
        }
        "screenplay_create_project" => {
            let init: crate::services::screenplay_store::ProjectInit = serde_json::from_value(args.clone())
                .map_err(|e| e.to_string())?;
            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            let result = crate::services::screenplay::create_project(&conn, user_id, init);
            Ok(serde_json::to_value(result).unwrap_or_default())
        }
        "screenplay_regenerate_checkpoint" => {
            let project_id = args["projectId"].as_str().unwrap_or("").to_string();
            let trigger = args["trigger"].as_str().unwrap_or("manual").to_string();

            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            let future = crate::services::screenplay::generate_checkpoint_async(
                &*conn,
                &config,
                &project_id,
                user_id,
                &trigger,
            );
            
            let result = rt.block_on(future).map_err(|e| e.to_string())?;
            Ok(serde_json::json!(result))
        }
        "save_script_generation" => {
            let input: crate::db::crud::ScriptGenerationInput = serde_json::from_value(args)
                .map_err(|e| e.to_string())?;

            let tx_c = tx.clone();
            let on_chunk = move |chunk: &str| {
                try_send_event(&tx_c, serde_json::json!({ "chunk": chunk }));
            };

            let conn = db.lock().unwrap_or_else(|e| e.into_inner());
            let future = crate::services::script_generation::run_script_generation(
                &*conn,
                &input,
                Some(&on_chunk),
            );
            
            let result = rt.block_on(future)?;
            Ok(serde_json::to_value(result).unwrap_or_default())
        }
        _ => {
            Err(format!("Unknown streaming command: {}", cmd))
        }
    }
}
