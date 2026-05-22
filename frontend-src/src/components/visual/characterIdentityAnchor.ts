/**
 * Character Identity Anchor — 角色视觉身份锚定 v2
 *
 * 整合了 awesome-gpt-image-2 的结构化 JSON 提示词技巧
 * 和业界最佳的"建立-锁定-复用"角色一致性工作流。
 *
 * 核心改进：
 * 1. 使用 JSON-structured prompts（GPT Image 2 最佳实践）
 * 2. 采用 "Identity Block + Variation Block" 分离策略
 * 3. 故事版提示词自动嵌入参考图路径（用于支持 reference image 的平台）
 * 4. 场景/道具资产也可生成对应的一致性锚定
 */

import type { AssetImageRecord } from './AssetImageGallery';

/** 角色视觉身份的标准化结构 */
export interface CharacterVisualIdentity {
  characterId: string;
  name: string;
  appearance: string;
  hairStyle: string;
  bodyType: string;
  clothing: string;
  accessories: string;
  visualAnchor: string;
  colorPalette: string;
  personality: string;
  /** 已保存的角色设计图分类统计 */
  referenceImages: {
    turnaround: number;
    costume: number;
    expression: number;
    reference: number;
    total: number;
    /** 所有参考图的本地文件路径（用于平台上传） */
    paths: string[];
  };
  /** 预生成的一致性提示词片段 */
  consistencyFragment: string;
  /** JSON 结构化的身份档案（用于支持 JSON prompt 的平台） */
  identityJson: string;
}

/** 场景视觉锚定 */
export interface SceneVisualAnchor {
  sceneId: string;
  name: string;
  sceneType: string;
  atmosphere: string;
  materials: string;
  landmarks: string;
  colorTemperature: string;
  referenceImagePaths: string[];
  anchorFragment: string;
}

/** 道具视觉锚定 */
export interface PropVisualAnchor {
  propId: string;
  name: string;
  form: string;
  material: string;
  surfaceState: string;
  referenceImagePaths: string[];
  anchorFragment: string;
}

/** 从资产数据中提取字段，支持多种字段名 */
function readField(data: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const val = data?.[key];
    if (val !== undefined && val !== null && String(val).trim()) return String(val).trim();
  }
  return '';
}

/** 从角色资产数据中提取视觉身份 */
export function extractCharacterIdentity(
  characterId: string,
  name: string,
  data: Record<string, any>,
  images: AssetImageRecord[] = [],
): CharacterVisualIdentity {
  const appearance = readField(data, ['appearance', 'look', 'description', 'visualDescription', '外貌', '描述']);
  const hairStyle = readField(data, ['hairStyle', 'hair', '发型', '头发']);
  const bodyType = readField(data, ['bodyType', 'build', 'physique', '体型']);
  const clothing = readField(data, ['clothing', 'costume', 'wardrobe', '服装', '造型']);
  const accessories = readField(data, ['accessories', 'props', '配饰', '道具']);
  const visualAnchor = readField(data, ['visualAnchor', 'anchor', 'symbol', '核心视觉', '视觉锚点']);
  const colorPalette = readField(data, ['colorPalette', 'palette', 'colors', '色彩', '配色']);
  const personality = readField(data, ['personality', 'temperament', 'motivation', '气质', '性格']);

  // Count reference images by category
  const charImages = images.filter(
    (img) => img.assetType === 'character' && (img.assetId === characterId || img.assetName === name),
  );
  const referenceImages = {
    turnaround: charImages.filter((img) => img.category === 'turnaround').length,
    costume: charImages.filter((img) => img.category === 'costume').length,
    expression: charImages.filter((img) => img.category === 'expression').length,
    reference: charImages.filter((img) => img.category === 'reference').length,
    total: charImages.length,
    paths: charImages.map((img) => img.filePath),
  };

  const consistencyFragment = buildConsistencyFragment(name, {
    appearance,
    hairStyle,
    bodyType,
    clothing,
    accessories,
    visualAnchor,
    colorPalette,
    personality,
    hasReferenceImages: referenceImages.total > 0,
    referenceImageCount: referenceImages.total,
  });

  const identityJson = buildIdentityJson(name, {
    appearance, hairStyle, bodyType, clothing, accessories, visualAnchor, colorPalette,
  });

  return {
    characterId,
    name,
    appearance,
    hairStyle,
    bodyType,
    clothing,
    accessories,
    visualAnchor,
    colorPalette,
    personality,
    referenceImages,
    consistencyFragment,
    identityJson,
  };
}

