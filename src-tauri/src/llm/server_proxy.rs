use crate::llm::config::RuntimeConfig;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ContextualLlmParams {
    pub runtime_config: RuntimeConfig,
    pub context_type: String,
    pub context_params: serde_json::Value,
    pub temperature: Option<f32>,
    pub max_tokens_override: Option<u32>,
}

#[derive(Debug)]
pub struct PromptLlmParams {
    pub runtime_config: RuntimeConfig,
    pub prompt_slug: String,
    pub user_messages: Vec<serde_json::Value>,
    pub temperature: Option<f32>,
}

/// Non-streaming LLM call: builds a local prompt via build_prompt_slug(),
/// calls the user-configured model endpoint directly, returns the full response text.
pub async fn request_prompt_llm(params: PromptLlmParams) -> Result<String, String> {
    let mut full = String::new();
    {
        let mut collect = |chunk: &str| full.push_str(chunk);
        request_prompt_llm_inner(&params, &mut collect).await?;
    }
    Ok(full)
}

/// Streaming LLM call: builds a local prompt via build_prompt_slug(),
/// calls the user-configured model endpoint directly, delivering chunks to on_chunk callback.
/// Returns the full response text.
pub async fn request_prompt_llm_stream(
    params: PromptLlmParams,
    on_chunk: impl FnMut(&str),
) -> Result<String, String> {
    request_prompt_llm_inner(&params, on_chunk).await
}

async fn request_prompt_llm_inner(
    params: &PromptLlmParams,
    mut on_chunk: impl FnMut(&str),
) -> Result<String, String> {
    let (system_prompt, user_messages) =
        crate::llm::prompts::build_prompt_slug(&params.prompt_slug, &params.user_messages);

    let mut messages = vec![serde_json::json!({"role": "system", "content": system_prompt})];
    messages.extend(user_messages.clone());

    let cfg = &params.runtime_config;
    let model = &cfg.default_model;
    let mode = &cfg.text_mode;
    let temperature = resolve_temperature(model, params.temperature);
    let max_tokens = 8192;

    dump_prompt_audit(
        "request_prompt_llm",
        Some(&params.prompt_slug),
        None,
        &prompt_slug_file(&params.prompt_slug),
        messages.first().and_then(|m| m["content"].as_str()).unwrap_or(""),
        &user_messages,
        model,
        max_tokens,
        &serde_json::json!({ "temperature": temperature, "mode": mode }),
    );

    if cfg.api_key.is_empty() || cfg.api_base_url.is_empty() {
        return Err("API 未配置，无法发起模型调用。".into());
    }

    request_configured_llm(
        cfg,
        model,
        mode,
        &messages,
        temperature,
        max_tokens,
        &mut on_chunk,
    )
    .await
}

pub async fn request_contextual_llm_stream(
    params: ContextualLlmParams,
    mut on_chunk: impl FnMut(&str),
) -> Result<String, String> {
    let (system_prompt, user_prompt) =
        crate::llm::prompts::build_prompt(&params.context_type, &params.context_params);

    let user_messages = vec![serde_json::json!({"role": "user", "content": user_prompt})];
    let messages = vec![
        serde_json::json!({"role": "system", "content": system_prompt}),
        user_messages[0].clone(),
    ];

    let cfg = &params.runtime_config;
    let model = &cfg.default_model;
    let mode = &cfg.text_mode;
    let temperature = resolve_temperature(model, params.temperature);
    let max_tokens = params.max_tokens_override.unwrap_or(8192);

    dump_prompt_audit(
        "request_contextual_llm_stream",
        None,
        Some(&params.context_type),
        &context_prompt_file(&params.context_type, &params.context_params),
        messages.first().and_then(|m| m["content"].as_str()).unwrap_or(""),
        &user_messages,
        model,
        max_tokens,
        &serde_json::json!({
            "temperature": temperature,
            "mode": mode,
            "contextParams": params.context_params,
            "projectId": params.context_params.get("projectId").cloned().unwrap_or(serde_json::Value::Null),
            "taskId": params.context_params.get("taskId").cloned().unwrap_or(serde_json::Value::Null),
            "stepNumber": params.context_params.get("stepNumber").cloned().unwrap_or(serde_json::Value::Null)
        }),
    );

    if cfg.api_key.is_empty() || cfg.api_base_url.is_empty() {
        return Err("API 未配置，无法发起模型调用。".into());
    }

    request_configured_llm(
        cfg,
        model,
        mode,
        &messages,
        temperature,
        max_tokens,
        &mut on_chunk,
    )
    .await
}

