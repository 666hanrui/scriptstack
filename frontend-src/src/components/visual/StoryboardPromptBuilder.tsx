/**
 * StoryboardPromptBuilder — 故事版提示词生成器 (v3 重写)
 *
 * 核心逻辑：
 * 1. 加载分镜大纲 → 按场景分组显示镜头
 * 2. 每个镜头卡片直接显示：涉及的角色 + 已保存的参考图缩略图
 * 3. 点击镜头卡片 → 展开生成区域：一键生成带参考图嵌入的提示词
 * 4. 提示词包含：角色身份锚定 + 场景锚定 + 参考图附件列表
 * 5. 复制 → 外部生图 → 回来上传
 *
 * 数据关系：
 *   剧本任务 → 分镜大纲(shots) → 每个shot包含characters字段
 *   资产矩阵 → characters/scenes/props → 每个资产有已保存的images
 *   shot.characters ↔ asset.characters → 自动匹配参考图
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Layers3,
  RefreshCw,
  Save,
  Upload,
} from 'lucide-react';
import { resolveFileSrc } from '../../lib/file-src';
import { useNavigate } from 'react-router-dom';
import { useTudouBridge } from '../../hooks/useTudouBridge';
import { useAppStore } from '../../store/useAppStore';
import { normalizeAssets } from '../../lib/format';
import type { AssetBundle, ScriptTask } from '../../types/tudou';
import ScriptSelector from '../ScriptSelector';
import PageShell from '../ui/PageShell';
import ModuleHeader from '../ui/ModuleHeader';
import Panel from '../ui/Panel';
import ActionBar, { ActionButton } from '../ui/ActionBar';
import EmptyState from '../ui/EmptyState';
import ResultViewer from '../ui/ResultViewer';
import AssetImageGallery, { type AssetImageRecord } from '../visual/AssetImageGallery';
import {
  extractCharacterIdentity,
  extractSceneAnchor,
  extractPropAnchor,
  buildStoryboardPanelPrompt,
  buildStoryboardPanelJsonPrompt,
  buildMultiCharacterDirective,
  extractCharacterNamesFromShot,
  type CharacterVisualIdentity,
  type SceneVisualAnchor,
  type PropVisualAnchor,
} from '../visual/characterIdentityAnchor';

const EMPTY: AssetBundle = { characters: [], scenes: [], props: [] };
const arr = (v: any) => (Array.isArray(v) ? v : []);
const text = (value: any) => (value === undefined || value === null ? '' : String(value).trim());

const STYLES = [
  { id: 'cinematic', label: '电影概念图', style: 'cinematic concept art, film-grade lighting' },
  { id: 'bw', label: '黑白线稿', style: 'clean black-and-white storyboard line art' },
  { id: 'anime', label: '动画分镜', style: 'anime storyboard style, bold lines' },
  { id: 'realistic', label: '写实摄影', style: 'photorealistic production still' },
] as const;

function tid(t: ScriptTask | null) {
  const a = t as any;
  return a?.taskId || a?.task_id || a?.task?.taskId || a?.task?.task_id || '';
}
function pid(t: ScriptTask | null) {
  const a = t as any;
  return a?.projectId || a?.project_id || a?.task?.projectId || a?.task?.project_id || '';
}
function outlineShots(o: any): any[] {
  return Array.isArray(o?.shots || o?.outline?.shots) ? (o?.shots || o?.outline?.shots) : [];
}

function parseJsonMaybe(value: any): any {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readAny(source: any, keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function readArrayAny(source: any, keys: string[]): string[] {
  for (const key of keys) {
    const value = source?.[key];
    if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      const parsed = parseJsonMaybe(value);
      if (Array.isArray(parsed)) return parsed.map((item) => text(item)).filter(Boolean);
      return value.split(/[,，、;；\n]+/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function flattenSeedanceShots(value: any): any[] {
  const parsed = parseJsonMaybe(value);
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => {
      if (Array.isArray(item?.shots)) return item.shots;
      if (Array.isArray(item?.items)) return item.items;
      if (Array.isArray(item?.segments)) return item.segments;
      return [item];
    });
  }
  return flattenSeedanceShots(
    parsed.seedanceGroupsJson ||
      parsed.seedance_groups_json ||
      parsed.seedanceGroups ||
      parsed.seedance_groups ||
      parsed.groups ||
      parsed.shots ||
      parsed.scenes ||
      parsed.segments,
  );
}

function cleanTitleBar(value: string): string {
  const raw = text(value);
  if (!raw) return '';
  const match = raw.match(/分镜\s*0?(\d+)/);
  if (match) return `分镜 ${match[1].padStart(2, '0')}`;
  return raw.replace(/[【】]/g, '').split(/[｜|]/)[0]?.trim() || raw;
}

function clipLine(value: string, max = 140): string {
  const raw = text(value).replace(/\s+/g, ' ');
  return raw.length > max ? `${raw.slice(0, max)}...` : raw;
}

function shotAssetId(index: number) {
  return `storyboard-shot-${index + 1}`;
}

function safeFilePart(value: string, fallback = 'untitled') {
  const raw = text(value) || fallback;
  return raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80) || fallback;
}

function extensionFromImage(image: AssetImageRecord) {
  const nameExt = image.fileName?.split('.').pop()?.toLowerCase();
  if (nameExt && /^[a-z0-9]{2,5}$/.test(nameExt)) return nameExt;
  if (image.mimeType?.includes('webp')) return 'webp';
  if (image.mimeType?.includes('jpeg') || image.mimeType?.includes('jpg')) return 'jpg';
  if (image.mimeType?.includes('gif')) return 'gif';
  return 'png';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function shotTextCorpus(shot: Partial<ShotCard>, extra: any[] = []) {
  return [
    shot.title,
    shot.action,
    shot.scriptContent,
    shot.mainPrompt,
    shot.mustShow,
    shot.openingFrame,
    shot.closingFrame,
    shot.connection,
    shot.transition,
    shot.dialogue,
    shot.mood,
    shot.lighting,
    shot.assetRefs?.join(' '),
    ...extra.map((item) => text(item)),
  ].filter(Boolean).join('\n');
}

function parseAssetRefs(refs: string[]) {
  const out: Array<{ type: 'character' | 'scene' | 'prop'; name: string }> = [];
  const typeMap: Record<string, 'character' | 'scene' | 'prop'> = {
    character: 'character',
    role: 'character',
    characters: 'character',
    角色: 'character',
    人物: 'character',
    scene: 'scene',
    scenes: 'scene',
    场景: 'scene',
    空间: 'scene',
    prop: 'prop',
    props: 'prop',
    道具: 'prop',
    物件: 'prop',
  };
  refs.forEach((raw) => {
    const value = text(raw);
    if (!value) return;
    const re = /(?:\{\{\s*|@)?(character|characters|role|scene|scenes|prop|props|角色|人物|场景|空间|道具|物件)\s*[:：]\s*([^}，,；;\n]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      const type = typeMap[match[1].toLowerCase()] || typeMap[match[1]];
      const name = text(match[2]).replace(/\}\}$/, '').trim();
      if (type && name) out.push({ type, name });
    }
  });
  return out;
}

function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 匹配角色名 → 找到对应的参考图 */
function findImagesForCharacter(name: string, images: AssetImageRecord[]): AssetImageRecord[] {
  return images.filter(
    (img) => img.assetType === 'character' && (img.assetName === name || img.assetName?.includes(name) || name.includes(img.assetName || '')),
  );
}