/** 从场景资产中提取视觉锚定 */
export function extractSceneAnchor(
  sceneId: string,
  name: string,
  data: Record<string, any>,
  images: AssetImageRecord[] = [],
): SceneVisualAnchor {
  const sceneType = readField(data, ['sceneType', 'scene_type', 'spaceType', 'location', '场景类型', '空间类型']);
  const atmosphere = readField(data, ['atmosphere', 'mood', 'tone', '氛围', '情绪']);
  const materials = readField(data, ['materials', 'material', 'texture', '材质']);
  const landmarks = readField(data, ['landmarks', 'details', 'keyObjects', '地标', '关键物件']);
  const colorTemperature = readField(data, ['colorTemperature', 'lightingColor', '色温', '主色调']);

  const sceneImages = images.filter(
    (img) => img.assetType === 'scene' && (img.assetId === sceneId || img.assetName === name),
  );
  const referenceImagePaths = sceneImages.map((img) => img.filePath);

  const lines: string[] = [];
  lines.push(`场景锚点："${name}"`);
  if (sceneType) lines.push(`  类型：${sceneType}`);
  if (atmosphere) lines.push(`  氛围：${atmosphere}`);
  if (materials) lines.push(`  材质与表面：${materials}`);
  if (landmarks) lines.push(`  关键地标：${landmarks}`);
  if (colorTemperature) lines.push(`  色温/主色调：${colorTemperature}`);
  if (referenceImagePaths.length > 0) {
    lines.push(`  参考图：${referenceImagePaths.length} 张，必须匹配已建立的场景设计。`);
  }

  return { sceneId, name, sceneType, atmosphere, materials, landmarks, colorTemperature, referenceImagePaths, anchorFragment: lines.join('\n') };
}

/** 从道具资产中提取视觉锚定 */
export function extractPropAnchor(
  propId: string,
  name: string,
  data: Record<string, any>,
  images: AssetImageRecord[] = [],
): PropVisualAnchor {
  const form = readField(data, ['form', 'shape', 'structure', '形态', '结构']);
  const material = readField(data, ['material', 'materials', '材质']);
  const surfaceState = readField(data, ['surfaceState', 'surface', 'wear', '表面状态']);

  const propImages = images.filter(
    (img) => img.assetType === 'prop' && (img.assetId === propId || img.assetName === name),
  );
  const referenceImagePaths = propImages.map((img) => img.filePath);

  const lines: string[] = [];
  lines.push(`道具锚点："${name}"`);
  if (form) lines.push(`  形态：${form}`);
  if (material) lines.push(`  材质：${material}`);
  if (surfaceState) lines.push(`  表面状态：${surfaceState}`);
  if (referenceImagePaths.length > 0) {
    lines.push(`  参考图：${referenceImagePaths.length} 张，必须匹配已建立的道具设计。`);
  }

  return { propId, name, form, material, surfaceState, referenceImagePaths, anchorFragment: lines.join('\n') };
}

/**
 * 构建 JSON 结构化的身份档案
 * 这种格式对 GPT-4o / GPT Image 2 等模型效果最好
 * 参考 awesome-gpt-image-2 的结构化提示词模式
 */
