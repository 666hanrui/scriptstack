# IPC Contract Smoke Checklist

This checklist is the Stage 0/1 acceptance baseline. It is not a compile check. Each row must be clicked or invoked inside the real Tauri dev runtime, not in a browser mock.

## Contract rules

1. Rust commands whose signature receives `payload: serde_json::Value` must be called as `{ payload: { ... } }`.
2. Rust scalar command parameters must be called from the frontend with camelCase keys. Examples:
   - Rust `task_id: String` -> frontend `{ taskId }`
   - Rust `project_id: String` -> frontend `{ projectId }`
   - Rust `new_body: String` -> frontend `{ newBody }`
   - Rust `refresh_token: String` -> frontend `{ refreshToken }`
3. Do not use snake_case wrapper keys for scalar Tauri arguments.
4. Payload objects may contain both camelCase and snake_case aliases for backend compatibility.

## Required smoke checks

| Frontend action | Backend command | Wrapper shape | Required test action | Pass condition |
|---|---|---:|---|---|
| `screenplay/get` | `screenplay_get_project` | `{ projectId }` | Open a project from the archive into workflow | No missing arg, returns project record |
| `screenplay/delete` | `screenplay_delete_project` | `{ projectId }` | Delete a workflow project | No missing arg, item disappears |
| `project/delete` | `delete_project` | `{ projectId }` | Delete a SQLite/archive project | No missing arg, item disappears |
| `script/load` | `load_script_task` | `{ taskId }` | Select a script task in `/scripts` | Loads task + outputs |
| `script/update-body` | `update_script_body` | `{ taskId, newBody }` | Save script body edit | Reload keeps edited body |
| `asset/get-all` | `get_assets_by_task` | `{ taskId }` | Open `/assets` for a script task | Existing assets load |
| `asset/update` | `update_assets` | raw scalar/object args | Edit and save an asset card | Reload keeps edits |
| `prompt/get-output` | `get_prompt_output_by_task` | `{ taskId }` | Restore PromptLab output | Restores prompt output record |
| `prompt/quality-check` | `run_prompt_quality_check` | `{ taskId }` | Run quality check | Returns non-timeout result; later must become real check |
| `workflow/doctor` | `doctor_diagnose` | `{ question, projectId }` | Run AI doctor | No missing arg; uses correct project context |
| `seedance/list-units` | `seedance_list_units` | `{ payload: { taskId, task_id } }` | Open `/seedance` for a script task | Units list or empty array loads without arg error |

## Manual test sequence

1. `npm run tauri dev`.
2. Create or open a golden sample workflow project.
3. Run Step 1 generation.
4. Save a manual overwrite and switch away/back.
5. Finalize or select a script task.
6. Open `/scripts`, load and save body.
7. Open `/assets`, load assets, scan once, edit/save one card.
8. Open `/image` or `/video`, restore prompt output or generate outline.
9. Open `/seedance`, load units.
10. Open `/projects`, restore workflow and script task routes.

## Required failure log format

When a row fails, record:

```text
Action:
Backend command:
Frontend args observed:
Rust error / console error:
Expected wrapper:
Actual wrapper:
Fix commit:
```

## Current known non-pass items outside IPC

- `run_prompt_quality_check` still has a placeholder implementation in backend CRUD and must be replaced later.
- Prompt `manifest.json` currently tracks coverage but still needs real byte size and SHA-256 generation from repository bytes.
- AI doctor still reuses checkpoint prompt and needs an independent doctor prompt in a later phase.
- Finalize idempotency still needs backend change to update existing linked script task instead of always creating a new one.
