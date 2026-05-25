import { useMemo, useState } from 'react';
import { Activity, Boxes, CheckCircle2, Clapperboard, FileText, Film, FolderKanban, Image as ImageIcon, Layers3, Loader2, RefreshCw, Save, Sparkles, Wand2 } from 'lucide-react';
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
import FormField, { TextArea, TextInput } from '../components/ui/FormField';
import ResultViewer from '../components/ui/ResultViewer';

function projectIdOfTask(task: ScriptTask) {
  const anyTask = task as any;
  return anyTask.projectId || anyTask.project_id || anyTask.task?.projectId || anyTask.task?.project_id || '';
}

function parseJsonMaybe(value: any) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function arrayOf(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function outputSeedanceGroups(output: any): any[] {
  const parsed = parseJsonMaybe(output?.seedanceGroupsJson || output?.seedance_groups_json);
  return Array.isArray(parsed) ? parsed : [];
}

function outputGridGroups(output: any): any {
  return parseJsonMaybe(output?.gridGroupsJson || output?.grid_groups_json);
}

function outlineShots(outline: any): any[] {
  return arrayOf(outline?.shots || outline?.outline?.shots);
}

function outlineTotal(outline: any) {
  const direct = outline?.totalShots ?? outline?.total_shots ?? outline?.outline?.totalShots ?? outline?.outline?.total_shots;
  const n = Number(direct);
  return Number.isFinite(n) && n > 0 ? n : outlineShots(outline).length;
}

function groupSceneIndex(group: any, fallback: number) {
  const direct = group?.sceneIndex ?? group?.scene_index;
  if (direct !== undefined && direct !== null) {
    const n = Number(direct);
    return Number.isFinite(n) ? n : fallback;
  }
  const shotNumber = group?.shotNumber ?? group?.shot_number;
  if (shotNumber !== undefined && shotNumber !== null) {
    const n = Number(shotNumber);
    return Number.isFinite(n) ? n - 1 : fallback;
  }
  return fallback;
}

const busyCopy: Record<string, { title: string; detail: string }> = {
  load: { title: '正在恢复已有输出', detail: '正在从服务器读取 Outline、逐镜结果和视觉标准件。' },
  outline: { title: '正在生成分镜大纲', detail: '大模型正在把剧本拆成可生成的镜头列表，完成后会自动刷新右侧结果。' },
  confirm: { title: '正在确认分镜大纲', detail: '正在保存当前 Outline，后续逐镜生成会以它为准。' },
  all: { title: '正在全量逐镜生成', detail: '这个步骤耗时较长，系统会生成所有镜头的 Seedance / 分镜提示词。' },
  group: { title: '正在生成当前镜头', detail: '只重算右侧选中的单个镜头，完成后会精准回到当前镜头。' },
  save: { title: '正在保存逐镜结果', detail: '正在写入你调整过的 Seedance Groups。' },
  quality: { title: '正在做质量检查', detail: '正在扫描提示词缺漏、格式和可执行性。' },
  visual: { title: '正在补齐视觉标准件', detail: '正在为人物、场景、道具生成英文 AIPROMPT。' },
};

function ProgressNotice({ busy }: { busy: string }) {
  if (!busy) return null;
  const copy = busyCopy[busy] || { title: '正在处理', detail: '任务仍在运行，请等待当前操作完成。' };
  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-indigo-100">
      <div className="flex items-center gap-3">
        <Loader2 size={18} className="animate-spin" />
        <div>
          <div className="text-sm font-bold">{copy.title}</div>
          <div className="mt-1 text-xs text-indigo-100/65 leading-5">{copy.detail}</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 animate-progress-sweep rounded-full bg-indigo-300" />
      </div>
    </div>
  );
}

function isMissingVisualStandardsError(err: any) {
  const message = err instanceof Error ? err.message : String(err || '');
  return message.includes('缺少英文视觉标准件');
}

