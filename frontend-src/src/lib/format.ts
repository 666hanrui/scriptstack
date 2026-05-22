import type { AssetBundle, ProjectRecord, PromptResult, ScriptTask, StepVersion } from "../types/tudou";

export function formatDate(value?: string) {
  if (!value) return "刚刚";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function getActiveVersion(project: ProjectRecord | null | undefined, stepNumber: number): StepVersion | null {
  const bucket = project?.steps?.[String(stepNumber)];
  if (!bucket?.versions?.length) return null;
  return bucket.versions.find((v) => v.isActive || v.is_active) || bucket.versions[bucket.versions.length - 1];
}

export function getTaskId(task: ScriptTask | null | undefined) {
  return task?.taskId || task?.task_id || task?.task?.taskId || task?.task?.task_id || "";
}

export function getProjectId(task: ScriptTask | null | undefined) {
  return task?.projectId || task?.project_id || task?.task?.projectId || task?.task?.project_id || "";
}

export function getProjectName(task: ScriptTask | null | undefined) {
  return task?.projectName || task?.project_name || task?.name || task?.task?.projectName || task?.task?.project_name || task?.task?.name || getTaskId(task);
}

export function getUpdatedAt(task: ScriptTask | null | undefined) {
  return task?.updatedAt || task?.updated_at || task?.createdAt || task?.created_at || task?.task?.updatedAt || task?.task?.updated_at || task?.task?.createdAt || task?.task?.created_at;
}

export function getScriptText(task: ScriptTask | null | undefined): string {
  if (!task) return "";

  const direct = task.scriptBody || task.script_body || task.plotOutline || task.plot_outline || task.body || task.text || task.output;
  if (typeof direct === "string" && direct.trim()) return direct;

  const nestedDirect: string = task.task ? getScriptText(task.task) : "";
  if (nestedDirect) return nestedDirect;

  const outputs = Array.isArray(task.outputs) ? task.outputs : [];
  for (const output of outputs) {
    const text = output.scriptBody || output.script_body || output.plotOutline || output.plot_outline || output.storyboardBase || output.storyboard_base || output.hookOpening || output.hook_opening;
    if (typeof text === "string" && text.trim()) return text;
  }

  return "";
}

export function promptSections(result: PromptResult | null | undefined) {
  const sections = result?.sections || result?.groups || [];
  if (!Array.isArray(sections) || sections.length === 0) {
    const raw = result?.text || result?.prompt || result?.raw || "";
    return raw ? [{ title: "生成结果", lines: [raw] }] : [];
  }
  return sections.map((s: any, index) => ({
    title: s.title || s.name || s.heading || `片段 ${String(index + 1).padStart(2, "0")}`,
    lines: Array.isArray(s.lines) ? s.lines : [s.content || s.prompt || s.text || ""].filter(Boolean),
  }));
}

export function normalizeAssets(rowsOrPayload: any): AssetBundle {
  if (!rowsOrPayload) return { characters: [], scenes: [], props: [] };
  if (rowsOrPayload.characters || rowsOrPayload.scenes || rowsOrPayload.props) {
    return {
      characters: rowsOrPayload.characters || [],
      scenes: rowsOrPayload.scenes || [],
      props: rowsOrPayload.props || [],
    };
  }
  const result: AssetBundle = { characters: [], scenes: [], props: [] };
  for (const row of rowsOrPayload || []) {
    const data = typeof row.assetDataJson === "string" || typeof row.asset_data_json === "string"
      ? readInlineJson(row.assetDataJson || row.asset_data_json)
      : row.assetData || row.asset_data || row;
    const type = row.assetType || row.asset_type;
    if (type === "character" || type === "role") result.characters.push(data);
    if (type === "scene") result.scenes.push(data);
    if (type === "prop") result.props.push(data);
  }
  return result;
}

function readInlineJson(raw: string) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}