/** 匹配场景名 → 找到对应的参考图 */
function findImagesForScene(name: string, images: AssetImageRecord[]): AssetImageRecord[] {
  return images.filter(
    (img) => img.assetType === 'scene' && (img.assetName === name || img.assetName?.includes(name)),
  );
}

/** 匹配道具名 → 找到对应的参考图 */
function findImagesForProp(name: string, images: AssetImageRecord[]): AssetImageRecord[] {
  return images.filter(
    (img) => img.assetType === 'prop' && (img.assetName === name || img.assetName?.includes(name) || name.includes(img.assetName || '')),
  );
}

interface ShotCard {
  index: number;
  title: string;
  scriptContent: string;
  action: string;
  camera: string;
  movement: string;
  mood: string;
  lighting: string;
  dialogue: string;
  openingFrame: string;
  closingFrame: string;
  connection: string;
  transition: string;
  mainPrompt: string;
  mustShow: string;
  qualityRoute: string;
  imagingStyle: string;
  qualityBaseline: string;
  reference: string;
  microExpressions: string;
  nailLines: string;
  compulsoryDeclaration: string;
  durationSec?: number;
  keyBeats: string[];
  assetRefs: string[];
  characterNames: string[];
  sceneNames: string[];
  propNames: string[];
  sceneAnchors: SceneVisualAnchor[];
  propAnchors: PropVisualAnchor[];
  /** 这个镜头涉及的角色的参考图 */
  characterImages: AssetImageRecord[];
  /** 这个镜头涉及的场景的参考图 */
  sceneImages: AssetImageRecord[];
  /** 这个镜头涉及的道具的参考图 */
  propImages: AssetImageRecord[];
  /** 所有相关参考图的总数 */
  totalRefImages: number;
  /** 外部平台生成后回传的本镜头故事版图 */
  storyboardImages: AssetImageRecord[];
  hasNarrativeDetail: boolean;
  hasGeneratedDetail: boolean;
}