export default function FramePromptLab() {
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const setCurrentTaskId = useAppStore((state) => state.setCurrentTaskId);
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);
  const showToast = useAppStore((state) => state.showToast);

  const [task, setTask] = useState<ScriptTask | null>(null);
  const [scriptPreview, setScriptPreview] = useState('');
  const [outline, setOutline] = useState<any>(null);
  const [output, setOutput] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [sceneCount, setSceneCount] = useState<any>(null);
  const [segmentTitles, setSegmentTitles] = useState<string[]>([]);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [originalSeedance, setOriginalSeedance] = useState('');
  const [editedSeedanceGroups, setEditedSeedanceGroups] = useState('');
  const [visualOutputs, setVisualOutputs] = useState<any[]>([]);
  const [busy, setBusy] = useState<'load' | 'outline' | 'confirm' | 'all' | 'group' | 'save' | 'quality' | 'visual' | ''>('');
  const [error, setError] = useState('');

  const selectedTaskId = getTaskId(task) || currentTaskId || '';
  const shots = useMemo(() => outlineShots(outline), [outline]);
  const seedanceGroups = useMemo(() => outputSeedanceGroups(output), [output]);
  const gridGroups = useMemo(() => outputGridGroups(output), [output]);
  const activeShot = shots[activeSceneIndex] || null;
  const activeGroup = seedanceGroups.find((group: any, index: number) => groupSceneIndex(group, index) === activeSceneIndex) || seedanceGroups[activeSceneIndex] || null;

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
      mode: 'storyboard',
    }, { timeout: 900000 });
    const list = Array.isArray(rows) ? rows : [];
    mergeVisualOutputs(list);
    return list;
  };

  const runWithVisualAutoRepair = async <T,>(busyState: typeof busy, action: () => Promise<T>) => {
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

  const refreshAll = async (taskId = selectedTaskId) => {
    if (!taskId) return;
    setBusy('load');
    setError('');
    try {
      const [nextOutline, nextOutput, nextSceneCount, nextTitles] = await Promise.all([
        invoke<any>('prompt/get-outline', { taskId }, { silent: true }).catch(() => null),
        invoke<any>('prompt/get-output', { taskId }, { silent: true }).catch(() => null),
        invoke<any>('prompt/get-scene-count', { taskId }, { silent: true }).catch(() => null),
        invoke<string[]>('prompt/get-segment-titles', { taskId }, { silent: true }).catch(() => []),
      ]);
      setOutline(nextOutline);
      setOutput(nextOutput);
      setSceneCount(nextSceneCount);
      setSegmentTitles(Array.isArray(nextTitles) ? nextTitles : []);
      const groups = outputSeedanceGroups(nextOutput);
      setEditedSeedanceGroups(groups.length ? JSON.stringify(groups, null, 2) : '');
      if (currentProjectId) {
        const rows = await invoke<any[]>('visual/list-outputs', { projectId: currentProjectId }, { silent: true }).catch(() => []);
        setVisualOutputs(Array.isArray(rows) ? rows.filter((row) => row.scriptTaskId === taskId || row.script_task_id === taskId) : []);
      }
    } catch (err: any) {
      setError(err.message || '恢复逐镜提示词链路失败');
    } finally {
      setBusy('');
    }
  };

  const onSelectScript = (nextTask: ScriptTask, text: string) => {
    const taskId = getTaskId(nextTask);
    const projectId = projectIdOfTask(nextTask);
    setTask(nextTask);
    setScriptPreview(text);
    setOutline(null);
    setOutput(null);
    setQuality(null);
    setSceneCount(null);
    setSegmentTitles([]);
    setEditedSeedanceGroups('');
    setError('');
    if (taskId) setCurrentTaskId(taskId);
    if (projectId) setCurrentProjectId(projectId);
    if (taskId) refreshAll(taskId);
  };

  const generateOutline = async () => {
    if (!selectedTaskId) return setError('请先选择 script task。');
    try {
      const result = await runWithVisualAutoRepair('outline', () =>
        invoke<any>('prompt/generate-outline', { taskId: selectedTaskId }, { timeout: 900000 })
      );
      setOutline(result?.outline || result);
      showToast('分镜大纲已生成');
      await refreshAll(selectedTaskId);
    } catch (err: any) {
      setError(err.message || '生成分镜大纲失败');
    }
  };

  const confirmOutline = async () => {
    if (!selectedTaskId || !outline) return setError('请先生成或恢复 outline。');
    setBusy('confirm');
    setError('');
    try {
      await invoke('prompt/confirm-outline', { taskId: selectedTaskId, outline }, { timeout: 900000 });
      showToast('分镜大纲已确认');
      await refreshAll(selectedTaskId);
    } catch (err: any) {
      setError(err.message || '确认分镜大纲失败');
    } finally {
      setBusy('');
    }
  };

  const runAll = async () => {
    if (!selectedTaskId) return setError('请先选择 script task。');
    try {
      const result = await runWithVisualAutoRepair('all', () =>
        invoke<any>('prompt/run-generation', { taskId: selectedTaskId }, { timeout: 900000 })
      );
      setOutput({ ...(output || {}), seedanceGroupsJson: JSON.stringify(result?.seedanceGroups || [], null, 2), generationModel: result?.generationModel, createdAt: result?.generatedAt });
      setEditedSeedanceGroups(JSON.stringify(result?.seedanceGroups || [], null, 2));
      showToast('逐镜提示词已全部生成');
      await refreshAll(selectedTaskId);
    } catch (err: any) {
      setError(err.message || '逐镜生成失败');
    }
  };

  const runGroup = async () => {
    if (!selectedTaskId) return setError('请先选择 script task。');
    try {
      const payload: any = { taskId: selectedTaskId, sceneIndex: activeSceneIndex };
      if (reviewFeedback.trim()) payload.reviewFeedback = reviewFeedback;
      if (originalSeedance.trim()) payload.originalSeedance = originalSeedance;
      const result = await runWithVisualAutoRepair('group', () =>
        invoke<any>('prompt/run-group-generation', payload, { timeout: 900000 })
      );
      showToast(`分镜 ${activeSceneIndex + 1} 已重新生成`);
      if (result?.seedanceGroups) setOriginalSeedance(JSON.stringify(result.seedanceGroups[0] || result.seedanceGroups, null, 2));
      await refreshAll(selectedTaskId);
    } catch (err: any) {
      setError(err.message || '单镜生成失败');
    }
  };

  const saveOutput = async () => {
    if (!selectedTaskId) return setError('请先选择 script task。');
    setBusy('save');
    setError('');
    try {
      JSON.parse(editedSeedanceGroups || '[]');
      await invoke('prompt/update-output', { taskId: selectedTaskId, seedanceGroups: editedSeedanceGroups || '[]' }, { timeout: 900000 });
      showToast('Seedance Groups 已保存');
      await refreshAll(selectedTaskId);
    } catch (err: any) {
      setError(err.message || '保存输出失败，请确认 JSON 格式正确。');
    } finally {
      setBusy('');
    }
  };

  const runQuality = async () => {
    if (!selectedTaskId) return setError('请先选择 script task。');
    setBusy('quality');
    setError('');
    try {
      const result = await invoke<any>('prompt/quality-check', { taskId: selectedTaskId }, { timeout: 900000 });
      setQuality(result);
      showToast('Prompt 质量检查完成');
    } catch (err: any) {
      setError(err.message || '质量检查失败');
    } finally {
      setBusy('');
    }
  };

  const ensureVisualStandards = async () => {
    if (!selectedTaskId) return setError('请先选择 script task。');
    setBusy('visual');
    setError('');
    try {
      await generateVisualStandards();
      showToast('逐镜视觉标准件已补齐');
      await refreshAll(selectedTaskId);
    } catch (err: any) {
      setError(err.message || '补齐视觉标准件失败');
    } finally {
      setBusy('');
    }
  };

  const openVisualPrompt = (type = 'shot_keyframe_image') => {
    const params = new URLSearchParams({
      assetType: 'shot',
      shotIndex: String(activeSceneIndex),
      type,
    });
    navigate(`/visual-prompts?${params.toString()}`);
  };

  return (
    <PageShell maxWidth="max-w-full">
      <ModuleHeader
        icon={<Layers3 size={24} />}
        eyebrow="Canonical Frame Prompt Flow"
        title="逐镜分镜提示词 / 原始链路工作台"
        actions={
          <ActionBar align="right" className="flex-wrap">
            <ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>剧本</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/assets')} disabled={!selectedTaskId} icon={<Boxes size={16} />}>资产</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/visual-prompts')} disabled={!selectedTaskId} icon={<Sparkles size={16} />}>视觉工坊</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/video')} disabled={!selectedTaskId} icon={<Film size={16} />}>视频</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/seedance')} disabled={!selectedTaskId} icon={<Clapperboard size={16} />}>Seedance</ActionButton>
            <ActionButton variant="secondary" onClick={() => openVisualPrompt('storyboard_6_panel')} disabled={!selectedTaskId} icon={<Sparkles size={16} />}>视觉工坊</ActionButton>
          </ActionBar>
        }
      />

      <ContextMetricGrid metrics={[
        { label: 'Project', value: currentProjectId || '未绑定', copyable: currentProjectId || undefined, isMono: true },
        { label: 'Script Task', value: selectedTaskId || '未选择', copyable: selectedTaskId || undefined, isMono: true },
        { label: 'Outline Shots', value: `${outlineTotal(outline) || 0}` },
        { label: 'Seedance Groups', value: `${seedanceGroups.length}` },
        { label: '英文视觉标准件', value: `${visualOutputs.length}` },
      ]} />

      <ProgressNotice busy={busy} />
      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}
      {selectedTaskId && visualOutputs.length === 0 && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100 text-sm">
          逐镜链路现在要求人物、场景、道具视觉锚点来自英文 AIPROMPT。生成 Outline 或单镜前，请先补齐视觉标准件。
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 min-h-0">
        <aside className="space-y-6 min-w-0">
          <Panel title="Script Source" subtitle="选择剧本任务作为逐镜提示词源" noPadding>
            <div className="p-4"><ScriptSelector selectedTaskId={selectedTaskId} onSelect={onSelectScript} /></div>
          </Panel>

          <Panel title="生成与恢复控制" subtitle="原始逐镜链路命令入口"
            footer={
              <ActionBar className="flex-col items-stretch">
                <ActionButton variant="secondary" onClick={() => refreshAll()} disabled={!selectedTaskId || busy === 'load'} isLoading={busy === 'load'} icon={<RefreshCw size={16} />}>恢复已有输出</ActionButton>
                <ActionButton onClick={generateOutline} disabled={!selectedTaskId} isLoading={busy === 'outline'} icon={<Wand2 size={16} />}>生成 Outline</ActionButton>
                <ActionButton variant="secondary" onClick={confirmOutline} disabled={!selectedTaskId || !outline} isLoading={busy === 'confirm'} icon={<CheckCircle2 size={16} />}>确认 Outline</ActionButton>
                <ActionButton variant="secondary" onClick={ensureVisualStandards} disabled={!selectedTaskId} isLoading={busy === 'visual'} icon={<Sparkles size={16} />}>自动补齐视觉标准件</ActionButton>
                <ActionButton variant="secondary" onClick={runAll} disabled={!selectedTaskId || !outline} isLoading={busy === 'all'} icon={<Layers3 size={16} />}>全量逐镜生成</ActionButton>
                <ActionButton variant="secondary" onClick={runQuality} disabled={!selectedTaskId} isLoading={busy === 'quality'} icon={<Activity size={16} />}>质量检查</ActionButton>
              </ActionBar>
            }
          >
          </Panel>

          <Panel title="脚本预览" subtitle="Script body preview">
            <ResultViewer maxHeight="max-h-[200px]" title="SCRIPT" content={scriptPreview || '请选择 script task。'} />
          </Panel>

          <Panel title="质量检查" subtitle="prompt/quality-check">
            <ResultViewer title="QUALITY CHECK" content={quality ? JSON.stringify(quality, null, 2) : '尚未运行质量检查。'} />
          </Panel>
        </aside>

        <main className="space-y-6 min-w-0">
          <Panel title="Outline / 分镜大纲" subtitle={`sceneCount=${sceneCount ?? 'N/A'} · titles=${segmentTitles.length}`}>
            {!outline ? (
              <EmptyState title="暂无 Outline" description="点击生成 Outline，或从已有 prompt_output_records 恢复。" icon={<Layers3 size={30} />} />
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
                  <ResultViewer maxHeight="max-h-[400px]" title="OUTLINE JSON" content={JSON.stringify(outline, null, 2)} />
                  <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {shots.map((shot: any, index: number) => (
                      <button key={index} onClick={() => setActiveSceneIndex(index)} className={`w-full rounded-xl border p-3 text-left transition-all ${activeSceneIndex === index ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06]'}`}>
                        <div className="text-sm font-bold text-white/85 truncate">#{index + 1} {shot.title || segmentTitles[index] || 'Untitled'}</div>
                        <div className="mt-1 text-[11px] text-white/40 font-mono truncate">{shot.shotType || shot.shot_type || 'D'} · {(shot.scriptContent || shot.script_content || '').slice(0, 80)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title={`单镜生成 / Scene ${activeSceneIndex + 1}`}
            subtitle="prompt/run-group-generation"
            actions={
              <ActionBar className="flex-wrap" align="right">
                <ActionButton variant="secondary" onClick={() => openVisualPrompt('shot_keyframe_image')} disabled={!selectedTaskId} icon={<ImageIcon size={16} />}>关键帧</ActionButton>
                <ActionButton variant="secondary" onClick={() => openVisualPrompt('storyboard_6_panel')} disabled={!selectedTaskId} icon={<Layers3 size={16} />}>故事版</ActionButton>
                <ActionButton variant="secondary" onClick={() => openVisualPrompt('video_single_shot')} disabled={!selectedTaskId} icon={<Film size={16} />}>视频提示词</ActionButton>
                <ActionButton onClick={runGroup} disabled={!selectedTaskId || !outline} isLoading={busy === 'group'} icon={<Wand2 size={16} />}>生成当前镜</ActionButton>
              </ActionBar>
            }
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="space-y-4">
                <FormField label="sceneIndex"><TextInput type="number" value={activeSceneIndex} onChange={(event: any) => setActiveSceneIndex(Math.max(0, Number(event.target.value) || 0))} /></FormField>
                <FormField label="reviewFeedback"><TextArea value={reviewFeedback} onChange={(event: any) => setReviewFeedback(event.target.value)} rows={3} placeholder="可选：质量检查或人工反馈。" /></FormField>
                <FormField label="originalSeedance"><TextArea value={originalSeedance} onChange={(event: any) => setOriginalSeedance(event.target.value)} rows={3} placeholder="可选：粘贴原始单镜 JSON，用于重生成。" /></FormField>
              </div>
              <div className="space-y-4">
                <ResultViewer title="ACTIVE OUTLINE SHOT" content={activeShot ? JSON.stringify(activeShot, null, 2) : '暂无当前 outline shot。'} />
                <ResultViewer title="ACTIVE GENERATED GROUP" content={activeGroup ? JSON.stringify(activeGroup, null, 2) : '暂无当前已生成提示词。'} />
              </div>
            </div>
          </Panel>

          <Panel title="Prompt Output 恢复 / 编辑" subtitle="prompt/get-output + prompt/update-output" actions={<ActionButton variant="secondary" onClick={saveOutput} disabled={!selectedTaskId} isLoading={busy === 'save'} icon={<Save size={16} />}>保存 Seedance Groups</ActionButton>}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <ResultViewer title="GRID GROUPS / OUTLINE STORED" content={gridGroups ? JSON.stringify(gridGroups, null, 2) : '暂无 gridGroupsJson。'} />
              <FormField label="seedanceGroupsJson"><TextArea value={editedSeedanceGroups} onChange={(event: any) => setEditedSeedanceGroups(event.target.value)} rows={6} placeholder="逐镜生成后可在这里编辑 seedanceGroupsJson。" /></FormField>
            </div>
          </Panel>
        </main>
      </div>
    </PageShell>
  );
}