/// Test connectivity to a configured LLM endpoint.
/// Returns (ok, latency_ms, error_message).
pub async fn test_connection(
    endpoint: &str,
    key: &str,
    model: &str,
    mode: &str,
) -> Result<(bool, u64, String), String> {
    let start = std::time::Instant::now();
    let url = build_text_url(endpoint, model, mode);
    let headers = build_headers(key, mode);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("LLM 客户端初始化失败：{}", e))?;

    let body = match mode {
        "gemini" => build_gemini_body(&[serde_json::json!({"role": "user", "content": "hi"})]),
        "anthropic" => serde_json::json!({
            "model": model,
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "hi"}]
        }),
        _ => serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": "hi"}],
            "max_tokens": 1
        }),
    };

    let full_url = if mode == "gemini" {
        let sep = if url.contains('?') { "&" } else { "?" };
        format!("{}{}key={}", url, sep, urlencoding(key))
    } else {
        url.clone()
    };

    let response = client
        .post(&full_url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络错误：{}", e))?;

    let latency = start.elapsed().as_millis() as u64;
    let status = response.status();

    if status.is_success() {
        return Ok((true, latency, String::new()));
    }

    let detail = response.text().await.unwrap_or_default();
    let provider_error = extract_provider_error(&detail);

    let msg = match status.as_u16() {
        400 => {
            if looks_like_model_error(&detail) {
                format!("模型名无效：{}", provider_error.unwrap_or_else(|| "模型端点拒绝该模型".into()))
            } else {
                format!("请求参数错误（400）{}", provider_msg(provider_error))
            }
        }
        401 => format!("API Key 无效或已过期{}", provider_msg(provider_error)),
        403 => format!("权限不足或配额耗尽{}", provider_msg(provider_error)),
        404 => format!("端点路径不存在（404）{}", provider_msg(provider_error)),
        429 => format!("请求过频或配额耗尽（429）{}", provider_msg(provider_error)),
        _ if status.as_u16() >= 500 => format!("模型服务异常（{}）{}", status.as_u16(), provider_msg(provider_error)),
        _ => format!("HTTP {}{}", status.as_u16(), provider_msg(provider_error)),
    };

    Ok((false, latency, msg))
}

// ── URL Building ──

fn normalize_endpoint(endpoint: &str) -> String {
    endpoint.trim().trim_end_matches('/').to_string()
}

fn build_text_url(endpoint: &str, model: &str, mode: &str) -> String {
    let base = normalize_endpoint(endpoint);
    match mode {
        "gemini" => format!("{}/models/{}:generateContent", base, model),
        "anthropic" => {
            if base.ends_with("/messages") { base } else { format!("{}/messages", base) }
        }
        _ => {
            if base.ends_with("/chat/completions") { base } else { format!("{}/chat/completions", base) }
        }
    }
}

// ── Headers ──

fn build_headers(key: &str, mode: &str) -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(reqwest::header::CONTENT_TYPE, "application/json".parse().unwrap());
    match mode {
        "anthropic" => {
            headers.insert(reqwest::header::HeaderName::from_static("x-api-key"), key.parse().unwrap());
            headers.insert(reqwest::header::HeaderName::from_static("anthropic-version"), "2023-06-01".parse().unwrap());
        }
        "gemini" => {}
        _ => {
            headers.insert(reqwest::header::AUTHORIZATION, format!("Bearer {}", key).parse().unwrap());
        }
    }
    headers
}