export default function StoryboardPromptBuilder() {
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const currentTaskId = useAppStore((s) => s.currentTaskId);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const setCurrentTaskId = useAppStore((s) => s.setCurrentTaskId);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const showToast = useAppStore((s) => s.showToast);

  const [outline, setOutline] = useState<any>(null);
  const [promptOutput, setPromptOutput] = useState<any>(null);
  const [seedanceUnits, setSeedanceUnits] = useState<any[]>([]);
  const [assets, setAssets] = useState<AssetBundle>(EMPTY);
  const [images, setImages] = useState<AssetImageRecord[]>([]);
  const [style, setStyle] = useState('cinematic');
  const [promptFormat, setPromptFormat] = useState<'text' | 'json'>('text');
  const [expandedShot, setExpandedShot] = useState<number | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForShot, setUploadForShot] = useState<ShotCard | null>(null);
  const [busy, setBusy] = useState('');

  // Derived data
  const rawShots = useMemo(() => outlineShots(outline), [outline]);
  const seedanceShots = useMemo(
    () => flattenSeedanceShots(promptOutput?.seedanceGroupsJson || promptOutput?.seedance_groups_json || promptOutput),
    [promptOutput],
  );

  const characterIdentities = useMemo(() =>
    arr(assets.characters).map((c: any, i: number) =>
      extractCharacterIdentity(c.id || `c-${i}`, c.name || `角色${i + 1}`, c, images),
    ), [assets.characters, images]);

  const sceneAnchors = useMemo(() =>
    arr(assets.scenes).map((s: any, i: number) =>
      extractSceneAnchor(s.id || `s-${i}`, s.name || `场景${i + 1}`, s, images),
    ), [assets.scenes, images]);

  const propAnchors = useMemo(() =>
    arr(assets.props).map((p: any, i: number) =>
      extractPropAnchor(p.id || `p-${i}`, p.name || `道具${i + 1}`, p, images),
    ), [assets.props, images]);

  /** 每个镜头的卡片数据 — 合并 23 prompt 逐镜结果、outline 和资产锚点 */
  const shotCards: ShotCard[] = useMemo(() => {
    const unitShots = Array.isArray(seedanceUnits) ? seedanceUnits : [];
    const baseShots = rawShots.length > 0 ? rawShots : (seedanceShots.length > 0 ? seedanceShots : unitShots);
    return baseShots.map((shot: any, index: number) => {
      const v2Candidate = seedanceShots[index] || seedanceShots.find((item: any) => {
        const sceneIndex = Number(item?.sceneIndex ?? item?.scene_index ?? item?.index);
        const shotNumber = Number(item?.shotNumber ?? item?.shot_number);
        return sceneIndex === index || shotNumber === index + 1;
      }) || {};
      const unit = unitShots[index] || unitShots.find((item: any) => Number(item?.unitIndex ?? item?.unit_index ?? item?.index) === index) || {};
      const v2 = Object.keys(v2Candidate).length > 0 ? v2Candidate : unit;
      const nextV2 = seedanceShots[index + 1] || {};
      const title = readAny(shot, ['title', 'shotTitle', 'shot_title', 'name']) ||
        cleanTitleBar(readAny(v2, ['titleBar', 'title_bar'])) ||
        readAny(v2, ['title', 'name']) ||
        `镜头 ${index + 1}`;
      const scriptContent = readAny(shot, ['scriptContent', 'script_content', 'copyArea', 'copy_area', 'content', 'description']) ||
        readAny(v2, ['scriptContent', 'script_content', 'copyArea', 'copy_area']);
      const keyBeats = readArrayAny(shot, ['keyBeats', 'key_beats', 'beats']);
      const assetRefs = [
        ...readArrayAny(v2, ['assetRefs', 'asset_refs']),
        ...readArrayAny(shot, ['assetRefs', 'asset_refs']),
      ];
      const openingFrame = readAny(v2, ['openingFrame', 'opening_frame']);
      const closingFrame = readAny(v2, ['closingFrame', 'closing_frame']);
      const connection = readAny(v2, ['connection']);
      const transition = readAny(v2, ['transition']) || readAny(nextV2, ['connection']);
      const mainPrompt = readAny(v2, ['mainPrompt', 'main_prompt']);
      const mustShow = readAny(v2, ['mustShow', 'must_show']);
      const action = readAny(shot, ['action', 'description', 'copyArea', 'copy_area', 'content']) ||
        mainPrompt ||
        mustShow ||
        [openingFrame, closingFrame].filter(Boolean).join(' → ') ||
        scriptContent;
      const camera = readAny(v2, ['camera']) ||
        readAny(shot, ['camera', 'cameraType', 'camera_type', 'shotType', 'shot_type']) ||
        readAny(v2, ['shotType', 'shot_type']) ||
        '中景';
      const movement = readAny(shot, ['cameraMovement', 'camera_movement', 'movement']) ||
        readAny(v2, ['mount', 'dualAnchor', 'dual_anchor']);
      const mood = readAny(shot, ['emotion', 'mood', 'atmosphere']) ||
        readAny(v2, ['microExpressions', 'micro_expressions', 'e15']);
      const lighting = readAny(shot, ['lighting', 'light']) ||
        readAny(v2, ['qualityRoute', 'quality_route', 'imagingStyle', 'imaging_style']);
      const dialogue = readAny(shot, ['dialogue', 'line', 'lines']) ||
        readAny(v2, ['nailLines', 'nail_lines']);

      const roughCard: Partial<ShotCard> = {
        index,
        title,
        scriptContent,
        action,
        camera,
        movement,
        mood,
        lighting,
        dialogue,
        openingFrame,
        closingFrame,
        connection,
        transition,
        mainPrompt,
        mustShow,
        assetRefs,
        keyBeats,
      };
      const corpus = shotTextCorpus(roughCard, keyBeats);
      const parsedRefs = parseAssetRefs(assetRefs);

      const explicitCharacters = parsedRefs.filter((ref) => ref.type === 'character').map((ref) => ref.name);
      const extractedCharacters = [
        ...extractCharacterNamesFromShot(shot),
        ...extractCharacterNamesFromShot(v2),
      ];
      const matchedCharacters = characterIdentities
        .filter((identity) => corpus.includes(identity.name))
        .map((identity) => identity.name);
      const characterNames = [...new Set([...explicitCharacters, ...extractedCharacters, ...matchedCharacters].filter(Boolean))];

      const explicitScenes = parsedRefs.filter((ref) => ref.type === 'scene').map((ref) => ref.name);
      const matchedScenes = sceneAnchors.filter((anchor) =>
        explicitScenes.some((name) => anchor.name === name || anchor.name.includes(name) || name.includes(anchor.name)) ||
        corpus.includes(anchor.name),
      );
      const scopedSceneAnchors = uniqueByName(matchedScenes.length > 0 ? matchedScenes : (sceneAnchors.length === 1 ? sceneAnchors : []));
      const sceneNames = scopedSceneAnchors.map((anchor) => anchor.name);

      const explicitProps = parsedRefs.filter((ref) => ref.type === 'prop').map((ref) => ref.name);
      const scopedPropAnchors = uniqueByName(propAnchors.filter((anchor) =>
        explicitProps.some((name) => anchor.name === name || anchor.name.includes(name) || name.includes(anchor.name)) ||
        corpus.includes(anchor.name),
      ));
      const propNames = scopedPropAnchors.map((anchor) => anchor.name);

      const characterImages = characterNames.flatMap((name) => findImagesForCharacter(name, images));
      const sceneImages = sceneNames.flatMap((name) => findImagesForScene(name, images));
      const propImages = propNames.flatMap((name) => findImagesForProp(name, images));
      const currentShotAssetId = shotAssetId(index);
      const storyboardImages = images.filter((img) =>
        img.assetType === 'shot' &&
        (img.assetId === currentShotAssetId || (img as any).asset_id === currentShotAssetId),
      );

      return {
        index,
        title,
        scriptContent,
        action,
        camera,
        movement,
        mood,
        lighting,
        dialogue,
        openingFrame,
        closingFrame,
        connection,
        transition,
        mainPrompt,
        mustShow,
        qualityRoute: readAny(v2, ['qualityRoute', 'quality_route']),
        imagingStyle: readAny(v2, ['imagingStyle', 'imaging_style']),
        qualityBaseline: readAny(v2, ['qualityBaseline', 'quality_baseline']),
        reference: readAny(v2, ['reference']),
        microExpressions: readAny(v2, ['microExpressions', 'micro_expressions']),
        nailLines: readAny(v2, ['nailLines', 'nail_lines']),
        compulsoryDeclaration: readAny(v2, ['compulsoryDeclaration', 'compulsory_declaration']),
        durationSec: Number(v2?.durationSec ?? v2?.duration_sec ?? 0) || undefined,
        keyBeats,
        assetRefs,
        characterNames,
        sceneNames,
        propNames,
        sceneAnchors: scopedSceneAnchors,
        propAnchors: scopedPropAnchors,
        characterImages,
        sceneImages,
        propImages,
        totalRefImages: characterImages.length + sceneImages.length + propImages.length,
        storyboardImages,
        hasNarrativeDetail: Boolean(openingFrame || closingFrame || connection || transition || mainPrompt || scriptContent || keyBeats.length),
        hasGeneratedDetail: Boolean(openingFrame || closingFrame || connection || transition || mainPrompt || mustShow || readAny(v2, ['copyArea', 'copy_area'])),
      };
    });
  }, [rawShots, seedanceShots, seedanceUnits, images, characterIdentities, sceneAnchors, propAnchors]);

  // Load data
  const loadAll = useCallback(async (taskId: string, projectId: string) => {
    if (!taskId) return;
    setBusy('load');
    try {
      const [o, output, units, a, imgs] = await Promise.all([
        invoke<any>('prompt/get-outline', { taskId }, { silent: true }).catch(() => null),
        invoke<any>('prompt/get-output', { taskId }, { silent: true }).catch(() => null),
        invoke<any[]>('seedance/list-units', { taskId }, { silent: true }).catch(() => []),
        invoke<any[]>('asset/get-all', { taskId }, { silent: true }).catch(() => []),
        projectId
          ? invoke<AssetImageRecord[]>('asset-image/list', { projectId }, { silent: true }).catch(() => [])
          : Promise.resolve([]),
      ]);
      setOutline(o);
      setPromptOutput(output);
      setSeedanceUnits(Array.isArray(units) ? units : []);
      setAssets(normalizeAssets(a));
      setImages(Array.isArray(imgs) ? imgs : []);
    } catch { /* */ }
    finally { setBusy(''); }
  }, [invoke]);

  useEffect(() => {
    if (currentTaskId) loadAll(currentTaskId, currentProjectId || '');
  }, [currentTaskId, currentProjectId, loadAll]);

  const onSelectScript = (task: ScriptTask, _text: string) => {
    const t = tid(task), p = pid(task);
    setOutline(null); setPromptOutput(null); setSeedanceUnits([]); setAssets(EMPTY); setImages([]);
    setExpandedShot(null); setGeneratedPrompt('');
    if (t) setCurrentTaskId(t);
    if (p) setCurrentProjectId(p);
    if (t) loadAll(t, p);
  };

  const buildPromptForCard = useCallback((card: ShotCard, format: 'text' | 'json' = promptFormat) => {
    const styleText = STYLES.find((s) => s.id === style)?.style || style;
    if (format === 'json') {
      return buildStoryboardPanelJsonPrompt({
        sceneTitle: card.title,
        panelNumber: card.index + 1,
        totalPanels: shotCards.length,
        shotType: card.camera,
        action: card.action,
        scriptContent: card.scriptContent,
        dialogue: card.dialogue,
        cameraMovement: card.movement,
        mood: card.mood,
        lighting: card.lighting,
        openingFrame: card.openingFrame,
        closingFrame: card.closingFrame,
        connection: card.connection,
        transition: card.transition,
        mainPrompt: card.mainPrompt,
        mustShow: card.mustShow,
        keyBeats: card.keyBeats,
        characterNames: card.characterNames,
        allIdentities: characterIdentities,
        sceneAnchors: card.sceneAnchors.length > 0 ? card.sceneAnchors : undefined,
        propAnchors: card.propAnchors.length > 0 ? card.propAnchors : undefined,
        style: styleText,
      });
    }

    return buildStoryboardPanelPrompt({
      sceneTitle: card.title,
      panelNumber: card.index + 1,
      totalPanels: shotCards.length,
      shotType: card.camera,
      action: card.action,
      scriptContent: card.scriptContent,
      dialogue: card.dialogue,
      cameraMovement: card.movement,
      mood: card.mood,
      lighting: card.lighting,
      openingFrame: card.openingFrame,
      closingFrame: card.closingFrame,
      connection: card.connection,
      transition: card.transition,
      mainPrompt: card.mainPrompt,
      mustShow: card.mustShow,
      keyBeats: card.keyBeats,
      qualityRoute: card.qualityRoute,
      imagingStyle: card.imagingStyle,
      qualityBaseline: card.qualityBaseline,
      compulsoryDeclaration: card.compulsoryDeclaration,
      characterNames: card.characterNames,
      allIdentities: characterIdentities,
      sceneAnchors: card.sceneAnchors.length > 0 ? card.sceneAnchors : undefined,
      propAnchors: card.propAnchors.length > 0 ? card.propAnchors : undefined,
      style: styleText,
      referenceImagePaths: [
        ...card.characterImages.map((img) => img.filePath),
        ...card.sceneImages.map((img) => img.filePath),
        ...card.propImages.map((img) => img.filePath),
      ],
    });
  }, [characterIdentities, promptFormat, shotCards.length, style]);

  /** 为一个镜头生成提示词 */
  const generateForShot = (card: ShotCard) => {
    setGeneratedPrompt(buildPromptForCard(card));
    setExpandedShot(card.index);
    setShowUpload(false);
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    showToast({ message: '提示词已复制', type: 'success' });
  };

  const savePrompt = async (card: ShotCard) => {
    if (!generatedPrompt || !currentProjectId) return;
    try {
      await invoke('visual/save-output', {
        projectId: currentProjectId,
        scriptTaskId: currentTaskId || '',
        assetType: 'shot',
        assetId: `storyboard-shot-${card.index + 1}`,
        shotId: `storyboard-shot-${card.index + 1}`,
        outputType: 'storyboard',
        title: `故事版 #${card.index + 1}: ${card.title}`,
        promptText: generatedPrompt,
        promptTextEn: '',
        reviewTextZh: generatedPrompt,
        generationMode: 'storyboard',
        promptLanguage: 'zh',
        platformPreset: 'generic',
      });
      showToast({ message: '已保存', type: 'success' });
    } catch (e: any) {
      showToast({ message: e?.message || '保存失败', type: 'error' });
    }
  };

  /** 一次性生成全部并复制 */
  const generateAndCopyAll = () => {
    if (shotCards.length === 0) return;
    const allPrompts = shotCards.map((card) => {
      const prompt = buildPromptForCard(card, 'text');
      return `=== #${card.index + 1} ${card.title} ===\n\n${prompt}`;
    }).join('\n\n---\n\n');
    navigator.clipboard.writeText(allPrompts);
    showToast({ message: `全部 ${shotCards.length} 个提示词已复制`, type: 'success' });
  };

  const toImageBundleFile = async (image: AssetImageRecord, relativePath: string) => {
    const response = await fetch(resolveFileSrc(image.filePath));
    if (!response.ok) throw new Error(`图片读取失败：${image.assetName || image.fileName}`);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    return {
      relativePath,
      content: dataUrl,
      encoding: 'base64',
    };
  };

  const exportLocalBundle = async () => {
    if (!currentTaskId || shotCards.length === 0) {
      showToast({ message: '没有可导出的故事版镜头', type: 'error' });
      return;
    }
    setBusy('export');
    try {
      const exportedAt = new Date().toISOString();
      const bundleName = `ScriptStack_Storyboard_${safeFilePart(currentTaskId)}_${exportedAt.slice(0, 10)}`;
      const files: Array<{ relativePath: string; content: string; encoding?: string }> = [];
      const manifestShots: any[] = [];
      const skippedImages: Array<{ shot: number; imageId: string; reason: string }> = [];

      files.push({
        relativePath: 'README.md',
        content: [
          '# ScriptStack 故事版资料包',
          '',
          `- Script Task: ${currentTaskId}`,
          `- Project: ${currentProjectId || 'N/A'}`,
          `- Exported At: ${exportedAt}`,
          `- Shots: ${shotCards.length}`,
          '',
          '每个 shot_xxx 文件夹内包含该镜头的中文提示词、镜头 manifest、参考图 references，以及用户回传的 generated 故事版图。',
        ].join('\n'),
      });

      for (const card of shotCards) {
        const shotDir = `shot_${String(card.index + 1).padStart(3, '0')}_${safeFilePart(card.title, `shot_${card.index + 1}`)}`;
        const prompt = buildPromptForCard(card, 'text');
        const refImages = [
          ...card.characterImages.map((image) => ({ image, group: 'character' })),
          ...card.sceneImages.map((image) => ({ image, group: 'scene' })),
          ...card.propImages.map((image) => ({ image, group: 'prop' })),
        ];
        const generatedImages = card.storyboardImages.map((image) => ({ image, group: 'storyboard' }));

        files.push({
          relativePath: `${shotDir}/prompt_zh.txt`,
          content: prompt,
        });

        files.push({
          relativePath: `${shotDir}/shot_manifest.json`,
          content: JSON.stringify({
            index: card.index + 1,
            title: card.title,
            action: card.action,
            scriptContent: card.scriptContent,
            openingFrame: card.openingFrame,
            closingFrame: card.closingFrame,
            connection: card.connection,
            transition: card.transition,
            camera: card.camera,
            movement: card.movement,
            mood: card.mood,
            lighting: card.lighting,
            characterNames: card.characterNames,
            sceneNames: card.sceneNames,
            propNames: card.propNames,
            referenceImageCount: refImages.length,
            generatedImageCount: generatedImages.length,
          }, null, 2),
        });

        for (const { image, group } of refImages) {
          const fileName = `${group}_${safeFilePart(image.assetName || image.fileName, group)}_${safeFilePart(image.id, 'img')}.${extensionFromImage(image)}`;
          try {
            files.push(await toImageBundleFile(image, `${shotDir}/references/${fileName}`));
          } catch (err: any) {
            skippedImages.push({ shot: card.index + 1, imageId: image.id, reason: err?.message || '读取失败' });
          }
        }

        for (const { image, group } of generatedImages) {
          const fileName = `${group}_${safeFilePart(image.fileName || image.id, 'generated')}.${extensionFromImage(image)}`;
          try {
            files.push(await toImageBundleFile(image, `${shotDir}/generated/${fileName}`));
          } catch (err: any) {
            skippedImages.push({ shot: card.index + 1, imageId: image.id, reason: err?.message || '读取失败' });
          }
        }

        manifestShots.push({
          index: card.index + 1,
          title: card.title,
          directory: shotDir,
          promptFile: `${shotDir}/prompt_zh.txt`,
          referenceImages: refImages.length,
          generatedImages: generatedImages.length,
        });
      }

      files.push({
        relativePath: 'manifest.json',
        content: JSON.stringify({
          projectId: currentProjectId || '',
          taskId: currentTaskId,
          exportedAt,
          shotCount: shotCards.length,
          style,
          promptFormat: 'text',
          skippedImages,
          shots: manifestShots,
        }, null, 2),
      });

      const result = await invoke<any>('storyboard/export-local', {
        bundleName,
        files,
        openFolder: true,
      }, { timeout: 180000 });

      if (!result?.cancelled) {
        showToast({
          message: `故事版资料包已导出：${result.filesWritten || files.length} 个文件`,
          type: skippedImages.length ? 'info' : 'success',
        });
      }
    } catch (err: any) {
      showToast({ message: err?.message || '故事版导出失败', type: 'error' });
    } finally {
      setBusy('');
    }
  };

  const narrativeDetailCount = shotCards.filter((card) => card.hasNarrativeDetail).length;
  const generatedDetailCount = shotCards.filter((card) => card.hasGeneratedDetail).length;
  const isOutlineOnly = shotCards.length > 0 && seedanceShots.length === 0;
  const isPartiallyGenerated = shotCards.length > 0 && generatedDetailCount > 0 && generatedDetailCount < shotCards.length;

  return (
    <PageShell maxWidth="max-w-7xl">
      <ModuleHeader
        icon={<Clapperboard size={24} />}
        eyebrow="Storyboard"
        title="故事版提示词"
        actions={
          <ActionBar align="right">
            <ActionButton variant="secondary" onClick={() => navigate('/visual-prompts')} icon={<ImageIcon size={16} />}>视觉工坊</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/frame-prompt')} icon={<Layers3 size={16} />}>逐镜</ActionButton>
          </ActionBar>
        }
      />

      {/* Top bar: script selector + config — all in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 mb-6">
        <Panel title="剧本" noPadding>
          <div className="p-3">
            <ScriptSelector selectedTaskId={currentTaskId} onSelect={onSelectScript} />
          </div>
        </Panel>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${
                  style === s.id ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200' : 'border-white/[0.06] text-white/35 hover:text-white/60'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex gap-1">
            {(['text', 'json'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPromptFormat(f)}
                className={`text-[10px] px-2 py-1 rounded border transition-all ${
                  promptFormat === f ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'border-white/[0.06] text-white/30'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-white/10" />
          <ActionButton size="sm" variant="ghost" onClick={() => loadAll(currentTaskId || '', currentProjectId || '')} isLoading={busy === 'load'} icon={<RefreshCw size={12} />}>刷新</ActionButton>
          {shotCards.length > 0 && (
            <>
              <ActionButton size="sm" variant="secondary" onClick={generateAndCopyAll} icon={<Copy size={12} />}>全部复制</ActionButton>
              <ActionButton size="sm" onClick={exportLocalBundle} isLoading={busy === 'export'} icon={<Download size={12} />}>导出资料包</ActionButton>
            </>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-[11px] text-white/40 mb-4 px-1">
        <span>{shotCards.length} 个镜头</span>
        <span>{narrativeDetailCount}/{shotCards.length || 0} 个镜头有逐镜叙事</span>
        <span>{generatedDetailCount}/{shotCards.length || 0} 个镜头有生成级细节</span>
        <span>{characterIdentities.length} 个角色</span>
        <span>{images.filter((i) => i.assetType === 'character').length} 张角色图</span>
        <span>{images.filter((i) => i.assetType === 'scene').length} 张场景图</span>
      </div>

      {isOutlineOnly && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-sm text-amber-100/80">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <div className="font-bold text-amber-100">当前只有大纲级分镜，故事版动作和镜头衔接会偏薄。</div>
            <div className="mt-1 text-xs leading-relaxed text-amber-100/65">
              建议先到「逐镜」页面生成单镜提示词；本页会自动合并逐镜结果、角色、场景和道具锚点。
            </div>
          </div>
        </div>
      )}

      {isPartiallyGenerated && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-sm text-amber-100/80">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <div className="font-bold text-amber-100">逐镜增强数据不完整：当前只有 {generatedDetailCount}/{shotCards.length} 个镜头有生成级细节。</div>
            <div className="mt-1 text-xs leading-relaxed text-amber-100/65">
              已增强的镜头会合并起幅、落幅、转场和资产引用；其余镜头会暂时使用大纲原文，建议回到「逐镜」页面补齐全部镜头。
            </div>
          </div>
        </div>
      )}

      {/* Main content: shot cards */}
      {shotCards.length === 0 ? (
        <EmptyState
          title="暂无分镜数据"
          description={currentTaskId ? '请先在「逐镜」页面生成分镜大纲。' : '请先选择剧本任务。'}
          icon={<Film size={32} />}
        />
      ) : (
        <div className="space-y-3">
          {shotCards.map((card) => {
            const isExpanded = expandedShot === card.index;
            return (
              <div
                key={card.index}
                className={`rounded-2xl border transition-all ${
                  isExpanded ? 'border-indigo-500/30 bg-indigo-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                }`}
              >
                {/* Shot card header — always visible */}
                <button
                  onClick={() => {
                    if (isExpanded) { setExpandedShot(null); setGeneratedPrompt(''); }
                    else generateForShot(card);
                  }}
                  className="w-full flex items-start gap-4 p-4 text-left"
                >
                  {/* Shot number */}
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-sm font-bold text-white/50">
                    {card.index + 1}
                  </div>

                  {/* Shot info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white/80 mb-1">{card.title}</div>
                    <div className="text-[11px] text-white/45 line-clamp-2">
                      {clipLine(card.action || card.scriptContent || '这个镜头还缺少明确动作，请先补齐逐镜生成。', 180)}
                    </div>
                    {(card.openingFrame || card.closingFrame || card.connection || card.transition) && (
                      <div className="mt-2 grid gap-1 text-[10px] text-white/32">
                        {card.openingFrame && <div className="line-clamp-1">起幅：{clipLine(card.openingFrame, 120)}</div>}
                        {card.closingFrame && <div className="line-clamp-1">落幅：{clipLine(card.closingFrame, 120)}</div>}
                        {card.connection && <div className="line-clamp-1">承接：{clipLine(card.connection, 120)}</div>}
                        {card.transition && <div className="line-clamp-1">转场：{clipLine(card.transition, 120)}</div>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        card.hasGeneratedDetail ? 'bg-emerald-500/10 text-emerald-300/70' : 'bg-amber-500/10 text-amber-300/70'
                      }`}>
                        {card.hasGeneratedDetail ? '逐镜增强' : '大纲回退'}
                      </span>
                      {card.durationSec ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30">{card.durationSec}s</span>
                      ) : null}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 font-mono">{clipLine(card.camera, 42)}</span>
                      {card.mood && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300/60">{card.mood}</span>}
                      {card.sceneNames.map((name) => (
                        <span key={`scene-${name}`} className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-200/60">{name}</span>
                      ))}
                      {card.propNames.slice(0, 4).map((name) => (
                        <span key={`prop-${name}`} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-200/60">{name}</span>
                      ))}
                      {card.propNames.length > 4 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-200/40">+{card.propNames.length - 4} 道具</span>
                      )}
                    </div>
                  </div>

                  {/* Character thumbnails — the key relationship visualization */}
                  <div className="shrink-0 flex items-center gap-2">
                    {/* Character name badges */}
                    {card.characterNames.map((name) => (
                      <span key={name} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono">{name}</span>
                    ))}

                    {/* Reference image thumbnails */}
                    {[...card.characterImages, ...card.sceneImages, ...card.propImages].slice(0, 3).map((img, i) => (
                      <div key={img.id || i} className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0">
                        <img src={resolveFileSrc(img.filePath)} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                    {card.totalRefImages > 3 && (
                      <span className="text-[9px] text-white/25">+{card.totalRefImages - 3}</span>
                    )}

                    {/* Expand indicator */}
                    {isExpanded ? <ChevronDown size={14} className="text-indigo-400" /> : <ChevronRight size={14} className="text-white/20" />}
                  </div>
                </button>

                {/* Expanded: generated prompt + reference images detail + actions */}
                {isExpanded && generatedPrompt && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04]">
                    {/* Reference images for this shot */}
                    {card.totalRefImages > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-white/40 mb-2 mt-3">
                          此镜头关联的参考图（复制提示词时一起上传到生图平台）
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {[...card.characterImages, ...card.sceneImages, ...card.propImages].map((img, i) => (
                            <div key={img.id || i} className="group relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                              <img src={resolveFileSrc(img.filePath)} alt={img.assetName || ''} className="w-full h-full object-cover" loading="lazy" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                                <span className="text-[8px] text-white/80 text-center px-1">{img.assetName}</span>
                                <span className="text-[7px] text-white/40">{img.category}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {card.storyboardImages.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-white/40 mb-2 mt-3">
                          本镜头已回传的故事版图（导出资料包时会放入 generated 文件夹）
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {card.storyboardImages.map((img, i) => (
                            <div key={img.id || i} className="group relative w-20 h-14 rounded-lg overflow-hidden border border-emerald-500/20">
                              <img src={resolveFileSrc(img.filePath)} alt={img.assetName || ''} className="w-full h-full object-cover" loading="lazy" />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                                <span className="text-[8px] text-white/80 text-center px-1">{img.fileName}</span>
                                <span className="text-[7px] text-white/40">{img.category}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generated prompt */}
                    <ResultViewer maxHeight="max-h-[300px]" title={`PANEL ${card.index + 1}`} content={generatedPrompt} />

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <ActionButton size="sm" onClick={copyPrompt} icon={<Copy size={12} />}>复制提示词</ActionButton>
                      <ActionButton size="sm" variant="secondary" onClick={() => savePrompt(card)} icon={<Save size={12} />}>保存</ActionButton>
                      <ActionButton
                        size="sm"
                        variant="ghost"
                        onClick={() => { setShowUpload(!showUpload); setUploadForShot(card); }}
                        icon={<Upload size={12} />}
                      >
                        {showUpload ? '收起' : '上传生成的图'}
                      </ActionButton>
                    </div>

                    {/* Inline upload */}
                    {showUpload && (
                      <div className="rounded-xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.03] p-3">
                        <div className="text-[10px] text-white/40 mb-2">
                          把外部生成的图片保存到这个镜头下；导出资料包时会和本镜头提示词放在同一个文件夹。
                        </div>
                        <AssetImageGallery
                          assetType="shot"
                          assetId={shotAssetId(card.index)}
                          assetName={`镜头 ${String(card.index + 1).padStart(2, '0')} · ${card.title}`}
                          defaultCategory="storyboard"
                          onImagesChanged={() => loadAll(currentTaskId || '', currentProjectId || '')}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