function buildIdentityJson(
  name: string,
  attrs: {
    appearance: string;
    hairStyle: string;
    bodyType: string;
    clothing: string;
    accessories: string;
    visualAnchor: string;
    colorPalette: string;
  },
): string {
  const profile: Record<string, any> = {
    character_name: name,
    visual_identity: {} as Record<string, string>,
    consistency_rule: 'LOCKED — do NOT alter any visual_identity field across frames',
  };
  if (attrs.appearance) profile.visual_identity.face_and_features = attrs.appearance;
  if (attrs.hairStyle) profile.visual_identity.hair = attrs.hairStyle;
  if (attrs.bodyType) profile.visual_identity.body_type = attrs.bodyType;
  if (attrs.clothing) profile.visual_identity.costume = attrs.clothing;
  if (attrs.accessories) profile.visual_identity.accessories = attrs.accessories;
  if (attrs.visualAnchor) profile.visual_identity.signature_element = attrs.visualAnchor;
  if (attrs.colorPalette) profile.visual_identity.color_palette = attrs.colorPalette;
  return JSON.stringify(profile, null, 2);
}

/** 构建角色一致性指令片段 — 采用 awesome-gpt-image-2 推荐的精细化策略 */
function buildConsistencyFragment(
  name: string,
  attrs: {
    appearance: string;
    hairStyle: string;
    bodyType: string;
    clothing: string;
    accessories: string;
    visualAnchor: string;
    colorPalette: string;
    personality: string;
    hasReferenceImages: boolean;
    referenceImageCount: number;
  },
): string {
  const lines: string[] = [];
  lines.push(`CHARACTER IDENTITY ANCHOR — "${name}"`);
  lines.push('Maintain strict visual consistency with the established character design.');
  lines.push('');

  // Identity Block (永远不变的部分)
  lines.push('── IDENTITY BLOCK (fixed, never change) ──');
  if (attrs.appearance) lines.push(`Face & Features: ${attrs.appearance}`);
  if (attrs.hairStyle) lines.push(`Hair: ${attrs.hairStyle}`);
  if (attrs.bodyType) lines.push(`Build: ${attrs.bodyType}`);
  if (attrs.clothing) lines.push(`Costume: ${attrs.clothing}`);
  if (attrs.accessories) lines.push(`Accessories: ${attrs.accessories}`);
  if (attrs.visualAnchor) lines.push(`Signature Element (Visual Anchor): ${attrs.visualAnchor}`);
  if (attrs.colorPalette) lines.push(`Color Palette: ${attrs.colorPalette}`);
  if (attrs.personality) lines.push(`Screen Presence: ${attrs.personality}`);

  lines.push('');
  lines.push('── RULES ──');
  lines.push('• Same face, same hairstyle, same costume, same body proportion in EVERY frame.');
  lines.push('• The character must be immediately recognizable as the same person.');
  lines.push('• Only action, emotion, camera angle, and environment should change between panels.');

  if (attrs.hasReferenceImages) {
    lines.push('');
    lines.push(`── REFERENCE ──`);
    lines.push(`${attrs.referenceImageCount} reference image(s) have been provided for this character.`);
    lines.push('Prioritize visual features from the reference images over the text description.');
    lines.push('Match the reference image precisely for facial features and clothing details.');
  }

  return lines.join('\n');
}

/** 为一组角色生成统一的一致性指令 */
export function buildMultiCharacterDirective(identities: CharacterVisualIdentity[]): string {
  if (identities.length === 0) return '';

  const lines: string[] = [
    '═══ CROSS-FRAME CHARACTER CONSISTENCY DIRECTIVE ═══',
    `This scene features ${identities.length} character(s). Each MUST maintain pixel-level identity consistency.`,
    '',
  ];

  identities.forEach((identity, index) => {
    lines.push(`┌── Character ${index + 1}: ${identity.name} ──┐`);
    if (identity.appearance) lines.push(`│ Face: ${identity.appearance}`);
    if (identity.hairStyle) lines.push(`│ Hair: ${identity.hairStyle}`);
    if (identity.clothing) lines.push(`│ Costume: ${identity.clothing}`);
    if (identity.visualAnchor) lines.push(`│ Signature: ${identity.visualAnchor}`);
    if (identity.colorPalette) lines.push(`│ Palette: ${identity.colorPalette}`);
    if (identity.referenceImages.total > 0) {
      lines.push(`│ 📎 ${identity.referenceImages.total} reference image(s) — match them precisely`);
    }
    lines.push(`└${'─'.repeat(40)}┘`);
    lines.push('');
  });

  lines.push('ENFORCE: Same face, hair, costume, body proportion, and signature elements across every panel.');
  lines.push('ONLY vary: action, emotion, camera angle, and environment.');

  return lines.join('\n');
}

