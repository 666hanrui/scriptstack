import { useEffect, useMemo, useState } from 'react';
import { listenEvent } from '../lib/event-bridge';
import { Box, Clapperboard, FileText, Film, FolderKanban, Layers3, Library, Map, RefreshCw, Save, Sparkles, Users, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ScriptSelector from '../components/ScriptSelector';
import { useAppStore } from '../store/useAppStore';
import { useTudouBridge } from '../hooks/useTudouBridge';
import { normalizeAssets } from '../lib/format';
import type { AssetBundle, ScriptTask } from '../types/tudou';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ContextMetricGrid from '../components/ui/ContextMetricGrid';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import EmptyState from '../components/ui/EmptyState';
import FormField, { TextArea, TextInput } from '../components/ui/FormField';
import ResultViewer from '../components/ui/ResultViewer';
import AssetImageGallery from '../components/visual/AssetImageGallery';

type AssetTab = 'characters' | 'scenes' | 'props';
type ExtractionMeta = {
  extractionMode: string;
  extractionModel: string;
  configReady: boolean | null;
  fallbackUsed: boolean | null;
  llmUsed: boolean | null;
} | null;

const FIELD_MAP: Record<AssetTab, string[]> = {
  characters: ['name', 'appearance', 'clothing', 'personality', 'visualAnchor', 'aiPrompt'],
  scenes: ['name', 'atmosphere', 'materials', 'landmarks', 'colorTemperature', 'aiPrompt'],
  props: ['name', 'dramaticFunction', 'form', 'material', 'surfaceState', 'aiPrompt'],
};

const FIELD_LABELS: Record<string, string> = {
  name: '名称',
  appearance: '外貌',
  clothing: '服装',
  personality: '性格',
  visualAnchor: '视觉锚点',
  atmosphere: '氛围',
  materials: '材质',
  landmarks: '关键地标',
  colorTemperature: '色温 / 主色调',
  dramaticFunction: '戏剧功能',
  form: '形态',
  material: '材质',
  surfaceState: '表面状态',
  aiPrompt: '中文资产提示词 / 创作源',
};

const TAB_META: Record<AssetTab, { label: string; icon: any }> = {
  characters: { label: '角色', icon: Users },
  scenes: { label: '场景', icon: Map },
  props: { label: '道具', icon: Box },
};

const VISUAL_OPTIONS: Record<AssetTab, Array<{ label: string; type: string }>> = {
  characters: [
    { label: '三视图', type: 'character_turnaround_3_view' },
    { label: '定妆照', type: 'character_portrait_costume' },
    { label: '表情表', type: 'character_expression_sheet_9' },
  ],
  scenes: [
    { label: '概念图', type: 'scene_concept_wide_shot' },
    { label: '氛围板', type: 'scene_mood_board' },
    { label: '恐怖氛围', type: 'scene_horror_atmosphere' },
  ],
  props: [
    { label: '设定图', type: 'prop_design_sheet' },
    { label: '材质细节', type: 'prop_material_detail' },
    { label: '结构拆解', type: 'prop_exploded_view' },
  ],
};

const EMPTY: AssetBundle = { characters: [], scenes: [], props: [] };
const arr = (value: any) => (Array.isArray(value) ? value : []);
const pickTaskId = (task: ScriptTask) => {
  const anyTask = task as any;
  return anyTask.taskId || anyTask.task_id || anyTask.task?.taskId || anyTask.task?.task_id || '';
};
const pickProjectId = (task: ScriptTask) => {
  const anyTask = task as any;
  return anyTask.projectId || anyTask.project_id || anyTask.task?.projectId || anyTask.task?.project_id || '';
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function eventLine(eventName: string, payload: any) {
  const count = payload?.count !== undefined ? ` count=${payload.count}` : '';
  const model = payload?.fallbackUsed ? ' fallback=true' : '';
  const msg = payload?.message || payload?.error || payload?.stage || payload?.assetType || '';
  return `${eventName}:${count}${model}${msg ? ` ${msg}` : ''}`;
}

function modeLabel(mode?: string) {
  if (mode === 'llm') return '模型扫描';
  if (mode === 'mixed') return '混合扫描';
  if (mode === 'fallback') return 'Fallback 扫描';
  return '未扫描';
}

function metaFromResult(result: any): ExtractionMeta {
  if (!result || typeof result !== 'object') return null;
  return {
    extractionMode: result.extractionMode || (result.fallbackUsed ? 'fallback' : result.llmUsed ? 'llm' : ''),
    extractionModel: result.extractionModel || '',
    configReady: typeof result.configReady === 'boolean' ? result.configReady : null,
    fallbackUsed: typeof result.fallbackUsed === 'boolean' ? result.fallbackUsed : null,
    llmUsed: typeof result.llmUsed === 'boolean' ? result.llmUsed : null,
  };
}

export default function AssetsForge() {
  const { setRealm, currentTaskId, setCurrentTaskId, currentProjectId, setCurrentProjectId, showToast } = useAppStore();
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AssetTab>('characters');
  const [assets, setAssets] = useState<AssetBundle>(EMPTY);
  const [extractionMeta, setExtractionMeta] = useState<ExtractionMeta>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [busy, setBusy] = useState<'load' | 'extract' | 'save' | ''>('');
  const [error, setError] = useState('');
  const [assetSheetPlan, setAssetSheetPlan] = useState<any>(null);
  const [assetSheetBusy, setAssetSheetBusy] = useState('');

  useEffect(() => {
    setRealm('samurai');
  }, [setRealm]);

  useEffect(() => {
    if (currentTaskId) loadAssets(currentTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTaskId]);

  useEffect(() => {
    const names = ['asset:scan-start', 'asset:scan-character', 'asset:scan-scene', 'asset:scan-prop', 'asset:scan-done', 'asset:scan-error'];
    let unlisteners: Array<() => void> = [];
    Promise.all(names.map((name) => listenEvent(name, (payload: any) => {
      const taskId = payload.taskId || payload.task_id;
      if (taskId && currentTaskId && taskId !== currentTaskId) return;
      setProgress((prev) => [eventLine(name, payload), ...prev].slice(0, 100));
      if (name === 'asset:scan-error') {
        setError(payload.error || payload.message || '资产扫描失败');
        setBusy('');
      }
      if (name === 'asset:scan-done') {
        setBusy('');
        const doneTaskId = taskId || currentTaskId || '';
        if (doneTaskId) loadAssets(doneTaskId);
      }
    }))).then((items) => { unlisteners = items; });
    return () => unlisteners.forEach((unlisten) => unlisten());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTaskId]);

  const counts = useMemo(() => ({
    characters: arr(assets.characters).length,
    scenes: arr(assets.scenes).length,
    props: arr(assets.props).length,
  }), [assets]);

  const totalAssets = counts.characters + counts.scenes + counts.props;
  const scanMode = extractionMeta?.extractionMode || '';
  const currentStatus = busy === 'extract' ? '扫描中' : busy === 'save' ? '保存中' : busy === 'load' ? '读取中' : totalAssets > 0 ? '已有资产' : '待扫描';

  async function loadAssets(taskId = currentTaskId || '') {
    if (!taskId) return;
    setBusy('load');
    setError('');
    try {
      const rows = await invoke<any[]>('asset/get-all', { taskId }, { silent: true });
      setAssets(normalizeAssets(rows));
    } catch (err: any) {
      setError(err.message || '读取资产失败');
    } finally {
      setBusy('');
    }
  }

  async function selectScript(task: ScriptTask) {
    const taskId = pickTaskId(task);
    if (!taskId) return;
    const projectId = pickProjectId(task);
    setCurrentTaskId(taskId);
    if (projectId) setCurrentProjectId(projectId);
    setExtractionMeta(null);
    await loadAssets(taskId);
  }

  async function extractAssets() {
    if (!currentTaskId) {
      setError('缺少 currentTaskId。请从项目库选择已成稿的 script task，或先在工作流 Step 8 finalize。');
      return;
    }
    setBusy('extract');
    setError('');
    setExtractionMeta(null);
    setProgress(['asset:scan-start pending']);
    try {
      const result = await invoke<any>('asset/extract', { taskId: currentTaskId }, { timeout: 900000 });
      const meta = metaFromResult(result);
      setExtractionMeta(meta);
      if (meta) {
        setProgress((prev) => [`asset:scan-summary mode=${meta.extractionMode || 'unknown'} configReady=${meta.configReady} fallback=${meta.fallbackUsed} llm=${meta.llmUsed}`, ...prev].slice(0, 100));
      }
      if (result?.characters || result?.scenes || result?.props) setAssets(normalizeAssets(result));
      await loadAssets(currentTaskId);
    } catch (err: any) {
      setError(err.message || '资产扫描失败');
      setProgress((prev) => [`asset:scan-error ${err.message || err}`, ...prev]);
    } finally {
      setBusy('');
    }
  }

  function updateField(tab: AssetTab, index: number, field: string, value: string) {
    setAssets((prev) => {
      const next: AssetBundle = { characters: [...arr(prev.characters)], scenes: [...arr(prev.scenes)], props: [...arr(prev.props)] };
      next[tab][index] = { ...next[tab][index], [field]: value };
      return next;
    });
  }

  async function saveAssets() {
    if (!currentTaskId) return;
    setBusy('save');
    setError('');
    try {
      await invoke('asset/update', {
        taskId: currentTaskId,
        characters: JSON.stringify(assets.characters || []),
        scenes: JSON.stringify(assets.scenes || []),
        props: JSON.stringify(assets.props || []),
      });
      setProgress((prev) => ['asset:update saved', ...prev]);
      await loadAssets(currentTaskId);
    } catch (err: any) {
      setError(err.message || '保存资产失败');
    } finally {
      setBusy('');
    }
  }

  async function createAssetSheetPlan() {
    if (!currentTaskId) return;
    setAssetSheetBusy('plan');
    setError('');
    try {
      const result = await invoke<any>('asset-sheet/plan', { taskId: currentTaskId }, { timeout: 120000 });
      setAssetSheetPlan(result);
      showToast({ message: '道具合板计划已生成', type: 'success' });
    } catch (err: any) {
      setError(err.message || '生成道具合板计划失败');
    } finally {
      setAssetSheetBusy('');
    }
  }

  async function cropAssetSheet(batchId: string, file?: File) {
    if (!batchId || !file) return;
    setAssetSheetBusy(batchId);
    setError('');
    try {
      const base64 = await fileToBase64(file);
      const result = await invoke<any>('asset-sheet/crop', { batchId, base64, mimeType: file.type }, { timeout: 120000 });
      showToast({ message: `已裁切 ${result?.images?.length || 0} 张道具子图`, type: 'success' });
      if (currentTaskId) await loadAssets(currentTaskId);
    } catch (err: any) {
      setError(err.message || '裁切合板失败');
    } finally {
      setAssetSheetBusy('');
    }
  }

  function openVisualPrompt(templateType: string, index: number, item: any) {
    const assetType = activeTab === 'characters' ? 'character' : activeTab === 'scenes' ? 'scene' : 'prop';
    const params = new URLSearchParams({
      assetType,
      assetIndex: String(index),
      type: templateType,
    });
    if (item?.id) params.set('assetId', item.id);
    navigate(`/visual-prompts?${params.toString()}`);
  }

  const items = arr(assets[activeTab]);
  const ActiveIcon = TAB_META[activeTab].icon;

  return (
    <PageShell maxWidth="max-w-full">
      <ModuleHeader
        icon={<Library size={24} />}
        eyebrow="Canonical Asset Flow"
        title="资产矩阵 / 验收工作台"
        actions={
          <ActionBar align="right" className="flex-wrap">
            <ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>剧本</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/visual-prompts')} disabled={!currentTaskId} icon={<Sparkles size={16} />}>视觉工坊</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/video')} disabled={!currentTaskId} icon={<Film size={16} />}>视频</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/frame-prompt')} disabled={!currentTaskId} icon={<Layers3 size={16} />}>逐镜</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/seedance')} disabled={!currentTaskId} icon={<Clapperboard size={16} />}>Seedance</ActionButton>
          </ActionBar>
        }
      />

      <ContextMetricGrid metrics={[
        { label: 'Project', value: currentProjectId || '未绑定', copyable: currentProjectId || undefined, isMono: true },
        { label: 'Script Task', value: currentTaskId || '未选择', copyable: currentTaskId || undefined, isMono: true },
        { label: '资产总数', value: `${totalAssets}` },
        { label: '扫描模式', value: modeLabel(scanMode) },
      ]} />

      {!currentTaskId && <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100 text-sm">没有有效 script task。请从项目库选择已成稿任务，或先在工作流 Step 8 finalize。</div>}
      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 min-h-0">
        <aside className="space-y-6 min-w-0">
          <Panel title="Script Source" subtitle="选择剧本任务作为资产扫描源" noPadding>
            <div className="p-4">
              <ScriptSelector selectedTaskId={currentTaskId} onSelect={selectScript} />
            </div>
          </Panel>

            <Panel title="扫描控制" subtitle="监听真实 asset:scan-* 事件"
              footer={
                <ActionBar className="flex-col items-stretch">
                  <ActionButton onClick={extractAssets} disabled={!currentTaskId || busy === 'extract'} isLoading={busy === 'extract'} icon={<RefreshCw size={16} />}>扫描剧本资产</ActionButton>
                  <ActionButton variant="secondary" onClick={() => currentTaskId && loadAssets(currentTaskId)} disabled={!currentTaskId || busy === 'load'} isLoading={busy === 'load'} icon={<RefreshCw size={16} />}>重新读取资产</ActionButton>
                  <ActionButton variant="secondary" onClick={saveAssets} disabled={!currentTaskId || busy === 'save'} isLoading={busy === 'save'} icon={<Save size={16} />}>保存资产修改</ActionButton>
                </ActionBar>
              }
            >
              <div className="grid grid-cols-3 gap-3 mb-5">
                <MiniStat label="角色" value={counts.characters} />
                <MiniStat label="场景" value={counts.scenes} />
                <MiniStat label="道具" value={counts.props} />
              </div>
              {extractionMeta && (
                <div className={`mb-5 rounded-2xl border p-4 text-sm ${extractionMeta.extractionMode === 'fallback' ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-100' : extractionMeta.extractionMode === 'mixed' ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'}`}>
                  <div className="font-bold mb-2">{modeLabel(extractionMeta.extractionMode)}</div>
                  <div className="space-y-1 text-xs opacity-80 font-mono break-all">
                    <div>configReady: {String(extractionMeta.configReady)}</div>
                    <div>fallbackUsed: {String(extractionMeta.fallbackUsed)}</div>
                    <div>llmUsed: {String(extractionMeta.llmUsed)}</div>
                    <div>model: {extractionMeta.extractionModel || 'N/A'}</div>
                  </div>
                </div>
              )}
              {!extractionMeta && totalAssets > 0 && (
                <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/45 text-sm">
                  当前资产来自历史记录。重新扫描后会显示本次 extractionMode / fallbackUsed / llmUsed。
                </div>
              )}
            </Panel>

          <Panel title="道具资产合板" subtitle="把多个道具按规则网格一次生图，再裁切回独立资产。">
            <div className="space-y-4">
              <ActionButton onClick={createAssetSheetPlan} disabled={!currentTaskId || assetSheetBusy === 'plan'} isLoading={assetSheetBusy === 'plan'} icon={<Box size={16} />}>生成合板计划</ActionButton>
              {assetSheetPlan?.batches?.length ? (
                <div className="space-y-4">
                  {assetSheetPlan.batches.map((batch: any) => (
                    <div key={batch.id} className="rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-3">
                      <div>
                        <div className="text-sm font-bold text-white/80">{batch.title}</div>
                        <div className="text-[11px] text-white/35 font-mono">{batch.gridRows}x{batch.gridCols} · {batch.id}</div>
                      </div>
                      <TextArea value={batch.prompt || ''} onChange={() => {}} rows={6} />
                      <div className="grid grid-cols-2 gap-2">
                        {(batch.cells || []).map((cell: any) => (
                          <div key={cell.id} className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2 py-1.5 text-[11px] text-white/55">
                            {cell.cellLabel} · {cell.assetName}
                          </div>
                        ))}
                      </div>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => cropAssetSheet(batch.id, event.target.files?.[0])}
                        />
                        <span className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-xs font-bold cursor-pointer hover:bg-indigo-500/20">
                          {assetSheetBusy === batch.id ? '裁切中...' : '上传合板图并裁切'}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/35">先完成道具资产扫描，再生成合板计划。</div>
              )}
            </div>
          </Panel>

          <Panel title="扫描事件日志" subtitle="最近 100 条事件" noPadding>
            <ResultViewer maxHeight="max-h-[300px]" title="ASSET EVENTS" content={progress.length ? progress.join('\n') : '等待真实资产扫描事件。'} />
          </Panel>
        </aside>

        <main className="space-y-6 min-w-0">
          <Panel
            title="资产卡片编辑"
            subtitle="角色 / 场景 / 道具三类资产可独立编辑并保存"
            actions={<ActionButton variant="secondary" onClick={saveAssets} disabled={!currentTaskId || busy === 'save'} isLoading={busy === 'save'} icon={<Save size={16} />}>保存</ActionButton>}
          >
            <div className="flex flex-wrap gap-3 mb-6">
              {(Object.keys(TAB_META) as AssetTab[]).map((tab) => {
                const Icon = TAB_META[tab].icon;
                return (
                  <ActionButton key={tab} size="sm" variant={activeTab === tab ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab)} icon={<Icon size={14} />}>
                    {TAB_META[tab].label} {counts[tab]}
                  </ActionButton>
                );
              })}
            </div>

            {items.length === 0 ? (
              <EmptyState title={`暂无${TAB_META[activeTab].label}资产`} description="先点击扫描剧本资产，或从左侧选择已有 script task 后重新读取。" icon={<ActiveIcon size={30} />} />
            ) : (
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
                {items.map((item: any, index: number) => (
                  <div key={item.id || `${activeTab}-${index}`} className="bg-[#0a0a0a]/60 border border-white/[0.06] rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.03)]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-base font-bold text-white/90 tracking-wide">{TAB_META[activeTab].label} #{index + 1}</div>
                        <div className="text-[11px] text-white/40 mt-1">{item.name || '未命名资产'}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2 max-w-[260px]">
                        {VISUAL_OPTIONS[activeTab].map((option) => (
                          <button
                              key={option.type}
                              onClick={() => openVisualPrompt(option.type, index, item)}
                              className="px-3 py-1.5 rounded-lg border border-indigo-500/25 bg-indigo-500/10 text-indigo-200 text-[11px] font-bold hover:bg-indigo-500/20 transition-colors"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                      {FIELD_MAP[activeTab].map((field) => (
                        <FormField key={field} label={FIELD_LABELS[field] || field}>
                          {field === 'aiPrompt' ? (
                            <TextArea value={item[field] || ''} onChange={(event: any) => updateField(activeTab, index, field, event.target.value)} rows={3} />
                          ) : (
                            <TextInput value={item[field] || ''} onChange={(event: any) => updateField(activeTab, index, field, event.target.value)} />
                          )}
                        </FormField>
                      ))}
                    </div>

                    {/* Inline Image Gallery for this asset */}
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-2">
                        <Camera size={13} className="text-white/40" />
                        <span className="text-[11px] font-bold text-white/50">参考图片</span>
                      </div>
                      <AssetImageGallery
                        compact
                        assetType={activeTab === 'characters' ? 'character' : activeTab === 'scenes' ? 'scene' : 'prop'}
                        assetId={item.id || `${activeTab}-${index}`}
                        assetName={item.name || `${TAB_META[activeTab].label} #${index + 1}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </main>
      </div>
    </PageShell>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
      <div className="text-white text-2xl font-black">{value}</div>
      <div className="text-white/40 text-xs mt-1">{label}</div>
    </div>
  );
}