// ── Request body builders ──

fn build_openai_body(
    model: &str,
    messages: &[serde_json::Value],
    temperature: f32,
    stream: bool,
    max_tokens: u32,
) -> serde_json::Value {
    serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": stream,
        "max_tokens": max_tokens,
    })
}

fn build_anthropic_body(
    model: &str,
    messages: &[serde_json::Value],
    temperature: f32,
    stream: bool,
) -> serde_json::Value {
    let system = messages
        .iter()
        .find(|m| m["role"] == "system")
        .and_then(|m| m["content"].as_str())
        .unwrap_or("");
    let user_messages: Vec<serde_json::Value> = messages
        .iter()
        .filter(|m| m["role"] != "system")
        .cloned()
        .collect();

    serde_json::json!({
        "model": model,
        "max_tokens": 8192,
        "temperature": temperature,
        "system": system,
        "messages": user_messages,
        "stream": stream,
    })
}

fn build_gemini_body(messages: &[serde_json::Value]) -> serde_json::Value {
    let contents: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            let text = m["content"].as_str().unwrap_or("");
            serde_json::json!({ "role": "user", "parts": [{"text": text}] })
        })
        .collect();
    serde_json::json!({ "contents": contents })
}

// ── API callers ──

async fn request_configured_llm(
    cfg: &RuntimeConfig,
    model: &str,
    mode: &str,
    messages: &[serde_json::Value],
    temperature: f32,
    max_tokens: u32,
    on_chunk: &mut impl FnMut(&str),
) -> Result<String, String> {
    match mode {
        "gemini" => request_gemini(cfg, model, messages, temperature, on_chunk).await,
        "anthropic" => request_anthropic_stream(cfg, model, messages, temperature, on_chunk).await,
        _ => request_openai_stream(cfg, model, messages, temperature, on_chunk, max_tokens).await,
    }
}

async fn request_openai_stream(
    cfg: &RuntimeConfig,
    model: &str,
    messages: &[serde_json::Value],
    temperature: f32,
    mut on_chunk: impl FnMut(&str),
    max_tokens: u32,
) -> Result<String, String> {
    let url = build_text_url(&cfg.api_base_url, model, "openai");
    let headers = build_headers(&cfg.api_key, "openai");
    let body = build_openai_body(model, messages, temperature, true, max_tokens);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| safe_error("OpenAI 调用失败", e, &cfg.api_key))?;

    let status = response.status();
    if !status.is_success() {
        let detail = redact_secret(&response.text().await.unwrap_or_default(), &cfg.api_key);
        return Err(format!("OpenAI 调用失败（{}）：{}", status.as_u16(), &detail[..detail.len().min(200)]));
    }

    parse_openai_sse(response, &mut on_chunk).await
}

async fn request_anthropic_stream(
    cfg: &RuntimeConfig,
    model: &str,
    messages: &[serde_json::Value],
    temperature: f32,
    mut on_chunk: impl FnMut(&str),
) -> Result<String, String> {
    let url = build_text_url(&cfg.api_base_url, model, "anthropic");
    let headers = build_headers(&cfg.api_key, "anthropic");
    let body = build_anthropic_body(model, messages, temperature, true);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| safe_error("Anthropic 调用失败", e, &cfg.api_key))?;

    let status = response.status();
    if !status.is_success() {
        let detail = redact_secret(&response.text().await.unwrap_or_default(), &cfg.api_key);
        return Err(format!("Anthropic 调用失败（{}）：{}", status.as_u16(), &detail[..detail.len().min(200)]));
    }

    parse_anthropic_sse(response, &mut on_chunk).await
}

