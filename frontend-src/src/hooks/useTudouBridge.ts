import { useState, useCallback, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { httpInvoke, streamInvoke, authLogin, authRegister, authStatus, authRefresh } from "../lib/api-client";
import { emitBridgeEvent } from "../lib/event-bridge";

export type Payload = Record<string, any>;
type WrapKind = "raw" | "payload" | "init" | "taskId" | "projectId" | "projectRename" | "scriptBody" | "authToken" | "authRefresh" | "doctor" | "updatePromptOutput";

interface CommandSpec {
  command: string;
  wrap?: WrapKind;
}

const COMMAND_SPECS: Record<string, CommandSpec> = {
  "auth/login": { command: "auth_login", wrap: "raw" },
  "auth/register": { command: "auth_register", wrap: "raw" },
  "auth/status": { command: "auth_status", wrap: "raw" },
  "auth/refresh": { command: "auth_refresh", wrap: "authRefresh" },
  "auth/set-token": { command: "set_auth_token", wrap: "authToken" },

  "config/get": { command: "get_app_settings", wrap: "raw" },
  "config/set": { command: "save_app_settings", wrap: "payload" },
  "config/test": { command: "test_connection", wrap: "payload" },
  "app/version": { command: "get_version", wrap: "raw" },
  "database/meta": { command: "get_database_meta", wrap: "raw" },
  "prompt/flow-contract": { command: "get_prompt_flow_contract", wrap: "raw" },
  "test_connection": { command: "test_connection", wrap: "payload" },
  "get_database_meta": { command: "get_database_meta", wrap: "raw" },
  "admin/summary": { command: "admin_summary", wrap: "raw" },
  "get_prompt_flow_contract": { command: "get_prompt_flow_contract", wrap: "raw" },

  "project/create": { command: "screenplay_create_project", wrap: "init" },
  "project/get-all": { command: "get_projects", wrap: "raw" },
  "project/rename": { command: "rename_project", wrap: "projectRename" },
  "project/delete": { command: "delete_project", wrap: "projectId" },

  "screenplay/skill-status": { command: "screenplay_skill_status", wrap: "raw" },
  "screenplay_skill_status": { command: "screenplay_skill_status", wrap: "raw" },
  "screenplay/list-recent": { command: "screenplay_list_recent_projects", wrap: "raw" },
  "screenplay/get": { command: "screenplay_get_project", wrap: "projectId" },
  "screenplay/rename": { command: "screenplay_rename_project", wrap: "payload" },
  "screenplay/delete": { command: "screenplay_delete_project", wrap: "projectId" },
  "screenplay/update-structured": { command: "screenplay_update_step_structured", wrap: "payload" },
  "screenplay_update_step_structured": { command: "screenplay_update_step_structured", wrap: "payload" },
  "screenplay/set-step-selection": { command: "screenplay_set_step_selection", wrap: "payload" },
  "screenplay_set_step_selection": { command: "screenplay_set_step_selection", wrap: "payload" },

  "workflow/generate": { command: "screenplay_generate_step", wrap: "payload" },
  "workflow/selfcheck": { command: "screenplay_selfcheck_step", wrap: "payload" },
  "workflow/selfcheck-cached": { command: "screenplay_get_cached_selfcheck", wrap: "payload" },
  "workflow/approve": { command: "screenplay_approve_step", wrap: "payload" },
  "workflow/rollback": { command: "screenplay_rollback_to", wrap: "payload" },
  "workflow/versions": { command: "screenplay_list_versions", wrap: "payload" },
  "workflow/restore-version": { command: "screenplay_restore_version", wrap: "payload" },
  "workflow/finalize": { command: "screenplay_finalize_to_script_task", wrap: "payload" },
  "workflow/get-checkpoint": { command: "screenplay_get_checkpoint", wrap: "payload" },
  "workflow/regenerate-checkpoint": { command: "screenplay_regenerate_checkpoint", wrap: "payload" },
  "workflow/doctor": { command: "doctor_diagnose", wrap: "doctor" },

  "script/recent": { command: "get_recent_script_tasks", wrap: "raw" },
  "script/load": { command: "load_script_task", wrap: "taskId" },
  "script/delete": { command: "delete_script_task", wrap: "taskId" },
  "script/save-draft": { command: "save_script_draft", wrap: "payload" },
  "script/generate": { command: "save_script_generation", wrap: "payload" },
  "script/import": { command: "import_existing_script", wrap: "payload" },
  "script/update-body": { command: "update_script_body", wrap: "scriptBody" },
  "script/review": { command: "run_script_review", wrap: "payload" },

  "series/create": { command: "create_series_project", wrap: "payload" },
  "series/incubate-idea": { command: "longform_incubate_idea", wrap: "payload" },
  "source/import-file": { command: "import_source_file", wrap: "payload" },
  "source/list": { command: "list_source_materials", wrap: "payload" },
  "source/segment": { command: "segment_source_material", wrap: "payload" },
  "source/confirm-chunks": { command: "confirm_source_chunks", wrap: "payload" },
  "source/list-chunks": { command: "list_source_chunks", wrap: "payload" },
  "episode/create-from-sources": { command: "create_episode_from_sources", wrap: "payload" },
  "episode/list": { command: "list_series_episodes", wrap: "payload" },
  "episode/snapshot": { command: "generate_episode_snapshot", wrap: "payload" },
  "episode/next-options": { command: "generate_next_episode_options", wrap: "payload" },

  "asset/extract": { command: "run_asset_extraction", wrap: "payload" },
  "asset/get-all": { command: "get_assets_by_task", wrap: "taskId" },
  "asset/update": { command: "update_assets", wrap: "raw" },
  "asset-sheet/plan": { command: "create_asset_sheet_plan", wrap: "payload" },
  "asset-sheet/crop": { command: "crop_asset_sheet", wrap: "payload" },

  "prompt/image": { command: "run_image_generation", wrap: "payload" },
  "prompt/video": { command: "run_video_generation", wrap: "payload" },
  "prompt/image-review": { command: "run_image_review", wrap: "payload" },
  "prompt/video-review": { command: "run_video_review", wrap: "payload" },
  "prompt/generate-outline": { command: "generate_outline", wrap: "payload" },
  "generate_outline": { command: "generate_outline", wrap: "payload" },
  "prompt/confirm-outline": { command: "confirm_outline", wrap: "payload" },
  "confirm_outline": { command: "confirm_outline", wrap: "payload" },
  "prompt/get-outline": { command: "get_outline", wrap: "taskId" },
  "prompt/run-generation": { command: "run_prompt_generation", wrap: "payload" },
  "run_prompt_generation": { command: "run_prompt_generation", wrap: "payload" },
  "prompt/run-group-generation": { command: "run_prompt_group_generation", wrap: "payload" },
  "run_prompt_group_generation": { command: "run_prompt_group_generation", wrap: "payload" },
  "prompt/get-output": { command: "get_prompt_output_by_task", wrap: "taskId" },
  "get_prompt_output_by_task": { command: "get_prompt_output_by_task", wrap: "taskId" },
  "prompt/update-output": { command: "update_prompt_output", wrap: "updatePromptOutput" },
  "prompt/get-scene-count": { command: "get_scene_count", wrap: "taskId" },
  "get_scene_count": { command: "get_scene_count", wrap: "taskId" },
  "prompt/get-segment-titles": { command: "get_segment_titles", wrap: "taskId" },
  "get_segment_titles": { command: "get_segment_titles", wrap: "taskId" },
  "prompt/quality-check": { command: "run_prompt_quality_check", wrap: "taskId" },
  "run_prompt_quality_check": { command: "run_prompt_quality_check", wrap: "taskId" },
  "image/recent": { command: "get_recent_image_tasks", wrap: "raw" },
  "video/recent": { command: "get_recent_video_tasks", wrap: "raw" },

  "seedance/phase-ad": { command: "seedance_run_phase_ad", wrap: "payload" },
  "seedance/get-analysis": { command: "seedance_get_analysis", wrap: "payload" },
  "seedance/list-units": { command: "seedance_list_units", wrap: "payload" },
  "seedance/get-unit": { command: "seedance_get_unit", wrap: "payload" },
  "seedance/run-unit": { command: "seedance_run_unit", wrap: "payload" },
  "seedance/run-all": { command: "seedance_run_all", wrap: "payload" },

  "visual/save-output": { command: "visual_save_output", wrap: "payload" },
  "visual/list-outputs": { command: "visual_list_outputs", wrap: "payload" },
  "visual/delete-output": { command: "visual_delete_output", wrap: "payload" },
  "visual/update-output-meta": { command: "visual_update_output_meta", wrap: "payload" },
  "visual/mark-copied": { command: "visual_mark_copied", wrap: "payload" },
  "visual/smart-generate-asset-prompt": { command: "visual_smart_generate_asset_prompt", wrap: "payload" },
  "visual/import-external-templates": { command: "visual_import_external_templates", wrap: "raw" },
  "visual/search-templates": { command: "visual_search_templates", wrap: "payload" },
  "visual/get-template": { command: "visual_get_template", wrap: "payload" },
  "visual/export-markdown": { command: "visual_export_markdown", wrap: "payload" },
  "visual/export-json": { command: "visual_export_json", wrap: "payload" },
  "visual/batch-generate": { command: "visual_batch_generate", wrap: "payload" },

  "asset-image/save": { command: "asset_image_save", wrap: "payload" },
  "asset-image/save-file": { command: "asset_image_save_file", wrap: "payload" },
  "asset-image/list": { command: "asset_image_list", wrap: "payload" },
  "asset-image/delete": { command: "asset_image_delete", wrap: "payload" },
  "asset-image/update": { command: "asset_image_update", wrap: "payload" },

  "storyboard/export-local": { command: "export_storyboard_bundle", wrap: "payload" },
};

function pick(payload: Payload, camel: string, snake?: string) {
  return payload[camel] ?? (snake ? payload[snake] : undefined);
}

function toBackendPayload(payload: Payload) {
  const next = { ...payload };
  const pairs: Array<[string, string]> = [
    ["taskId", "task_id"],
    ["projectId", "project_id"],
    ["newBody", "new_body"],
    ["newName", "new_name"],
    ["refreshToken", "refresh_token"],
    ["seedanceGroups", "seedance_groups"],
    ["unitIndex", "unit_index"],
  ];
  for (const [camel, snake] of pairs) {
    if (next[camel] !== undefined && next[snake] === undefined) next[snake] = next[camel];
    if (next[snake] !== undefined && next[camel] === undefined) next[camel] = next[snake];
  }
  return next;
}

function wrapArgs(kind: WrapKind = "raw", payload: Payload = {}) {
  const p = toBackendPayload(payload);
  switch (kind) {
    case "payload":
      return { payload: p };
    case "init":
      return { init: p };
    case "taskId":
      return { taskId: pick(p, "taskId", "task_id") || "" };
    case "projectId":
      return { projectId: pick(p, "projectId", "project_id") || "" };
    case "projectRename":
      return {
        projectId: pick(p, "projectId", "project_id") || "",
        newName: pick(p, "newName", "new_name") || "",
      };
    case "scriptBody":
      return {
        taskId: pick(p, "taskId", "task_id") || "",
        newBody: pick(p, "newBody", "new_body") || "",
      };
    case "authToken":
      return {
        token: p.token || "",
        refreshToken: pick(p, "refreshToken", "refresh_token") || "",
      };
    case "authRefresh":
      return { refreshToken: pick(p, "refreshToken", "refresh_token") || "" };
    case "doctor":
      return {
        question: p.question || "",
        projectId: pick(p, "projectId", "project_id") || "",
      };
    case "updatePromptOutput":
      return {
        taskId: pick(p, "taskId", "task_id") || "",
        seedanceGroups: pick(p, "seedanceGroups", "seedance_groups") || "",
      };
    default:
      return p;
  }
}

function resolveSpec(action: string): CommandSpec {
  return COMMAND_SPECS[action] || { command: action, wrap: "raw" };
}

function isTauriRuntime() {
  return typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
}

const DESKTOP_ONLY_COMMANDS = new Set([
  "export_storyboard_bundle",
]);

const STREAM_COMMANDS = new Set([
  "screenplay_generate_step",
  "screenplay_selfcheck_step",
  "screenplay_regenerate_checkpoint",
  "save_script_generation",
]);

/**
 * 将 Tauri IPC 的 wrapArgs 格式展平为统一的 args 对象（给 HTTP /api/invoke 用）
 * Tauri 需要 `{ payload: {...} }` 的格式，但 HTTP invoke 直接用 args 内容
 */
function flattenForHttp(wrapped: Record<string, any>): Record<string, any> {
  // 如果 wrapped 里只有一个 payload/init key，展平它
  if (wrapped.payload && typeof wrapped.payload === "object" && Object.keys(wrapped).length === 1) {
    return wrapped.payload;
  }
  if (wrapped.init && typeof wrapped.init === "object" && Object.keys(wrapped).length === 1) {
    return wrapped.init;
  }
  return wrapped;
}

/** 处理 auth 类命令 — 走专用 auth 端点 */
async function handleAuthCommand(backendCommand: string, payload: Payload, wrapped: Record<string, any>): Promise<any> {
  switch (backendCommand) {
    case "auth_login":
      return authLogin(payload.username || "", payload.password || "");
    case "auth_register":
      return authRegister(payload.username || "", payload.password || "", payload.email || "");
    case "auth_status":
      return authStatus();
    case "auth_refresh":
      return authRefresh(wrapped.refreshToken || payload.refreshToken || payload.refresh_token || "");
    case "set_auth_token":
      // 在 HTTP 模式下，token 已经存在 localStorage，不需要额外操作
      return { success: true };
    default:
      return null;
  }
}

export const useTudouBridge = () => {
  const [isLoading, setIsLoading] = useState(false);
  const activeRequests = useRef(new Map<string, Promise<any>>());

  const invoke = useCallback(
    async <T = any>(
      action: string,
      payload: Payload = {},
      options: { timeout?: number; silent?: boolean; hideGlobalError?: boolean } = { timeout: 30000, silent: false, hideGlobalError: false }
    ): Promise<T> => {
      const spec = resolveSpec(action);
      const backendCommand = spec.command;
      const backendArgs = wrapArgs(spec.wrap, payload);
      const reqId = `${backendCommand}-${JSON.stringify(backendArgs)}`;
      const effectiveTimeout = options.timeout ?? (backendCommand === "screenplay_get_project" ? 120000 : 30000);

      const existing = activeRequests.current.get(reqId);
      if (existing) return existing as Promise<T>;
      if (!options.silent) setIsLoading(true);

      const request = (async () => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`[IPC Timeout] Command ${backendCommand} 无响应`)), effectiveTimeout)
          );

          const fetchPromise = (async () => {
            // 这些命令保留在 Tauri 本地薄壳中（需要原生能力：文件对话框等）
            const LOCAL_ONLY_COMMANDS = ["get_version", "select_text_file", "select_image_file", "export_storyboard_bundle"];

            if (LOCAL_ONLY_COMMANDS.includes(backendCommand)) {
              if (!isTauriRuntime()) {
                if (DESKTOP_ONLY_COMMANDS.has(backendCommand)) {
                  throw new Error("此操作需要桌面客户端：请在 Tauri 应用中导出本地资料包。");
                }
              } else {
                const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
                const res = await tauriInvoke<T>(backendCommand, backendArgs);
                if (res && typeof res === "object" && "error" in (res as any) && (res as any).error) {
                  throw new Error((res as any).error);
                }
                return res as T;
              }
            }

            // Auth 命令走专用 HTTP 端点
            const AUTH_COMMANDS = ["auth_login", "auth_register", "auth_status", "auth_refresh", "set_auth_token"];
            if (AUTH_COMMANDS.includes(backendCommand)) {
              return await handleAuthCommand(backendCommand, payload, backendArgs) as T;
            }

            const args = flattenForHttp(backendArgs);

            if (STREAM_COMMANDS.has(backendCommand)) {
              const result = await streamInvoke<any>(
                backendCommand,
                args,
                (chunk, data) => {
                  if (backendCommand === "screenplay_generate_step") {
                    emitBridgeEvent("screenplay:stream-chunk", {
                      ...(data || {}),
                      chunk,
                      projectId: data?.projectId ?? args.projectId,
                      stepNumber: data?.stepNumber ?? args.stepNumber,
                    });
                  }
                }
              );
              return result as T;
            }

            // 其他所有命令走 HTTP /api/invoke（无论是否在 Tauri 中运行）
            const res = await httpInvoke<T>(backendCommand, args);
            if (backendCommand === "doctor_diagnose") {
              const text = typeof res === "string" ? res : (res as any)?.text || (res as any)?.answer || "";
              if (text) {
                emitBridgeEvent("doctor:stream-chunk", {
                  chunk: text,
                  projectId: args.projectId,
                });
              }
            }
            if (res && typeof res === "object" && "error" in (res as any) && (res as any).error) throw new Error((res as any).error);
            return res;
          })();

          return await Promise.race([fetchPromise, timeoutPromise]);
        } catch (err: any) {
          const hideGlobalError = options?.hideGlobalError ?? false;
          const errorMessage = err instanceof Error ? err.message : String(err);

          if (!hideGlobalError) {
            useAppStore.getState().setGlobalError({
              title: "底层通信断裂 (IPC Error)",
              action: `${action} → ${backendCommand}`,
              details: errorMessage,
              suggestion: "操作已被打断。请检查输入参数，或返回项目库尝试恢复上下文。",
            });
          }

          throw err;
        } finally {
          activeRequests.current.delete(reqId);
          if (!options.silent) setIsLoading(false);
        }
      })();

      activeRequests.current.set(reqId, request);
      return request;
    },
    []
  );

  return { invoke, isLoading };
};
