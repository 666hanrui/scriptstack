# Patch: wire strict asset update persistence

The strict asset edit persistence service is implemented in:

```text
src-tauri/src/services/asset_extraction.rs
```

The remaining Tauri command wiring is in:

```text
src-tauri/src/lib.rs
```

## Current code

```rust
#[tauri::command]
pub fn update_assets(
    state: State<'_, Mutex<Connection>>,
    task_id: String,
    characters: String,
    scenes: String,
    props: String,
) {
    with_db(&state, |c| {
        crud::update_assets(c, &task_id, &characters, &scenes, &props)
    })
    .ok();
}
```

## Replace with

```rust
#[tauri::command]
pub fn update_assets(
    state: State<'_, Mutex<Connection>>,
    task_id: String,
    characters: String,
    scenes: String,
    props: String,
) -> Result<serde_json::Value, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    crate::services::asset_extraction::update_assets(
        &conn,
        &task_id,
        &characters,
        &scenes,
        &props,
    )
}
```

## Why

The old command swallowed all errors and called `crud::update_assets`, which stored the three arrays as only three records with asset types `characters`, `scenes`, and `props`.

The strict service stores one record per asset and uses the canonical asset types:

```text
character
scene
prop
```

## Validation

```bash
cd /Users/hanrui/rerust/src-tauri
cargo check && cargo test
```

Then run in the app:

```text
/assets -> edit one character, one scene, one prop -> save -> reload
```

Expected:

```text
SQLite asset_records contains per-item rows with asset_type character/scene/prop.
Save failure surfaces a real error to the frontend.
```
