# Patch: wire real prompt quality check

A real prompt quality check service has been added at:

```text
src-tauri/src/services/prompt_quality.rs
```

and registered in:

```text
src-tauri/src/services/mod.rs
```

The remaining wiring patch should replace the Tauri command body in `src-tauri/src/lib.rs`.

## Current code

```rust
#[tauri::command]
pub fn run_prompt_quality_check(
    state: State<'_, Mutex<Connection>>,
    task_id: String,
) -> Result<serde_json::Value, String> {
    with_db(&state, |c| crud::run_quality_check(c, &task_id))
}
```

## Replace with

```rust
#[tauri::command]
pub fn run_prompt_quality_check(
    state: State<'_, Mutex<Connection>>,
    task_id: String,
) -> Result<serde_json::Value, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    tokio::runtime::Handle::current().block_on(
        crate::services::prompt_quality::run_prompt_quality_check(&conn, &task_id),
    )
}
```

## Expected behavior

The command now:

1. Reads latest `prompt_output_records` by `task_id`.
2. Uses the local prompt slug `prompt_review` from `src-tauri/src/llm/prompts/slug_prompt_review.txt`.
3. Calls the user-configured text model endpoint.
4. Returns normalized JSON:

```json
{
  "passed": false,
  "score": 0,
  "status": "needs_revision",
  "summary": "...",
  "issues": [],
  "suggestions": [],
  "dimensions": [],
  "rawResponse": "...",
  "reviewModel": "..."
}
```

## Validation

```bash
cd /Users/hanrui/rerust
npm run frontend:typecheck
npm run frontend:build
cd src-tauri && cargo check && cargo test
```

Then run a real prompt generation and trigger `prompt/quality-check` from the app. Confirm `$HOME/Library/Application Support/ScriptStack/debug-prompts/prompt_hash_index.jsonl` (or `SCRIPTSTACK_PROMPT_AUDIT_DIR` if overridden) includes a `promptSlug=prompt_review` call.
