import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CheckCircle2, Clapperboard, Copy, FileText, FolderKanban, Layers3, Map as MapIcon, Search, Sparkles, Upload, Users, Wand2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTudouBridge } from '../../hooks/useTudouBridge';
import PageShell from '../ui/PageShell';
import ModuleHeader from '../ui/ModuleHeader';
import ActionBar, { ActionButton } from '../ui/ActionBar';
import ResultViewer from '../ui/ResultViewer';
import AssetPromptTree, { type AssetItem } from './AssetPromptTree';
import AssetImageGallery from './AssetImageGallery';

type AssetTab = 'character' | 'scene' | 'prop';
type GenerationMode = 'image' | 'storyboard' | 'video';

const TAB_META: { id: AssetTab; label: string; icon: any; color: string }[] = [
  { id: 'character', label: '角色', icon: Users, color: 'text-purple-300 bg-purple-500/15 border-purple-500/30' },
  { id: 'scene', label: '场景', icon: MapIcon, color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' },
  { id: 'prop', label: '道具', icon: Box, color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
];

const MODE_META: { id: GenerationMode; label: string; hint: string }[] = [
  { id: 'image', label: '生图', hint: '角色、场景、道具标准图' },
  { id: 'storyboard', label: '分镜', hint: '故事版/关键帧消费' },
  { id: 'video', label: '视频', hint: 'Seedance/视频消费' },
];

const FIELD_FALLBACKS: Record<string, string[]> = {
  character: ['aiPrompt', 'appearance', 'clothing', 'visualAnchor', 'description'],
  scene: ['aiPrompt', 'atmosphere', 'materials', 'landmarks', 'visualAnchor', 'description'],
  prop: ['aiPrompt', 'form', 'material', 'surfaceState', 'visualAnchor', 'description'],
};

function readField(data: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return '';
}

function parseJsonMaybe(value: any, fallback: any) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function outputPrompt(out: any) {
  return out?.promptTextEn || out?.prompt_text_en || out?.promptText || out?.prompt_text || '';
}

function outputReview(out: any) {
  return out?.reviewTextZh || out?.review_text_zh || '';
}

function isOutputStale(out: any, item: AssetItem) {
  const raw = out?.sourceAssetSnapshotJson || out?.source_asset_snapshot_json;
  const snapshot = parseJsonMaybe(raw, null);
  const source = snapshot?.chineseAsset;
  if (!source || !item?.data) return false;
  return JSON.stringify(source) !== JSON.stringify(item.data);
}

function outputMode(out: any): GenerationMode {
  const mode = out?.generationMode || out?.generation_mode || out?.outputType || out?.output_type;
  return mode === 'storyboard' || mode === 'video' ? mode : 'image';
}

export default function VisualPromptForge() {
  const navigate = useNavigate();
  const { invoke } = useTudouBridge();
  const currentTaskId = useAppStore((s) => s.currentTaskId);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const setRealm = useAppStore((s) => s.setRealm);
  const showToast = useAppStore((s) => s.showToast);

  const [allItems, setAllItems] = useState<AssetItem[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<AssetTab>('character');
  const [mode, setMode] = useState<GenerationMode>('image');
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [showUploadFor, setShowUploadFor] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => { setRealm('samurai'); }, [setRealm]);

  const loadOutputs = useCallback(async () => {
    if (!currentProjectId) return;
    const rows = await invoke<any[]>('visual/list-outputs', { projectId: currentProjectId }, { silent: true }).catch(() => []);
    setOutputs(Array.isArray(rows) ? rows.filter((row) => !currentTaskId || row.scriptTaskId === currentTaskId || row.script_task_id === currentTaskId) : []);
  }, [currentProjectId, currentTaskId, invoke]);

  useEffect(() => { loadOutputs(); }, [loadOutputs]);

  const handleItemsLoaded = useCallback((items: AssetItem[]) => {
    setAllItems(items.filter((item) => ['character', 'scene', 'prop'].includes(item.type)));
  }, []);

  const tabItems = useMemo(() => {
    const items = allItems.filter((item) => item.type === activeTab);
    if (!searchKeyword.trim()) return items;
    const kw = searchKeyword.toLowerCase();
    return items.filter((item) => `${item.name} ${JSON.stringify(item.data || {})}`.toLowerCase().includes(kw));
  }, [allItems, activeTab, searchKeyword]);

  const latestAnyOutputByAsset = useMemo(() => {
    const map = new Map<string, any>();
    for (const out of outputs) {
      const assetId = out.assetId || out.asset_id;
      if (!assetId) continue;
      if (!map.has(assetId)) map.set(assetId, out);
    }
    return map;
  }, [outputs]);

  const latestOutputByAsset = useMemo(() => {
    const map = new Map<string, any>();
    for (const out of outputs) {
      const assetId = out.assetId || out.asset_id;
      if (!assetId || outputMode(out) !== mode) continue;
      if (!map.has(assetId)) map.set(assetId, out);
    }
    for (const [assetId, out] of latestAnyOutputByAsset) {
      if (!map.has(assetId)) map.set(assetId, out);
    }
    return map;
  }, [latestAnyOutputByAsset, outputs, mode]);

  const missingStandardItems = useMemo(
    () => allItems.filter((item) => !latestAnyOutputByAsset.has(item.id)),
    [allItems, latestAnyOutputByAsset],
  );

  const tabCounts = useMemo(() => ({
    character: allItems.filter((i) => i.type === 'character').length,
    scene: allItems.filter((i) => i.type === 'scene').length,
    prop: allItems.filter((i) => i.type === 'prop').length,
  }), [allItems]);

  function getAssetSummary(item: AssetItem): string {
    return readField(item.data || {}, FIELD_FALLBACKS[item.type] || ['aiPrompt', 'description']);
  }

  async function smartGenerate(assetIds: string[], assetTypes: AssetTab[], busyKey?: string) {
    if (!currentTaskId) {
      setError('缺少 script task。请先从项目库或资产页选择项目。');
      return;
    }
    setBusy(busyKey || (assetIds.length === 1 ? assetIds[0] : 'batch'));
    setError('');
    try {
      const generated = await invoke<any[]>('visual/smart-generate-asset-prompt', {
        taskId: currentTaskId,
        assetIds,
        assetTypes,
        mode,
      }, { timeout: 900000 });
      setOutputs((prev) => [...(Array.isArray(generated) ? generated : []), ...prev]);
      showToast({ message: `已生成 ${Array.isArray(generated) ? generated.length : 0} 条英文 AIPROMPT`, type: 'success' });
      await loadOutputs();
    } catch (err: any) {
      setError(err.message || '智能生成视觉提示词失败');
    } finally {
      setBusy('');
    }
  }

  async function copyEnglish(out: any) {
    const text = outputPrompt(out);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    if (out?.id) invoke('visual/mark-copied', { id: out.id }, { silent: true }).catch(() => {});
    showToast({ message: '已复制英文 AIPROMPT', type: 'success' });
  }

  const generateCurrentTab = () => {
    const ids = tabItems.map((item) => item.id).filter(Boolean);
    if (!ids.length) return;
    smartGenerate(ids, [activeTab]);
  };

  const generateMissingStandards = () => {
    const ids = missingStandardItems.map((item) => item.id).filter(Boolean);
    if (!ids.length) return;
    const types = Array.from(new Set(missingStandardItems.map((item) => item.type))) as AssetTab[];
    smartGenerate(ids, types, 'missing');
  };

  return (
    <PageShell maxWidth="max-w-7xl">
      <ModuleHeader
        icon={<Sparkles size={24} />}
        eyebrow="Visual Standard Parts"
        title="视觉提示词工坊"
        subtitle="中文资产不被覆盖；这里把中文创作源自动加工成纯英文 AIPROMPT，并提供中文镜像审阅。"
        actions={
          <ActionBar align="right" className="flex-wrap">
            <ActionButton variant="secondary" onClick={() => navigate('/assets')} disabled={!currentTaskId} icon={<FileText size={16} />}>资产</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/frame-prompt')} disabled={!currentTaskId} icon={<Layers3 size={16} />}>逐镜</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/seedance')} disabled={!currentTaskId} icon={<Clapperboard size={16} />}>Seedance</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton>
          </ActionBar>
        }
      />

      <div className="hidden">
        <AssetPromptTree onSelect={() => {}} onItemsLoaded={handleItemsLoaded} />
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {TAB_META.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setExpandedAssetId(null); setSearchKeyword(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${activeTab === id ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200' : 'bg-white/[0.02] border-white/[0.06] text-white/45 hover:text-white/70 hover:border-white/15'}`}
              >
                <Icon size={16} />
                {label}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${activeTab === id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/[0.04] text-white/30'}`}>{tabCounts[id]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {MODE_META.map((item) => (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                title={item.hint}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${mode === item.id ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/65'}`}
              >
                {item.label}
              </button>
            ))}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索资产"
                className="bg-black/30 border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-xs text-white/70 placeholder-white/25 focus:outline-none focus:border-indigo-500/40 w-36"
              />
            </div>
            <ActionButton
              variant="secondary"
              onClick={generateMissingStandards}
              disabled={!missingStandardItems.length || busy === 'missing'}
              isLoading={busy === 'missing'}
              icon={<Sparkles size={16} />}
            >
              补齐全部缺失 {missingStandardItems.length ? `(${missingStandardItems.length})` : ''}
            </ActionButton>
            <ActionButton onClick={generateCurrentTab} disabled={!tabItems.length || busy === 'batch'} isLoading={busy === 'batch'} icon={<Wand2 size={16} />}>生成当前分类</ActionButton>
          </div>
        </div>
      </div>

      {tabItems.length === 0 ? (
        <div className="text-center py-16 text-white/35">
          <div className="text-lg mb-2">暂无{TAB_META.find((t) => t.id === activeTab)?.label}资产</div>
          <div className="text-sm">请先在「资产矩阵」扫描或手动添加中文资产。</div>
        </div>
      ) : (
        <div className="space-y-3">
          {tabItems.map((item) => {
            const isExpanded = expandedAssetId === item.id;
            const out = latestOutputByAsset.get(item.id);
            const promptEn = outputPrompt(out);
            const reviewZh = outputReview(out);
            const stale = out ? isOutputStale(out, item) : false;
            const quality = parseJsonMaybe(out?.qualityJson || out?.quality_json, {});
            const templateIds = parseJsonMaybe(out?.selectedTemplateIdsJson || out?.selected_template_ids_json, []);
            const summary = getAssetSummary(item);

            return (
              <div key={item.id} className={`rounded-2xl border transition-all ${isExpanded ? 'border-indigo-500/30 bg-indigo-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                <div className="w-full flex items-center gap-4 p-4">
                  <button onClick={() => setExpandedAssetId(isExpanded ? null : item.id)} className="flex flex-1 items-center gap-4 min-w-0 text-left">
                    <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${TAB_META.find((t) => t.id === item.type)?.color || 'bg-white/5 border-white/10 text-white/40'}`}>
                      {(() => { const T = TAB_META.find((t) => t.id === item.type); return T ? <T.icon size={18} /> : null; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white/85 truncate">{item.name}</span>
                      {promptEn && <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${stale ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'}`}><CheckCircle2 size={10} /> {stale ? 'STALE' : 'EN READY'}</span>}
                      </div>
                      {summary && <div className="text-[11px] text-white/35 line-clamp-1 mt-0.5">{summary}</div>}
                    </div>
                  </button>
                  <ActionButton
                    size="sm"
                    onClick={() => smartGenerate([item.id], [item.type as AssetTab])}
                    isLoading={busy === item.id}
                    icon={<Wand2 size={12} />}
                  >
                    智能生成
                  </ActionButton>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04]">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-4">
                      <ResultViewer maxHeight="max-h-[260px]" title="中文资产提示词 / 创作源" content={summary || JSON.stringify(item.data || {}, null, 2)} />
                      {promptEn ? (
                        <ResultViewer maxHeight="max-h-[260px]" title="英文 AIPROMPT / 给模型使用" content={promptEn} />
                      ) : (
                        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-yellow-100 text-sm">
                          当前 {MODE_META.find((m) => m.id === mode)?.label} 模式还没有英文标准件。点击“智能生成”后，系统会读取中文资产和本地高级模板，让 LLM 自动选模、翻译、重写、质检并保存。
                        </div>
                      )}
                    </div>

                    {reviewZh && <ResultViewer maxHeight="max-h-[220px]" title="中文镜像 / 用户审阅" content={reviewZh} />}

                    <div className="flex items-center gap-2 flex-wrap">
                      <ActionButton size="sm" onClick={() => out && copyEnglish(out)} disabled={!promptEn} icon={<Copy size={12} />}>复制英文原码</ActionButton>
                      <ActionButton size="sm" variant="secondary" onClick={() => setShowUploadFor(showUploadFor === item.id ? null : item.id)} icon={<Upload size={12} />}>{showUploadFor === item.id ? '收起上传' : '上传生成图'}</ActionButton>
                    </div>

                    <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <summary className="cursor-pointer text-xs font-bold text-white/45">高级信息：模板来源 / 质量自检 / 数据快照</summary>
                      <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-3">
                        <ResultViewer maxHeight="max-h-[180px]" title="SELECTED TEMPLATES" content={Array.isArray(templateIds) && templateIds.length ? templateIds.join('\n') : 'smart-auto'} />
                        <ResultViewer maxHeight="max-h-[180px]" title="QUALITY JSON" content={JSON.stringify(quality, null, 2)} />
                        <ResultViewer maxHeight="max-h-[180px]" title="SOURCE SNAPSHOT" content={out?.sourceAssetSnapshotJson || out?.source_asset_snapshot_json || JSON.stringify(item.data || {}, null, 2)} />
                      </div>
                    </details>

                    {showUploadFor === item.id && (
                      <div className="rounded-xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.03] p-3">
                        <div className="text-[10px] text-white/40 mb-2">把外部网页工具生成的图片上传保存到「{item.name}」参考图库。</div>
                        <AssetImageGallery assetType={item.type} assetId={item.id} assetName={item.name} />
                      </div>
                    )}

                    {showUploadFor !== item.id && (
                      <AssetImageGallery compact assetType={item.type} assetId={item.id} assetName={item.name} />
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