async fn request_gemini(
    cfg: &RuntimeConfig,
    model: &str,
    messages: &[serde_json::Value],
    _temperature: f32,
    on_chunk: impl FnMut(&str),
) -> Result<String, String> {
    let url = build_text_url(&cfg.api_base_url, model, "gemini");
    let headers = build_headers(&cfg.api_key, "gemini");
    let body = build_gemini_body(messages);

    let sep = if url.contains('?') { "&" } else { "?" };
    let full_url = format!("{}{}key={}", url, sep, urlencoding(&cfg.api_key));

    let client = reqwest::Client::new();
    let response = client
        .post(&full_url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| safe_error("Gemini 调用失败", e, &cfg.api_key))?;

    let status = response.status();
    if !status.is_success() {
        let detail = redact_secret(&response.text().await.unwrap_or_default(), &cfg.api_key);
        return Err(format!("Gemini 调用失败（{}）：{}", status.as_u16(), &detail[..detail.len().min(200)]));
    }

    let payload: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Gemini 响应解析失败：{}", e))?;

    let text = payload["candidates"]
        .as_array()
        .and_then(|c| c.first())
        .and_then(|c| c["content"]["parts"].as_array())
        .and_then(|parts| {
            parts
                .iter()
                .filter_map(|p| p["text"].as_str())
                .collect::<Vec<_>>()
                .join("")
                .into_option()
        })
        .unwrap_or_default();

    if text.is_empty() {
        return Err("Gemini 返回了空内容。".into());
    }

    let mut cb = on_chunk;
    cb(&text);
    Ok(text)
}

// ── SSE Parsing ──

async fn parse_openai_sse(response: reqwest::Response, on_chunk: &mut impl FnMut(&str)) -> Result<String, String> {
    use futures::StreamExt;

    let stream = response.bytes_stream();
    let mut full = String::new();
    let mut buffer = String::new();

    let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(async move {
        let mut s = stream;
        while let Some(chunk) = s.next().await {
            match chunk {
                Ok(bytes) => { let _ = tx.send(bytes); }
                Err(e) => { log::error!("SSE stream error: {}", e); break; }
            }
        }
    });

    use tokio_stream::wrappers::UnboundedReceiverStream;
    let mut rx = UnboundedReceiverStream::new(rx);

    while let Some(bytes) = rx.next().await {
        let text = String::from_utf8_lossy(&bytes);
        buffer.push_str(&text);

        let lines: Vec<String> = buffer.split('\n').map(String::from).collect();
        buffer = lines.last().cloned().unwrap_or_default();

        for line in lines.iter().take(lines.len().saturating_sub(1)) {
            let trimmed = line.trim();
            if !trimmed.starts_with("data:") { continue; }
            let data = trimmed[5..].trim();
            if data == "[DONE]" { continue; }
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(text) = parsed["choices"].as_array().and_then(|c| c.first()).and_then(|c| c["delta"]["content"].as_str()) {
                    full.push_str(text);
                    on_chunk(text);
                }
            }
        }
    }

    Ok(full.trim().to_string())
}

async fn parse_anthropic_sse(response: reqwest::Response, on_chunk: &mut impl FnMut(&str)) -> Result<String, String> {
    use futures::StreamExt;

    let stream = response.bytes_stream();
    let mut full = String::new();
    let mut buffer = String::new();

    let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(async move {
        let mut s = stream;
        while let Some(chunk) = s.next().await {
            match chunk {
                Ok(bytes) => { let _ = tx.send(bytes); }
                Err(e) => { log::error!("SSE stream error: {}", e); break; }
            }
        }
    });

    use tokio_stream::wrappers::UnboundedReceiverStream;
    let mut rx = UnboundedReceiverStream::new(rx);

    while let Some(bytes) = rx.next().await {
        let text = String::from_utf8_lossy(&bytes);
        buffer.push_str(&text);

        let lines: Vec<String> = buffer.split('\n').map(String::from).collect();
        buffer = lines.last().cloned().unwrap_or_default();

        for line in lines.iter().take(lines.len().saturating_sub(1)) {
            let trimmed = line.trim();
            if !trimmed.starts_with("data:") { continue; }
            let data = trimmed[5..].trim();
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                if parsed["type"] == "content_block_delta" {
                    if let Some(text) = parsed["delta"]["text"].as_str() {
                        full.push_str(text);
                        on_chunk(text);
                    }
                }
            }
        }
    }

    Ok(full.trim().to_string())
}

