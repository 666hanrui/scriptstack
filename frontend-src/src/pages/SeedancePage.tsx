import { listenEvent } from '../lib/event-bridge';
import { AlertTriangle, Boxes, CheckCircle2, Clapperboard, Copy, FileText, Film, FolderKanban, Play, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScriptSelector from '../components/ScriptSelector';
import { useTudouBridge } from '../hooks/useTudouBridge';
import { getTaskId } from '../lib/format';
import { useAppStore } from '../store/useAppStore';
import type { ScriptTask } from '../types/tudou';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ContextMetricGrid from '../components/ui/ContextMetricGrid';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import EmptyState from '../components/ui/EmptyState';
import ResultViewer from '../components/ui/ResultViewer';

type BusyState = 'analysis' | 'unit' | 'all' | 'load' | 'visual' | '';

function unitIndexOf(unit: any, fallback: number) {
  const value = unit?.unitIndex ?? unit?.unit_index ?? fallback;
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function unitStatus(unit: any) {
  return unit?.status || unit?.stage || 'pending';
}

function parseNoteArea(value: any) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function taskIdOfPayload(payload: any) {
  return payload?.taskId || payload?.task_id || '';
}

function projectIdOfTask(task: ScriptTask) {
  const anyTask = task as any;
  return anyTask.projectId || anyTask.project_id || anyTask.task?.projectId || anyTask.task?.project_id || '';
}

function progressLine(payload: any) {
  const unit = payload?.unitIndex ?? payload?.unit_index;
  const unitPart = unit !== undefined ? ` unit=${Number(unit) + 1}` : '';
  const progress = payload?.progress !== undefined ? ` progress=${Math.round(Number(payload.progress) * 100)}%` : '';
  const status = payload?.status || payload?.stage || payload?.message || 'progress';
  return `seedance:${status}${unitPart}${progress}`;
}

function isMissingVisualStandardsError(err: any) {
  const message = err instanceof Error ? err.message : String(err || '');
  return message.includes('缺少英文视觉标准件');
}

export default function SeedancePage() {
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const setCurrentTaskId = useAppStore((state) => state.setCurrentTaskId);
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);
  const setRealm = useAppStore((state) => state.setRealm);
  const showToast = useAppStore((state) => state.showToast);

  const [task, setTask] = useState<ScriptTask | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [visualOutputs, setVisualOutputs] = useState<any[]>([]);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [progress, setProgress] = useState<string[]>([]);
  const [busy, setBusy] = useState<BusyState>('');
  const [error, setError] = useState('');

  const selectedTaskId = useMemo(() => getTaskId(task) || currentTaskId || '', [task, currentTaskId]);
  const activeUnit = useMemo(() => units.find((unit, index) => unitIndexOf(unit, index) === activeUnitIndex) || units[0] || null, [units, activeUnitIndex]);
  const noteArea = parseNoteArea(activeUnit?.noteAreaJson || activeUnit?.note_area_json);
  const completeUnits = useMemo(() => units.filter((unit) => ['done', 'completed', 'ready'].includes(unitStatus(unit))).length, [units]);
  const pendingUnits = Math.max(0, units.length - completeUnits);
  const analysisStatus = analysis ? '已完成' : '待分析';
  const workStatus = busy ? `处理中：${busy}` : units.length > 0 ? `Units ${completeUnits}/${units.length}` : '待生成 Units';

  const mergeVisualOutputs = (rows: any[]) => {
    setVisualOutputs((prev) => {
      const seen = new Set<string>();
      return [...rows, ...prev].filter((row) => {
        const key = row?.id || `${row?.assetType || row?.asset_type || ''}:${row?.assetId || row?.asset_id || ''}:${row?.generationMode || row?.generation_mode || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  };

  const generateVisualStandards = async () => {
    if (!selectedTaskId) throw new Error('请先选择 script task。');
    const rows = await invoke<any[]>('visual/smart-generate-asset-prompt', {
      taskId: selectedTaskId,
      assetTypes: ['character', 'scene', 'prop'],
      mode: 'video',
    }, { timeout: 900000 });
    const list = Array.isArray(rows) ? rows : [];
    mergeVisualOutputs(list);
    return list;
  };

  const runWithVisualAutoRepair = async <T,>(busyState: BusyState, action: () => Promise<T>) => {
    setBusy(busyState);
    setError('');
    try {
      return await action();
    } catch (err: any) {
      if (!isMissingVisualStandardsError(err)) throw err;
      setError('缺少视觉标准件，正在自动补齐英文 AIPROMPT，补齐后会继续刚才的步骤。');
      setBusy('visual');
      await generateVisualStandards();
      showToast('视觉标准件已自动补齐，继续执行当前步骤');
      setBusy(busyState);
      return await action();
    } finally {
      setBusy('');
    }
  };

  const invokeUnitWithVisualRepair = async (unitIndex: number, busyState: BusyState = 'unit') => {
    try {
      await invoke<any>('seedance/run-unit', { taskId: selectedTaskId, unitIndex }, { timeout: 900000 });
    } catch (err: any) {
      if (!isMissingVisualStandardsError(err)) throw err;
      setError('缺少视觉标准件，正在自动补齐英文 AIPROMPT，补齐后会继续生成镜头单元。');
      setBusy('visual');
      await generateVisualStandards();
      showToast('视觉标准件已自动补齐，继续执行当前步骤');
      setBusy(busyState);
      await invoke<any>('seedance/run-unit', { taskId: selectedTaskId, unitIndex }, { timeout: 900000 });
    }
  };

  useEffect(() => { setRealm('valley'); }, [setRealm]);

  useEffect(() => {
    if (currentTaskId && !task) loadUnits(currentTaskId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTaskId]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listenEvent('seedance:progress', (payload: any) => {
      const pid = taskIdOfPayload(payload);
      if (pid && currentTaskId && pid !== currentTaskId) return;
      setProgress((prev) => [progressLine(payload), ...prev].slice(0, 120));
      if (payload.error) setError(String(payload.error));
    }).then((fn) => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, [currentTaskId]);

  const loadUnits = async (taskId: string, silent = false) => {
    if (!taskId) return;
    if (!silent) setBusy('load');
    setError('');
    try {
      const rows = await invoke<any[]>('seedance/list-units', { taskId }, { silent: true });
      const list = Array.isArray(rows) ? rows : [];
      setUnits(list);
      setActiveUnitIndex(list.length > 0 ? unitIndexOf(list[0], 0) : 0);
      const cached = await invoke<any>('seedance/get-analysis', { taskId }, { silent: true }).catch(() => null);
      setAnalysis(cached);
      if (currentProjectId) {
        const rows = await invoke<any[]>('visual/list-outputs', { projectId: currentProjectId }, { silent: true }).catch(() => []);
        setVisualOutputs(Array.isArray(rows) ? rows.filter((row) => row.scriptTaskId === taskId || row.script_task_id === taskId) : []);
      }
    } catch (err: any) {
      setError(err.message || '读取 Seedance 单元失败');
    } finally {
      if (!silent) setBusy('');
    }
  };

  const onSelectScript = (nextTask: ScriptTask, text: string) => {
    const taskId = getTaskId(nextTask);
    const projectId = projectIdOfTask(nextTask);
    setTask(nextTask);
    setScriptText(text);
    setProgress([]);
    setError('');
    if (projectId) setCurrentProjectId(projectId);
    if (taskId) {
      setCurrentTaskId(taskId);
      loadUnits(taskId);
    }
  };

  const runAnalysis = async () => {
    if (!selectedTaskId) return;
    setProgress(['seedance:phase-ad start']);
    try {
      const result = await runWithVisualAutoRepair('analysis', () =>
        invoke<any>('seedance/phase-ad', { taskId: selectedTaskId }, { timeout: 900000 })
      );
      setAnalysis(result);
      await loadUnits(selectedTaskId, true);
      setProgress((prev) => ['seedance:phase-ad done', ...prev]);
      showToast('Seedance Phase A-D 分析完成');
    } catch (err: any) {
      setError(err.message || 'Seedance A-D 分析失败');
      setProgress((prev) => [`seedance:phase-ad error ${err.message || err}`, ...prev]);
    }
  };

  const ensureVisualStandards = async () => {
    if (!selectedTaskId) return;
    setBusy('visual');
    setError('');
    try {
      await generateVisualStandards();
      await loadUnits(selectedTaskId, true);
      showToast('Seedance 视觉标准件已补齐');
    } catch (err: any) {
      setError(err.message || '补齐 Seedance 视觉标准件失败');
    } finally {
      setBusy('');
    }
  };

  const runUnit = async (unitIndex: number) => {
    if (!selectedTaskId) return;
    setBusy('unit');
    setError('');
    setActiveUnitIndex(unitIndex);
    setProgress((prev) => [`seedance:unit start unit=${unitIndex + 1}`, ...prev]);
    try {
      await runWithVisualAutoRepair('unit', () =>
        invoke<any>('seedance/run-unit', { taskId: selectedTaskId, unitIndex }, { timeout: 900000 })
      );
      await loadUnits(selectedTaskId, true);
      setProgress((prev) => [`seedance:unit done unit=${unitIndex + 1}`, ...prev]);
      showToast(`镜头单元 ${unitIndex + 1} 已生成`);
    } catch (err: any) {
      setError(err.message || '单元生成失败');
      setProgress((prev) => [`seedance:unit error unit=${unitIndex + 1} ${err.message || err}`, ...prev]);
    }
  };

  const runAll = async () => {
    if (!selectedTaskId || units.length === 0) return;
    setBusy('all');
    setError('');
    setProgress((prev) => ['seedance:run-all start', ...prev]);
    try {
      for (let i = 0; i < units.length; i += 1) {
        const unitIndex = unitIndexOf(units[i], i);
        setActiveUnitIndex(unitIndex);
        setProgress((prev) => [`seedance:run-all unit=${unitIndex + 1}/${units.length} start`, ...prev]);
        await invokeUnitWithVisualRepair(unitIndex, 'all');
        await loadUnits(selectedTaskId, true);
        setProgress((prev) => [`seedance:run-all unit=${unitIndex + 1}/${units.length} done`, ...prev]);
      }
      setProgress((prev) => ['seedance:run-all done', ...prev]);
      showToast('全部镜头单元已逐条生成完成');
    } catch (err: any) {
      setError(err.message || '批量生成失败');
      setProgress((prev) => [`seedance:run-all error ${err.message || err}`, ...prev]);
    } finally {
      setBusy('');
    }
  };

  const refreshCurrentUnit = async () => {
    if (!selectedTaskId) return;
    setBusy('load');
    try {
      const unit = await invoke<any>('seedance/get-unit', { taskId: selectedTaskId, unitIndex: activeUnitIndex }, { silent: true });
      if (unit) {
        setUnits((prev) => {
          const rest = prev.filter((item, index) => unitIndexOf(item, index) !== activeUnitIndex);
          return [...rest, unit].sort((a, b) => unitIndexOf(a, 0) - unitIndexOf(b, 0));
        });
      }
    } catch (err: any) {
      setError(err.message || '读取当前单元失败');
    } finally {
      setBusy('');
    }
  };

  const openVisualPrompt = (type = 'video_seedance_style') => {
    const params = new URLSearchParams({
      assetType: 'shot',
      shotIndex: String(activeUnitIndex),
      type,
    });
    navigate(`/visual-prompts?${params.toString()}`);
  };

  return (
    <PageShell maxWidth="max-w-full">
      <ModuleHeader
        icon={<Clapperboard size={24} />}
        eyebrow="Canonical Seedance Flow"
        title="Seedance V5 / 验收工作台"
        actions={<ActionBar align="right" className="flex-wrap"><ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>剧本</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/assets')} disabled={!selectedTaskId} icon={<Boxes size={16} />}>资产</ActionButton><ActionButton variant="secondary" onClick={() => openVisualPrompt()} disabled={!selectedTaskId} icon={<Sparkles size={16} />}>视觉工坊</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/video')} disabled={!selectedTaskId} icon={<Film size={16} />}>视频</ActionButton></ActionBar>}
      />

      <ContextMetricGrid metrics={[{ label: 'Project', value: currentProjectId || '未绑定', copyable: currentProjectId || undefined, isMono: true }, { label: 'Script Task', value: selectedTaskId || '未选择', copyable: selectedTaskId || undefined, isMono: true }, { label: 'A-D 分析', value: analysisStatus }, { label: 'Units', value: `${completeUnits}/${units.length} done · ${pendingUnits} pending` }, { label: '英文视觉标准件', value: `${visualOutputs.length}` }]} />
      {!selectedTaskId && <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100 text-sm">请选择 script task。Seedance V5 以 script task 作为恢复主键。</div>}
      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
      {selectedTaskId && visualOutputs.length === 0 && <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100 text-sm">Seedance 现在只消费英文 AIPROMPT 视觉标准件。请先补齐，或到视觉工坊逐个生成。</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 min-h-0">
        <aside className="space-y-6 min-w-0">
          <Panel title="Script Source" subtitle="选择剧本任务作为 Seedance 源" noPadding><div className="p-4"><ScriptSelector selectedTaskId={currentTaskId} onSelect={onSelectScript} /></div></Panel>
          <Panel title="Script Preview"><ResultViewer maxHeight="max-h-[200px]" title="SCRIPT" content={scriptText || '请选择一个剧本任务。'} /></Panel>
          <Panel title="Progress"><ResultViewer maxHeight="max-h-[300px]" title="SEEDANCE EVENTS" content={progress.length ? progress.join('\n') : '等待 seedance:progress。'} /></Panel>
        </aside>

        <main className="space-y-6 min-w-0">
          <Panel title="Generation Controls" subtitle={workStatus} actions={<ActionBar className="flex-wrap"><ActionButton variant="secondary" onClick={() => selectedTaskId && loadUnits(selectedTaskId)} disabled={!selectedTaskId || busy === 'load'} isLoading={busy === 'load'} icon={<RefreshCw size={16} />}>恢复</ActionButton><ActionButton variant="secondary" onClick={ensureVisualStandards} disabled={!selectedTaskId} isLoading={busy === 'visual'} icon={<Sparkles size={16} />}>自动补齐视觉标准件</ActionButton><ActionButton onClick={runAnalysis} disabled={!selectedTaskId} isLoading={busy === 'analysis'} icon={<Sparkles size={16} />}>Phase A-D</ActionButton><ActionButton variant="secondary" onClick={runAll} disabled={!selectedTaskId || units.length === 0} isLoading={busy === 'all'} icon={<Play size={16} />}>全部生成</ActionButton></ActionBar>}>
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
              <Panel title="Layer 1 · Phase A-D 分析" subtitle={analysis ? 'ready' : 'pending'}>
                <div className="grid grid-cols-2 gap-3 mb-4"><MiniInfo label="总时长" value={analysis?.totalSec || analysis?.total_sec || 'N/A'} /><MiniInfo label="单元数" value={analysis?.totalUnits || analysis?.total_units || units.length || 'N/A'} /></div>
                <ResultViewer maxHeight="max-h-[300px]" title="A-D ANALYSIS" content={analysis ? JSON.stringify(analysis, null, 2) : '等待 A-D 分析结果。'} />
              </Panel>

              <Panel title="Layer 2 · Unit E/F/G 列表" subtitle={`${units.length} units`}>
                {units.length === 0 ? <EmptyState title="暂无 Units" description="完成 A-D 分析后会出现 seedance_units。" icon={<CheckCircle2 size={28} />} /> : <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">{units.map((unit, index) => { const unitIndex = unitIndexOf(unit, index); const status = unitStatus(unit); return <button key={unit.id || unitIndex} onClick={() => setActiveUnitIndex(unitIndex)} className={`w-full rounded-xl border p-3 text-left transition-all ${activeUnitIndex === unitIndex ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06]'}`}><div className="text-sm font-bold text-white/85">Unit {unitIndex + 1} · {unit.sceneType || unit.scene_type || 'scene'}</div><div className="mt-1 text-[11px] text-white/40 font-mono">{status} · {unit.durationSec || unit.duration_sec || '?'}s · shots {unit.subShotCount || unit.sub_shot_count || '?'}</div></button>; })}</div>}
              </Panel>
            </div>
          </Panel>

          <Panel title={`Unit Detail · ${activeUnit ? activeUnitIndex + 1 : '-'}`} subtitle="copyArea / noteAreaJson / status" actions={<ActionBar className="flex-wrap"><ActionButton variant="secondary" onClick={refreshCurrentUnit} disabled={!selectedTaskId || !activeUnit || busy === 'load'} isLoading={busy === 'load'} icon={<RefreshCw size={16} />}>刷新单元</ActionButton><ActionButton variant="secondary" onClick={() => openVisualPrompt('video_seedance_style')} disabled={!selectedTaskId || !activeUnit} icon={<Sparkles size={16} />}>复制型视频模板</ActionButton><ActionButton onClick={() => runUnit(activeUnitIndex)} disabled={!selectedTaskId || !activeUnit || busy === 'unit'} isLoading={busy === 'unit'} icon={<Copy size={16} />}>生成当前单元</ActionButton></ActionBar>}>
            {!activeUnit ? <EmptyState title="请选择一个 Unit" description="左侧完成 A-D 分析后，在 Unit 列表里选择一个单元。" icon={<Clapperboard size={28} />} /> : <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5"><div className="space-y-4"><div className="grid grid-cols-2 gap-3"><MiniInfo label="status" value={unitStatus(activeUnit)} /><MiniInfo label="retry" value={activeUnit.retryCount ?? activeUnit.retry_count ?? 0} /></div>{(activeUnit.errorMessage || activeUnit.error_message) && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200 text-sm">{activeUnit.errorMessage || activeUnit.error_message}</div>}<ResultViewer maxHeight="max-h-[250px]" title="COPY AREA" content={activeUnit.copyArea || activeUnit.copy_area || '尚未生成 copyArea。'} /></div><ResultViewer maxHeight="max-h-[250px]" title="NOTE AREA JSON" content={noteArea ? JSON.stringify(noteArea, null, 2) : '尚未生成 noteAreaJson。'} /></div>}
          </Panel>
        </main>
      </div>
    </PageShell>
  );
}

function MiniInfo({ label, value }: { label: string; value: any }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-white/35 text-[10px] uppercase tracking-[0.18em] mb-1">{label}</div><div className="text-white/85 text-xs font-mono truncate" title={String(value)}>{String(value)}</div></div>;
}