/**
 * 将角色一致性指令注入到已有提示词中
 * 在提示词末尾附加一致性锚定指令
 */
export function injectConsistencyDirective(
  basePrompt: string,
  identities: CharacterVisualIdentity[],
): string {
  if (identities.length === 0) return basePrompt;
  const directive = buildMultiCharacterDirective(identities);
  return `${basePrompt.trim()}\n\n${directive}`;
}

/**
 * 从镜头数据中提取涉及的角色名列表
 */
export function extractCharacterNamesFromShot(shotData: Record<string, any>): string[] {
  const raw = shotData?.characters || shotData?.character || shotData?.roles || '';
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return String(raw)
    .split(/[,，、;；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 为单个分镜面板构建完整的故事版图片生成提示词（v2）
 *
 * 使用 awesome-gpt-image-2 推荐的 JSON 结构化模式：
 * - 先定义"Identity Block"（角色/场景/道具的视觉锚定）
 * - 再定义"Variation Block"（本帧独有的动作/情绪/机位）
 * - 参考图路径单独列出，方便用户在支持的平台中附带上传
 */
export function buildStoryboardPanelPrompt(panel: {
  sceneTitle: string;
  panelNumber?: number;
  totalPanels?: number;
  shotType: string;
  action: string;
  scriptContent?: string;
  dialogue: string;
  cameraMovement: string;
  mood: string;
  lighting?: string;
  openingFrame?: string;
  closingFrame?: string;
  connection?: string;
  transition?: string;
  mainPrompt?: string;
  mustShow?: string;
  keyBeats?: string[];
  qualityRoute?: string;
  imagingStyle?: string;
  qualityBaseline?: string;
  compulsoryDeclaration?: string;
  characterNames: string[];
  allIdentities: CharacterVisualIdentity[];
  sceneAnchors?: SceneVisualAnchor[];
  propAnchors?: PropVisualAnchor[];
  style?: string;
  /** 需要嵌入的参考图路径 */
  referenceImagePaths?: string[];
}): string {
  const {
    sceneTitle,
    panelNumber,
    totalPanels,
    shotType,
    action,
    scriptContent,
    dialogue,
    cameraMovement,
    mood,
    lighting,
    openingFrame,
    closingFrame,
    connection,
    transition,
    mainPrompt,
    mustShow,
    keyBeats,
    qualityRoute,
    imagingStyle,
    qualityBaseline,
    compulsoryDeclaration,
    characterNames,
    allIdentities,
    sceneAnchors,
    propAnchors,
    style,
  } = panel;

  const involvedIdentities = allIdentities.filter((id) =>
    characterNames.some(
      (name) => id.name === name || id.name.includes(name) || name.includes(id.name),
    ),
  );

  // Collect all reference image paths
  const allRefPaths: string[] = [...(panel.referenceImagePaths || [])];
  involvedIdentities.forEach((id) => {
    allRefPaths.push(...id.referenceImages.paths);
  });
  sceneAnchors?.forEach((sa) => {
    allRefPaths.push(...sa.referenceImagePaths);
  });
  propAnchors?.forEach((pa) => {
    allRefPaths.push(...pa.referenceImagePaths);
  });

  const lines: string[] = [];

  // === SECTION 1: Narrative Block (the user-facing storyboard brief) ===
  lines.push(`=== 故事版镜头 ${String(panelNumber || 1).padStart(2, '0')}${totalPanels ? ` / 共 ${totalPanels} 镜` : ''} ===`);
  lines.push(`镜头标题：${sceneTitle}`);
  if (scriptContent) lines.push(`剧情原文：${scriptContent}`);
  if (keyBeats && keyBeats.length > 0) {
    lines.push(`关键节拍：${keyBeats.join('；')}`);
  }
  lines.push(`本镜任务：${action || mainPrompt || mustShow || '根据剧情生成这一镜的明确画面动作。'}`);
  if (openingFrame) lines.push(`起幅画面：${openingFrame}`);
  if (mainPrompt && mainPrompt !== action) lines.push(`主体动作与画面：${mainPrompt}`);
  if (mustShow) lines.push(`必须出现：${mustShow}`);
  if (closingFrame) lines.push(`落幅画面：${closingFrame}`);
  lines.push(`镜头机位：${shotType || '按剧情选择合适机位'}${cameraMovement ? `；镜头运动：${cameraMovement}` : ''}`);
  if (lighting || qualityRoute || imagingStyle) {
    lines.push(`光线与影像：${[lighting, qualityRoute, imagingStyle].filter(Boolean).join('；')}`);
  }
  if (mood) lines.push(`情绪氛围：${mood}`);
  if (dialogue) lines.push(`对白/台词语境：${dialogue}`);
  if (connection) lines.push(`与上一镜衔接：${connection}`);
  if (transition) lines.push(`与下一镜衔接：${transition}`);
  lines.push('');

  // === SECTION 2: Identity Block (static across frames) ===
  if (involvedIdentities.length > 0) {
    lines.push('=== 角色一致性锚点（固定，不要改脸、发型、服装、身形比例） ===');
    involvedIdentities.forEach((identity) => {
      lines.push(`角色："${identity.name}"`);
      if (identity.appearance) lines.push(`  面部与外貌：${identity.appearance}`);
      if (identity.hairStyle) lines.push(`  发型：${identity.hairStyle}`);
      if (identity.clothing) lines.push(`  服装：${identity.clothing}`);
      if (identity.visualAnchor) lines.push(`  视觉标志：${identity.visualAnchor}`);
      if (identity.colorPalette) lines.push(`  色彩：${identity.colorPalette}`);
      if (identity.referenceImages.total > 0) {
        lines.push(`  参考图：使用已上传参考图作为主要视觉锚点。`);
      }
    });
    lines.push('');
  }

  // === SECTION 3: Scene & Prop Anchors (if applicable) ===
  if (sceneAnchors && sceneAnchors.length > 0) {
    lines.push('=== 本镜关联场景锚点 ===');
    sceneAnchors.forEach((sa) => {
      lines.push(sa.anchorFragment);
    });
    lines.push('');
  }
  if (propAnchors && propAnchors.length > 0) {
    lines.push('=== 本镜关键道具锚点 ===');
    propAnchors.forEach((pa) => {
      lines.push(pa.anchorFragment);
    });
    lines.push('');
  }

  // === SECTION 4: Output Rules ===
  lines.push('=== 输出规则 ===');
  lines.push('• 生成一张故事版单帧画面，不要字幕、水印、Logo、文字覆盖。');
  lines.push('• 画面必须清楚表达本镜剧情动作和起落幅关系，不要只画静物资产。');
  lines.push('• 严格保持角色、场景、道具的一致性，只允许动作、表情、机位和光线随本镜变化。');
  lines.push('• 不要加入本镜没有提到的新角色、新道具或无关空间。');
  if (qualityBaseline) lines.push(`• 画质底线：${qualityBaseline}`);
  if (compulsoryDeclaration) lines.push(`• 强制约束：${compulsoryDeclaration}`);
  if (style) lines.push(`• 视觉风格：${style}`);
  if (involvedIdentities.some((id) => id.referenceImages.total > 0)) {
    lines.push('• 当文字与参考图冲突时，优先保持参考图中的稳定外观。');
  }

  // === SECTION 5: Reference Image Paths (for user to attach) ===
  if (allRefPaths.length > 0) {
    lines.push('');
    lines.push(`=== 参考图附件（使用外部生图平台时一起上传，共 ${allRefPaths.length} 张） ===`);
    const unique = [...new Set(allRefPaths)];
    unique.forEach((path, i) => {
      const filename = path.split('/').pop() || path;
      lines.push(`  ${i + 1}. ${filename}`);
    });
  }

  return lines.join('\n');
}

/**
 * 构建 JSON 格式的故事版分镜提示词
 * 适用于 GPT-4o 等支持 JSON prompt 的平台
 * 参考 awesome-gpt-image-2 的结构化 JSON 提示词模式
 */
export function buildStoryboardPanelJsonPrompt(panel: {
  sceneTitle: string;
  panelNumber: number;
  totalPanels: number;
  shotType: string;
  action: string;
  scriptContent?: string;
  dialogue: string;
  cameraMovement: string;
  mood: string;
  lighting?: string;
  openingFrame?: string;
  closingFrame?: string;
  connection?: string;
  transition?: string;
  mainPrompt?: string;
  mustShow?: string;
  keyBeats?: string[];
  characterNames: string[];
  allIdentities: CharacterVisualIdentity[];
  sceneAnchors?: SceneVisualAnchor[];
  propAnchors?: PropVisualAnchor[];
  style?: string;
}): string {
  const involvedIdentities = panel.allIdentities.filter((id) =>
    panel.characterNames.some(
      (name) => id.name === name || id.name.includes(name) || name.includes(id.name),
    ),
  );

  const promptObj: Record<string, any> = {
    类型: '故事版单帧',
    镜头信息: {
      序号: panel.panelNumber,
      总镜头数: panel.totalPanels,
      标题: panel.sceneTitle,
      剧情原文: panel.scriptContent || '',
      关键节拍: panel.keyBeats || [],
    },
    本镜叙事: {
      本镜任务: panel.action || panel.mainPrompt || panel.mustShow || '',
      起幅画面: panel.openingFrame || '',
      主体动作与画面: panel.mainPrompt || panel.action || '',
      必须出现: panel.mustShow || '',
      落幅画面: panel.closingFrame || '',
      镜头机位: panel.shotType,
      镜头运动: panel.cameraMovement || '',
      情绪氛围: panel.mood,
      光线影像: panel.lighting || '',
      与上一镜衔接: panel.connection || '',
      与下一镜衔接: panel.transition || '',
      对白语境: panel.dialogue || '',
    },
    视觉风格: panel.style || 'cinematic storyboard, film-grade lighting, production-ready composition',
    角色一致性锚点: involvedIdentities.map((id) => {
      const char: Record<string, string> = { name: id.name };
      if (id.appearance) char.面部外貌 = id.appearance;
      if (id.hairStyle) char.发型 = id.hairStyle;
      if (id.clothing) char.服装 = id.clothing;
      if (id.visualAnchor) char.视觉标志 = id.visualAnchor;
      if (id.colorPalette) char.色彩 = id.colorPalette;
      if (id.referenceImages.total > 0) char.参考图 = `${id.referenceImages.total} 张，必须精确匹配`;
      return char;
    }),
    输出规则: {
      文字覆盖: '禁止',
      水印: '禁止',
      额外角色: '禁止',
      剧情表达: '必须清楚表达本镜动作和起落幅关系，不要只画静物资产',
      一致性: '同一角色的脸、发型、服装、身形比例必须稳定',
    },
  };

  if (panel.sceneAnchors && panel.sceneAnchors.length > 0) {
    promptObj.本镜关联场景 = panel.sceneAnchors.map((sa) => {
      const env: Record<string, string> = { name: sa.name };
      if (sa.sceneType) env.类型 = sa.sceneType;
      if (sa.atmosphere) env.氛围 = sa.atmosphere;
      if (sa.materials) env.材质 = sa.materials;
      if (sa.colorTemperature) env.色温 = sa.colorTemperature;
      return env;
    });
  }
  if (panel.propAnchors && panel.propAnchors.length > 0) {
    promptObj.本镜关键道具 = panel.propAnchors.map((pa) => ({
      name: pa.name,
      形态: pa.form,
      材质: pa.material,
      表面: pa.surfaceState,
    }));
  }

  return JSON.stringify(promptObj, null, 2);
}