// ── Prompt Audit ──

fn dump_prompt_audit(
    command: &str,
    prompt_slug: Option<&str>,
    context_type: Option<&str>,
    prompt_file: &str,
    system_prompt: &str,
    user_messages: &[serde_json::Value],
    model: &str,
    max_tokens: u32,
    metadata: &serde_json::Value,
) {
    let user_json = serde_json::to_string(user_messages).unwrap_or_default();
    let hash_input = format!("{}\n{}\n{}\n{}", prompt_file, system_prompt, user_json, model);
    let mut hasher = Sha256::new();
    hasher.update(hash_input.as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    let short_hash = &hash[..16];
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let dir = prompt_audit_dir();
    if std::fs::create_dir_all(&dir).is_err() { return; }

    let audit = serde_json::json!({
        "command": command,
        "contextType": context_type,
        "promptSlug": prompt_slug,
        "promptFile": prompt_file,
        "systemPrompt": system_prompt,
        "userMessages": user_messages,
        "model": model,
        "maxTokens": max_tokens,
        "projectId": metadata.get("projectId").cloned().unwrap_or(serde_json::Value::Null),
        "taskId": metadata.get("taskId").cloned().unwrap_or(serde_json::Value::Null),
        "stepNumber": metadata.get("stepNumber").cloned().unwrap_or(serde_json::Value::Null),
        "metadata": metadata,
        "promptHash": hash,
        "createdAtEpochMs": now_ms
    });

    let filename_key = prompt_slug.or(context_type).unwrap_or("unknown").replace('/', "_");
    let dump_path = dir.join(format!("{}-{}-{}.json", now_ms, filename_key, short_hash));
    if let Ok(text) = serde_json::to_string_pretty(&audit) {
        let _ = std::fs::write(&dump_path, text);
    }

    let index_path = dir.join("prompt_hash_index.jsonl");
    let index = serde_json::json!({
        "promptHash": hash,
        "promptFile": prompt_file,
        "promptSlug": prompt_slug,
        "contextType": context_type,
        "command": command,
        "model": model,
        "maxTokens": max_tokens,
        "dumpFile": dump_path.file_name().and_then(|s| s.to_str()).unwrap_or(""),
        "createdAtEpochMs": now_ms
    });
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(index_path) {
        let _ = writeln!(file, "{}", index);
    }
}

fn prompt_audit_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("SCRIPTSTACK_PROMPT_AUDIT_DIR") {
        if !dir.trim().is_empty() {
            return PathBuf::from(dir);
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("ScriptStack")
                .join("debug-prompts");
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            return PathBuf::from(appdata).join("ScriptStack").join("debug-prompts");
        }
    }

    if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
        return PathBuf::from(xdg).join("ScriptStack").join("debug-prompts");
    }

    if let Some(home) = std::env::var_os("HOME") {
        return PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("ScriptStack")
            .join("debug-prompts");
    }

    std::env::temp_dir().join("ScriptStack").join("debug-prompts")
}

