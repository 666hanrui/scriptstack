import { useAppStore } from "../store/useAppStore";
import type { Payload } from "../hooks/useTudouBridge";

export async function handleMockIpc(backendCommand: string, backendArgs: any, originalPayload: Payload): Promise<any> {
  console.warn(`[Mock IPC] ${backendCommand}`, backendArgs);

  if (backendCommand === "auth_status") {
    const user = useAppStore.getState().user;
    return user?.token
      ? { loggedIn: true, username: user.username, token: user.token }
      : { loggedIn: false };
  }
  if (backendCommand === "auth_login") return { token: "mock", username: originalPayload.username } as any;
  if (backendCommand === "get_version") return "dev-browser" as any;
  if (backendCommand === "get_app_settings") {
    return {
      textEndpoint: "",
      textKey: "",
      textModel: "deepseek-reasoner",
      textMode: "openai",
      imageEndpoint: "",
      imageKey: "",
      imageModel: "",
      reviewThreshold: 90,
      enableLocalSave: true,
    } as any;
  }
  if (backendCommand === "get_database_meta") {
    return {
      dbPath: "browser-mock",
      dataDir: "browser-mock",
    } as any;
  }
  if (backendCommand === "test_connection") {
    return {
      ok: false,
      latencyMs: 0,
      error: "Browser mock: Tauri IPC unavailable",
    } as any;
  }
  if (backendCommand === "select_text_file") {
    return {
      cancelled: false,
      filePath: "browser-mock/demo.txt",
      fileName: "demo.txt",
      encoding: "utf-8",
      materialType: "novel",
      content: "第一章 初遇\n\n主角在雨夜捡到一把发光的钥匙。\n\n第二章 追兵\n\n门外传来急促脚步声。",
    } as any;
  }
  if (backendCommand === "create_series_project") return { projectId: `mock-series-${Date.now()}`, name: ((backendArgs as any).payload || {}).name || "Mock 长篇项目" } as any;
  if (backendCommand === "import_source_file") {
    const p = (backendArgs as any).payload || {};
    return { projectId: p.projectId || `mock-series-${Date.now()}`, sourceMaterialId: `mock-source-${Date.now()}`, name: p.name || p.fileName || "Mock Source", materialType: p.materialType || "novel", charCount: (p.content || "").length } as any;
  }
  if (backendCommand === "list_source_materials") return [] as any;
  if (backendCommand === "segment_source_material") {
    return { sourceMaterialId: ((backendArgs as any).payload || {}).sourceMaterialId || "mock-source", segments: [
      { chunkIndex: 1, title: "第一章 初遇", startChar: 0, endChar: 30, charCount: 30, preview: "主角在雨夜捡到一把发光的钥匙。", content: "第一章 初遇\n主角在雨夜捡到一把发光的钥匙。" },
      { chunkIndex: 2, title: "第二章 追兵", startChar: 31, endChar: 60, charCount: 29, preview: "门外传来急促脚步声。", content: "第二章 追兵\n门外传来急促脚步声。" },
    ] } as any;
  }
  if (backendCommand === "confirm_source_chunks") return { ...((backendArgs as any).payload || {}), saved: true } as any;
  if (backendCommand === "list_source_chunks") return [] as any;
  if (backendCommand === "create_episode_from_sources") return { episodeId: `mock-ep-${Date.now()}`, projectId: "mock-episode-project", taskId: "mock-task", scriptTaskId: "mock-task", episodeIndex: 1, title: "第 1 集" } as any;
  if (backendCommand === "list_series_episodes") return [] as any;
  if (backendCommand === "generate_episode_snapshot") return { id: `mock-snapshot-${Date.now()}`, snapshot: { endingExitState: "门外传来急促脚步声。" } } as any;
  if (backendCommand === "generate_next_episode_options") return { options: [{ id: "A", title: "承压升级", anchor: "追兵逼近。" }] } as any;
  if (backendCommand === "get_assets_by_task") {
    return [
      {
        id: "mock-characters",
        assetType: "characters",
        assetDataJson: JSON.stringify([
          {
            id: "char-paper-bride",
            name: "纸嫁衣新娘",
            description: "二十岁左右的纸扎新娘，红白纸衣，苍白面孔，眼神空洞。",
            costume: "纸质嫁衣、褪色红盖头、纸扎花纹",
            personality: "安静、阴冷、执念强烈",
          },
        ]),
      },
      {
        id: "mock-scenes",
        assetType: "scenes",
        assetDataJson: JSON.stringify([
          {
            id: "scene-dark-hall",
            name: "黑暗灵堂",
            description: "乡镇老宅里的灵堂，纸人、长明灯、黑白照片和潮湿木梁。",
            atmosphere: "中式恐怖、压抑、微弱烛光",
          },
        ]),
      },
      {
        id: "mock-props",
        assetType: "props",
        assetDataJson: JSON.stringify([
          {
            id: "prop-paper-dress",
            name: "完整纸嫁衣",
            description: "给逝者焚化的纸质嫁衣，边缘有烧焦痕迹。",
            material: "纸、朱砂、细竹篾",
          },
        ]),
      },
    ] as any;
  }
  if (backendCommand === "get_prompt_output_by_task") {
    return {
      taskId: (backendArgs as any).taskId || originalPayload.taskId || "mock-task",
      seedanceGroupsJson: JSON.stringify([
        {
          sceneIndex: 0,
          sceneType: "灵堂近景",
          copyArea: "黑暗灵堂里，纸人缓慢转过头，镜头推近主角停在门外的手。",
          durationSec: 4,
          characters: "纸嫁衣新娘、男主角",
          action: "纸人转头，主角迟疑伸手",
        },
        {
          sceneIndex: 1,
          sceneType: "嫁衣特写",
          copyArea: "一套完整纸嫁衣在火盆上方轻轻浮动，灰烬向上飘。",
          durationSec: 5,
          characters: "纸嫁衣新娘",
          action: "纸嫁衣被无形力量托起",
        },
      ]),
    } as any;
  }
  if (backendCommand === "seedance_list_units") {
    return [
      {
        id: "mock-unit-1",
        unitIndex: 0,
        sceneType: "灵堂近景",
        copyArea: "黑暗灵堂里，纸人缓慢转过头，镜头推近主角停在门外的手。",
        durationSec: 4,
        subShotCount: 2,
        status: "done",
      },
    ] as any;
  }
  if (backendCommand === "visual_import_external_templates") return { imported: 2, total: 2 } as any;
  if (backendCommand === "visual_search_templates") {
    return [
      {
        id: "awesome-gpt-image-2-mock-0001",
        title: "Mock GPT Image Template",
        description: "浏览器预览用的外部模板",
        category: "GPT Image",
        subcategory: "Reference",
        promptText: "Create a cinematic image of {argument name=\"subject\" default=\"a character\"} in {argument name=\"setting\" default=\"a moody room\"}.",
        language: "en",
        author: "YouMind OpenLab",
        originalSourceUrl: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2",
        argumentsJson: JSON.stringify([
          { key: "subject", label: "subject", type: "text", default: "a character" },
          { key: "setting", label: "setting", type: "text", default: "a moody room" },
        ]),
        source: "awesome-gpt-image-2",
        sourceLicense: "CC BY 4.0",
      },
    ] as any;
  }
  if (backendCommand === "visual_list_outputs") return [] as any;
  if (backendCommand === "visual_smart_generate_asset_prompt") {
    const payload = (backendArgs as any).payload || originalPayload || {};
    const assetIds = Array.isArray(payload.assetIds) ? payload.assetIds : ["char-paper-bride"];
    return assetIds.map((assetId: string, index: number) => ({
      id: `mock-smart-visual-${Date.now()}-${index}`,
      projectId: payload.projectId || "mock-project",
      scriptTaskId: payload.taskId || "mock-task",
      assetType: payload.assetTypes?.[0] || "character",
      assetId,
      title: `Mock English AIPROMPT ${index + 1}`,
      promptText: "A cinematic photorealistic character design sheet, cold moonlight, tactile paper costume materials, controlled low-saturation palette, no text, no watermark.",
      promptTextEn: "A cinematic photorealistic character design sheet, cold moonlight, tactile paper costume materials, controlled low-saturation palette, no text, no watermark.",
      reviewTextZh: "电影级写实角色设计表，冷月光，可触摸的纸质服装材质，低饱和统一配色，无文字无水印。",
      generationMode: payload.mode || "image",
      qualityJson: JSON.stringify({ containsChinese: false, hasUnfilledPlaceholders: false }),
      selectedTemplateIdsJson: JSON.stringify(["mock-template"]),
      sourceAssetHash: "mock-hash",
      sourceAssetSnapshotJson: "{}",
    })) as any;
  }
  if (backendCommand === "visual_save_output") {
    return {
      id: `mock-visual-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...((backendArgs as any).payload || {}),
    } as any;
  }
  if (backendCommand === "visual_delete_output") return null as any;
  if (backendCommand === "visual_update_output_meta") {
    return { ...((backendArgs as any).payload || {}), updatedAt: new Date().toISOString() } as any;
  }
  if (backendCommand === "visual_mark_copied") {
    return { ...((backendArgs as any).payload || {}), lastCopiedAt: new Date().toISOString() } as any;
  }
  if (backendCommand === "visual_export_markdown") return "# Mock Visual Prompts\n\n浏览器预览导出。" as any;
  if (backendCommand === "visual_export_json") return "[]" as any;
  if (backendCommand === "visual_batch_generate") return `mock-batch-${Date.now()}` as any;
  if (backendCommand === "create_asset_sheet_plan") {
    return { batches: [{ id: `mock-sheet-${Date.now()}`, title: "Mock 道具资产合板", gridRows: 2, gridCols: 2, prompt: "Create a strict 2x2 prop asset sheet.\nCell map:\n- A1: 完整纸嫁衣", cells: [] }] } as any;
  }
  if (backendCommand === "crop_asset_sheet") return { batchId: ((backendArgs as any).payload || {}).batchId, images: [] } as any;
  if (backendCommand === "get_recent_script_tasks") return [] as any;
  if (backendCommand === "load_script_task") return { task: originalPayload, outputs: [] } as any;
  if (backendCommand === "get_projects") return [] as any;
  if (backendCommand === "screenplay_list_recent_projects") return [] as any;
  if (backendCommand === "screenplay_create_project") return { projectId: "mock-uid-001" } as any;
  
  return { success: true } as any;
}
