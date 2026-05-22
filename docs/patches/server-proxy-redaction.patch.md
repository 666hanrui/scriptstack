# Patch: redact secrets in server proxy errors

`src-tauri/src/llm/server_proxy.rs` builds Gemini URLs by appending `?key=...`. Network-layer errors or provider errors must never return the key to UI/logs/debug output.

## Required helper

Add near the utility section:

```rust
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
```

## Required replacements

For all request errors that include provider/network details, apply `redact_secret` or `safe_error` before returning.

Examples:

```rust
.map_err(|e| safe_error("Gemini 调用失败", e, &cfg.api_key))?;
```

```rust
let detail = redact_secret(&response.text().await.unwrap_or_default(), &cfg.api_key);
return Err(format!("Gemini 调用失败（{}）：{}", status.as_u16(), &detail[..detail.len().min(200)]));
```

For OpenAI-compatible and Anthropic errors, use the same helper to guard against providers echoing request metadata:

```rust
.map_err(|e| safe_error("OpenAI 调用失败", e, &cfg.api_key))?;
let detail = redact_secret(&response.text().await.unwrap_or_default(), &cfg.api_key);
```

```rust
.map_err(|e| safe_error("Anthropic 调用失败", e, &cfg.api_key))?;
let detail = redact_secret(&response.text().await.unwrap_or_default(), &cfg.api_key);
```

## Validation

```bash
cd /Users/hanrui/rerust/src-tauri
cargo check && cargo test
```

Then intentionally configure a bad Gemini endpoint/key and confirm UI/errors do not show the raw key or URL-encoded key.