fn prompt_slug_file(slug: &str) -> String {
    match slug {
        "script_planning" => "src-tauri/src/llm/prompts/slug_script_planning.txt".into(),
        "script_writing" => "src-tauri/src/llm/prompts/slug_script_writing.txt".into(),
        "script_review" => "src-tauri/src/llm/prompts/slug_script_review.txt".into(),
        "asset_character" => "src-tauri/src/llm/prompts/slug_asset_character.txt".into(),
        "asset_scene" => "src-tauri/src/llm/prompts/slug_asset_scene.txt".into(),
        "asset_prop" => "src-tauri/src/llm/prompts/slug_asset_prop.txt".into(),
        "prompt_segment_planning" => "src-tauri/src/llm/prompts/slug_prompt_segment_planning.txt".into(),
        "prompt_seedance_scene" => "src-tauri/src/llm/prompts/slug_prompt_seedance_scene.txt".into(),
        "image_prompt_generation" => "src-tauri/src/llm/prompts/slug_image_prompt_generation.txt".into(),
        "video_prompt_generation" => "src-tauri/src/llm/prompts/slug_video_prompt_generation.txt".into(),
        "prompt_review" => "src-tauri/src/llm/prompts/slug_prompt_review.txt".into(),
        other => format!("UNKNOWN_PROMPT_SLUG:{}", other),
    }
}

fn context_prompt_file(context_type: &str, params: &serde_json::Value) -> String {
    match context_type {
        "screenplay_step" => {
            let n = params["stepNumber"].as_u64().unwrap_or(0);
            format!("src-tauri/src/llm/prompts/step{}.txt", n)
        }
        "screenplay_selfcheck" => "src-tauri/src/llm/prompts/selfcheck.txt".into(),
        "screenplay_checkpoint" => "src-tauri/src/llm/prompts/checkpoint.txt".into(),
        "seedance_phase_ad" => "src-tauri/src/llm/prompts/ctx_seedance_phase_ad.txt".into(),
        "seedance_unit_efg" => "src-tauri/src/llm/prompts/ctx_seedance_unit_efg.txt".into(),
        other => format!("UNKNOWN_CONTEXT_TYPE:{}", other),
    }
}

// ── Utilities ──

fn redact_secret(input: &str, key: &str) -> String {
    let mut out = input.to_string();
    if !key.is_empty() {
        out = out.replace(key, "[REDACTED_API_KEY]");
        out = out.replace(&urlencoding(key), "[REDACTED_API_KEY]");
    }
    if let Ok(re) = regex_lite::Regex::new(r"(?i)(key|api_key|apikey|token|access_token)=([^&\s]+)") {
        out = re.replace_all(&out, "$1=[REDACTED]").to_string();
    }
    out
}

fn safe_error(prefix: &str, err: impl std::fmt::Display, key: &str) -> String {
    redact_secret(&format!("{}：{}", prefix, err), key)
}

fn resolve_temperature(model: &str, requested: Option<f32>) -> f32 {
    let name = model.to_lowercase();
    if name.starts_with("kimi-k2") { return 1.0; }
    requested.unwrap_or(0.8)
}

fn urlencoding(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => result.push(byte as char),
            b' ' => result.push_str("%20"),
            _ => result.push_str(&format!("%{:02X}", byte)),
        }
    }
    result
}

fn extract_provider_error(detail: &str) -> Option<String> {
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(detail) {
        let e = parsed.get("error")?;
        let msg = match e {
            serde_json::Value::String(s) => Some(s.clone()),
            _ => e.get("message").or_else(|| e.get("msg")).or_else(|| e.get("reason")).and_then(|v| v.as_str()).map(String::from),
        };
        return msg;
    }
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(detail) {
        return parsed.get("message").and_then(|v| v.as_str()).map(String::from);
    }
    None
}

fn provider_msg(msg: Option<String>) -> String {
    match msg {
        Some(s) if !s.is_empty() => format!("：{}", &s[..s.len().min(200)]),
        _ => String::new(),
    }
}

fn looks_like_model_error(detail: &str) -> bool {
    let s = detail.to_lowercase();
    s.contains("model not found")
        || s.contains("model_not_found")
        || s.contains("no such model")
        || s.contains("invalid model")
        || s.contains("unknown model")
        || s.contains("model does not exist")
}

trait IntoOption {
    fn into_option(self) -> Option<String>;
}

impl IntoOption for String {
    fn into_option(self) -> Option<String> {
        if self.is_empty() { None } else { Some(self) }
    }
}
