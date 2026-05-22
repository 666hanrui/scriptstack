import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, CheckCircle2, Clapperboard, FileText, Film, FolderKanban, Layers3, Loader2, RefreshCw, Save, SearchCheck, Sparkles, Upload, Wand2 } from 'lucide-react';
import { useTudouBridge } from '../hooks/useTudouBridge';
import { formatDate, getProjectId, getProjectName, getScriptText, getTaskId, getUpdatedAt } from '../lib/format';
import { useTranslation } from '../lib/i18n';
import { useAppStore } from '../store/useAppStore';
import type { ReviewResult, ScriptTask } from '../types/tudou';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ContextMetricGrid from '../components/ui/ContextMetricGrid';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import EmptyState from '../components/ui/EmptyState';
import FormField, { TextArea, TextInput } from '../components/ui/FormField';
import Collapsible from '../components/ui/Collapsible';
import ScriptGenerationForm from '../components/workflow/ScriptGenerationForm';

function parseList(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return Object.entries(parsed).map(([key, val]) => ({ key, value: val }));
    return [parsed];
  } catch {
    return value.trim() ? [value] : [];
  }
}

function normalizeReview(raw: any): ReviewResult | null {
  if (!raw) return null;
  return {
    ...raw,
    issues: raw.issues || parseList(raw.issuesJson || raw.issues_json),
    suggestions: raw.suggestions || parseList(raw.suggestionsJson || raw.suggestions_json),
    dimensions: raw.dimensions || parseList(raw.dimensionsJson || raw.dimensions_json),
  };
}

function resultTaskId(result: any) {
  return result?.taskId || result?.task_id || result?.scriptTaskId || result?.script_task_id || '';
}

function resultProjectId(result: any) {
  return result?.projectId || result?.project_id || '';
}

function itemText(item: any) {
  if (typeof item === 'string') return item;
  if (item?.key) return `${item.key}: ${typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}`;
  if (item?.title && item?.content) return `${item.title}: ${item.content}`;
  if (item?.name && item?.score !== undefined) return `${item.name}: ${item.score} ${item.comment || item.reason || ''}`;
  return JSON.stringify(item, null, 2);
}

function taskMode(task: ScriptTask) {
  const anyTask = task as any;
  return anyTask.mode || anyTask.task?.mode || 'plot';
}

function taskStage(task: ScriptTask) {
  const anyTask = task as any;
  return anyTask.stage || anyTask.task?.stage || 'ready';
}

function resultSections(result: ScriptTask | any) {
  return Array.isArray((result as any)?.sections) ? (result as any).sections : [];
}

function ReviewList({ title, items }: { title: string; items?: any[] }) {
  const rows = Array.isArray(items) ? items : [];
  return (
    <div className="rounded-xl bg-black/25 border border-white/5 p-4 min-h-[140px]">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/35 mb-3">{title}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-white/30">暂无内容</div>
      ) : (
        <div className="space-y-2">
          {rows.map((item, index) => (
            <div key={index} className="rounded-lg bg-white/[0.04] border border-white/[0.05] px-3 py-2 text-sm text-white/75 leading-relaxed">
              {itemText(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScriptTasksPage() {
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setRealm = useAppStore((state) => state.setRealm);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const setCurrentTaskId = useAppStore((state) => state.setCurrentTaskId);
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);
  const showToast = useAppStore((state) => state.showToast);

  const [tasks, setTasks] = useState<ScriptTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ScriptTask | null>(null);
  const [scriptBody, setScriptBody] = useState('');
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    mode: 'plot',
    inputSummary: '',
    genre: '短剧 / 反转 / 情绪冲突',
    style: '强钩子、快节奏、适合短视频连续剧',
    duration: '2分钟',
    audience: '短视频观众',
    tone: '强冲突、强反转、强情绪',
    ending: '结尾反转并留下下一集钩子',
    outputMode: 'full_script',
    episodes: '1',
    customStyle: '',
  });
  const [importBody, setImportBody] = useState('');
  const [sourceProjectId, setSourceProjectId] = useState('');
  const [sourceDraft, setSourceDraft] = useState<any>(null);
  const [sourceMaterialId, setSourceMaterialId] = useState('');
  const [sourceSegments, setSourceSegments] = useState<any[]>([]);
  const [confirmedChunks, setConfirmedChunks] = useState<any[]>([]);
  const [nextEpisodeOptions, setNextEpisodeOptions] = useState<any[]>([]);

  const selectedTaskId = getTaskId(selectedTask);
  const selectedProjectId = selectedTask ? getProjectId(selectedTask) : currentProjectId || '';
  const bodyLength = scriptBody.trim().length;
  const taskStatus = busy ? `处理中：${busy}` : selectedTaskId ? '已选择剧本任务' : '待选择 / 待创建';
  const reviewStatus = review ? `${review.score ?? 'N/A'} · ${review.status || 'done'}` : '未审核';

  const selectedTaskTitle = useMemo(() => {
    if (!selectedTask) return '尚未选择任务';
    return getProjectName(selectedTask) || selectedTaskId || '未命名剧本任务';
  }, [selectedTask, selectedTaskId]);

  useEffect(() => {
    setRealm('valley');
    loadTasks(currentTaskId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRealm]);

  useEffect(() => {
    if (currentTaskId && currentTaskId !== selectedTaskId) {
      const hit = tasks.find((task) => getTaskId(task) === currentTaskId);
      if (hit) selectTask(hit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTaskId, tasks.length]);

  async function loadTasks(selectId?: string) {
    setBusy('load');
    setError('');
    try {
      const rows = await invoke<ScriptTask[]>('script/recent', {}, { silent: true });
      const list = Array.isArray(rows) ? rows : [];
      setTasks(list);
      const targetId = selectId || currentTaskId || '';
      if (targetId) {
        const hit = list.find((item) => getTaskId(item) === targetId);
        if (hit) await selectTask(hit);
      }
    } catch (err: any) {
      setError(err.message || '读取剧本任务失败');
    } finally {
      setBusy('');
    }
  }

  async function selectTask(task: ScriptTask) {
    const taskId = getTaskId(task);
    if (!taskId) return;
    setBusy('load');
    setError('');
    try {
      const full = await invoke<ScriptTask>('script/load', { taskId }, { silent: true });
      const merged = { ...task, ...full };
      setSelectedTask(merged);
      setScriptBody(getScriptText(merged));
      setReview(normalizeReview((merged as any).review));
      setCurrentTaskId(taskId);
      const projectId = getProjectId(merged) || getProjectId(task);
      if (projectId) setCurrentProjectId(projectId);
    } catch (err: any) {
      setError(err.message || '读取剧本详情失败');
    } finally {
      setBusy('');
    }
  }

  async function selectCreatedResult(result: ScriptTask | any, fallbackBody = '') {
    const taskId = resultTaskId(result) || getTaskId(result);
    const projectId = resultProjectId(result) || getProjectId(result);
    if (taskId) setCurrentTaskId(taskId);
    if (projectId) setCurrentProjectId(projectId);
    await loadTasks(taskId);
    if (taskId) {
      setSelectedTask(result);
      setScriptBody(getScriptText(result) || fallbackBody);
    }
  }

  async function saveDraft() {
    setBusy('draft');
    setError('');
    try {
      const result = await invoke<any>('script/save-draft', { mode: formData.mode, input_summary: formData.inputSummary, genre: formData.genre, style: formData.style, duration: formData.duration });
      await selectCreatedResult(result);
      showToast('剧本草稿已保存');
    } catch (err: any) {
      setError(err.message || '保存草稿失败');
    } finally {
      setBusy('');
    }
  }

  async function generateScript() {
    if (!formData.inputSummary.trim()) return setError('请先填写剧情描述');
    setBusy('generate');
    setError('');
    try {
      const result = await invoke<ScriptTask>('script/generate', {
        mode: formData.mode,
        duration: formData.duration,
        inputSummary: formData.inputSummary,
        stylePreset: formData.style,
        genres: formData.genre,
        audience: formData.audience,
        tone: formData.tone,
        ending: formData.ending,
        outputMode: formData.outputMode,
        episodes: formData.episodes,
        customStyle: formData.customStyle,
        existingProjectId: selectedTask ? getProjectId(selectedTask) : undefined,
        existingTaskId: selectedTask ? getTaskId(selectedTask) : undefined,
      }, { timeout: 900000 });
      const sections = resultSections(result);
      const body = getScriptText(result) || sections.map((section: any) => section.content || '').join('\n\n');
      await selectCreatedResult(result, body);
      setReview(null);
      showToast('剧本生成完成');
    } catch (err: any) {
      setError(err.message || '生成剧本失败');
    } finally {
      setBusy('');
    }
  }

  async function importScript() {
    if (!importBody.trim()) return setError('请先粘贴剧本正文');
    setBusy('import');
    setError('');
    try {
      const result = await invoke<ScriptTask>('script/import', { script_body: importBody, input_summary: formData.inputSummary || importBody.slice(0, 180), duration: formData.duration });
      await selectCreatedResult(result, getScriptText(result) || importBody);
      setReview(null);
      setImportBody('');
      showToast('剧本已导入');
    } catch (err: any) {
      setError(err.message || '导入剧本失败');
    } finally {
      setBusy('');
    }
  }

  async function pickImportScriptFile() {
    setBusy('import');
    setError('');
    try {
      const picked = await invoke<any>('select_text_file', {}, { timeout: 900000 });
      if (picked?.cancelled) return;
      setImportBody(picked.content || '');
      if (!formData.inputSummary.trim() && picked.fileName) {
        setFormData((prev) => ({ ...prev, inputSummary: String(picked.fileName).replace(/\.[^.]+$/, '') }));
      }
      showToast(`已读取文件：${picked.fileName || '未命名文件'}`);
    } catch (err: any) {
      setError(err.message || '读取文件失败');
    } finally {
      setBusy('');
    }
  }

  async function pickSourceFile() {
    setBusy('import');
    setError('');
    try {
      const picked = await invoke<any>('select_text_file', {}, { timeout: 900000 });
      if (picked?.cancelled) return;
      setSourceDraft(picked);
      showToast(`已读取文件：${picked.fileName || '未命名文件'}`);
    } catch (err: any) {
      setError(err.message || '读取文件失败');
    } finally {
      setBusy('');
    }
  }

  async function importSourceMaterial() {
    const content = sourceDraft?.content || importBody;
    if (!content?.trim() && !sourceDraft?.filePath) return setError('请先选择文件或粘贴大文本');
    setBusy('import');
    setError('');
    try {
      const result = await invoke<any>('source/import-file', {
        projectId: sourceProjectId || undefined,
        projectName: formData.inputSummary || sourceDraft?.fileName || '长篇项目',
        filePath: sourceDraft?.filePath,
        fileName: sourceDraft?.fileName,
        name: sourceDraft?.fileName || '粘贴文本',
        content,
        materialType: sourceDraft?.materialType,
      }, { timeout: 900000 });
      setSourceProjectId(result.projectId || '');
      setSourceMaterialId(result.sourceMaterialId || '');
      setSourceSegments([]);
      setConfirmedChunks([]);
      showToast('源材料已导入');
    } catch (err: any) {
      setError(err.message || '导入源材料失败');
    } finally {
      setBusy('');
    }
  }

  async function segmentSourceMaterial() {
    if (!sourceMaterialId) return setError('请先导入源材料');
    setBusy('import');
    setError('');
    try {
      const result = await invoke<any>('source/segment', { sourceMaterialId, targetChars: 4000 }, { timeout: 120000 });
      setSourceSegments(Array.isArray(result?.segments) ? result.segments : []);
      setConfirmedChunks([]);
      showToast('已生成粗切建议');
    } catch (err: any) {
      setError(err.message || '切片失败');
    } finally {
      setBusy('');
    }
  }

  function updateSourceSegment(index: number, patch: any) {
    setSourceSegments((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function confirmSourceSegments() {
    if (!sourceMaterialId || sourceSegments.length === 0) return setError('请先生成切片建议');
    setBusy('import');
    setError('');
    try {
      const result = await invoke<any>('source/confirm-chunks', {
        sourceMaterialId,
        chunks: sourceSegments.map((segment, index) => ({
          ...segment,
          chunkIndex: index + 1,
          startChar: segment.startChar ?? 0,
          endChar: segment.endChar ?? (segment.content || '').length,
        })),
      }, { timeout: 120000 });
      const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
      setConfirmedChunks(chunks);
      showToast(`已确认 ${chunks.length || sourceSegments.length} 个切片`);
    } catch (err: any) {
      setError(err.message || '保存切片失败');
    } finally {
      setBusy('');
    }
  }

  async function createEpisodeFromChunks() {
    if (!sourceProjectId) return setError('缺少长篇项目 ID');
    const chunkIds = confirmedChunks.map((chunk) => chunk.id).filter(Boolean);
    if (chunkIds.length === 0) return setError('请先确认切片');
    setBusy('draft');
    setError('');
    try {
      const result = await invoke<any>('episode/create-from-sources', {
        seriesProjectId: sourceProjectId,
        sourceChunkIds: chunkIds,
        title: formData.inputSummary ? `${formData.inputSummary.slice(0, 18)} · 第1集` : undefined,
        duration: formData.duration,
      }, { timeout: 120000 });
      await selectCreatedResult(result, '');
      showToast('Episode 已创建，并绑定到 Script Task');
    } catch (err: any) {
      setError(err.message || '创建 Episode 失败');
    } finally {
      setBusy('');
    }
  }

  async function generateSnapshotAndOptions() {
    if (!selectedTaskId) return setError('请先选择一个 Episode / Script Task');
    setBusy('review');
    setError('');
    try {
      await invoke<any>('episode/snapshot', { taskId: selectedTaskId }, { timeout: 120000 });
      const options = await invoke<any>('episode/next-options', { taskId: selectedTaskId }, { timeout: 120000 });
      setNextEpisodeOptions(Array.isArray(options?.options) ? options.options : []);
      showToast('已生成剧情快照和下一集锚点');
    } catch (err: any) {
      setError(err.message || '生成剧情快照失败');
    } finally {
      setBusy('');
    }
  }

  async function saveBody() {
    if (!selectedTaskId) return;
    setBusy('save');
    setError('');
    try {
      await invoke('script/update-body', { taskId: selectedTaskId, newBody: scriptBody }, { silent: true });
      showToast('剧本正文已保存');
      await loadTasks(selectedTaskId);
    } catch (err: any) {
      setError(err.message || '保存正文失败');
    } finally {
      setBusy('');
    }
  }

  async function runReview() {
    if (!selectedTaskId) return;
    setBusy('review');
    setError('');
    try {
      await invoke('script/update-body', { taskId: selectedTaskId, newBody: scriptBody }, { silent: true });
      const result = await invoke<ReviewResult>('script/review', { taskId: selectedTaskId }, { timeout: 900000 });
      setReview(normalizeReview(result));
      showToast('剧本审核完成');
      await loadTasks(selectedTaskId);
    } catch (err: any) {
      setError(err.message || '剧本审核失败');
    } finally {
      setBusy('');
    }
  }

  function goNext(path: string) {
    if (!selectedTaskId) return setError('请先选择、生成或导入一个 script task');
    setCurrentTaskId(selectedTaskId);
    const projectId = getProjectId(selectedTask || undefined);
    if (projectId) setCurrentProjectId(projectId);
    navigate(path);
  }

  const taskItems = tasks.map((task) => {
    const taskId = getTaskId(task);
    return { task, taskId, title: getProjectName(task) || taskId || '未命名任务' };
  });

  return (
    <PageShell maxWidth="max-w-full">
      <ModuleHeader
        icon={<FileText size={24} />}
        eyebrow="Canonical Script Flow"
        title={t('nav.scripts')}
        actions={
          <ActionBar align="right" className="flex-wrap">
            <ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton>
            <ActionButton variant="secondary" onClick={() => goNext('/assets')} disabled={!selectedTaskId} icon={<Boxes size={16} />}>资产</ActionButton>
            <ActionButton variant="secondary" onClick={() => goNext('/visual-prompts')} disabled={!selectedTaskId} icon={<Sparkles size={16} />}>视觉工坊</ActionButton>
            <ActionButton variant="secondary" onClick={() => goNext('/video')} disabled={!selectedTaskId} icon={<Film size={16} />}>视频</ActionButton>
            <ActionButton variant="secondary" onClick={() => goNext('/frame-prompt')} disabled={!selectedTaskId} icon={<Layers3 size={16} />}>逐镜</ActionButton>
            <ActionButton variant="secondary" onClick={() => goNext('/seedance')} disabled={!selectedTaskId} icon={<Clapperboard size={16} />}>Seedance</ActionButton>
          </ActionBar>
        }
      />

      <ContextMetricGrid metrics={[
        { label: 'Project', value: selectedProjectId || '未绑定', copyable: selectedProjectId || undefined, isMono: true },
        { label: 'Script Task', value: selectedTaskId || '未选择', copyable: selectedTaskId || undefined, isMono: true },
        { label: '正文长度', value: `${bodyLength}` },
        { label: '审核状态', value: reviewStatus },
      ]} />

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 min-h-0">
        <aside className="xl:col-span-3 space-y-6 min-w-0">
          <Panel
            title="任务列表"
            subtitle={taskStatus}
            actions={<ActionButton variant="ghost" size="sm" onClick={() => loadTasks(selectedTaskId)} disabled={busy === 'load'} icon={busy === 'load' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} />}
            noPadding
          >
            {taskItems.length === 0 ? (
              <EmptyState title="暂无剧本任务" description="可以在右侧直接生成，或导入已有剧本。" icon={<FileText size={28} />} />
            ) : (
              <div className="p-3 space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">
                {taskItems.map(({ task, taskId, title }) => (
                  <button key={taskId} onClick={() => selectTask(task)} className={`w-full text-left rounded-xl border p-3 transition-all ${selectedTaskId === taskId ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06]'}`}>
                    <div className="flex items-center gap-2 text-sm font-bold text-white/90 min-w-0"><FileText size={15} className="shrink-0" /><span className="truncate">{title}</span></div>
                    <div className="mt-1 text-[11px] text-white/40 font-mono truncate">{taskMode(task)} · {taskStage(task)} · {formatDate(getUpdatedAt(task))}</div>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="当前任务" subtitle={selectedTaskTitle}>
            <ActionBar className="flex-wrap" align="left">
              <ActionButton size="sm" variant="secondary" onClick={() => goNext('/assets')} disabled={!selectedTaskId} icon={<Boxes size={14} />}>资产</ActionButton>
              <ActionButton size="sm" variant="secondary" onClick={() => goNext('/visual-prompts')} disabled={!selectedTaskId} icon={<Sparkles size={14} />}>视觉工坊</ActionButton>
              <ActionButton size="sm" variant="secondary" onClick={() => goNext('/video')} disabled={!selectedTaskId} icon={<Film size={14} />}>视频</ActionButton>
              <ActionButton size="sm" variant="secondary" onClick={() => goNext('/frame-prompt')} disabled={!selectedTaskId} icon={<Layers3 size={14} />}>逐镜</ActionButton>
              <ActionButton size="sm" variant="secondary" onClick={() => goNext('/seedance')} disabled={!selectedTaskId} icon={<Clapperboard size={14} />}>Seedance</ActionButton>
              <ActionButton size="sm" variant="secondary" onClick={generateSnapshotAndOptions} disabled={!selectedTaskId || busy === 'review'}>下一集锚点</ActionButton>
            </ActionBar>
            {nextEpisodeOptions.length > 0 && (
              <div className="mt-4 space-y-2">
                {nextEpisodeOptions.map((option) => (
                  <div key={option.id || option.title} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/60">
                    <div className="font-bold text-white/85">{option.id} · {option.title}</div>
                    <div className="mt-1 leading-relaxed">{option.anchor}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </aside>

        <main className="xl:col-span-9 grid grid-cols-1 xl:grid-cols-2 gap-8 min-w-0">
          <div className="space-y-8 min-w-0">
            <ScriptGenerationForm
              formData={formData}
              setFormData={setFormData}
              selectedTaskId={selectedTaskId}
              busy={busy}
              onGenerate={generateScript}
              onSaveDraft={saveDraft}
            />

            <Panel title="正文编辑" subtitle="选择、生成或导入剧本后，可在这里编辑正文。" actions={<ActionBar><ActionButton variant="secondary" onClick={saveBody} disabled={!selectedTaskId} isLoading={busy === 'save'} icon={<Save size={16} />}>保存修改</ActionButton><ActionButton variant="primary" onClick={runReview} disabled={!selectedTaskId} isLoading={busy === 'review'} icon={<SearchCheck size={16} />}>运行审核</ActionButton></ActionBar>}>
              <TextArea value={scriptBody} onChange={(event: any) => setScriptBody(event.target.value)} rows={8} placeholder="选择、生成或导入剧本后，可在这里编辑正文。" />
            </Panel>
          </div>

          <aside className="space-y-8 min-w-0">
            <Panel
              title="导入已有剧本"
              subtitle="先选择本地文件或粘贴正文，再点击导入生成 script_task。"
              actions={
                <ActionBar className="flex-wrap">
                  <ActionButton size="sm" variant="secondary" onClick={pickImportScriptFile} isLoading={busy === 'import'} icon={<Upload size={14} />}>选择文件</ActionButton>
                  <ActionButton size="sm" variant="secondary" onClick={importScript} isLoading={busy === 'import'} icon={<Upload size={14} />}>导入</ActionButton>
                </ActionBar>
              }
            >
              <TextArea value={importBody} onChange={(event: any) => setImportBody(event.target.value)} rows={3} placeholder="粘贴已有剧本正文。" />
            </Panel>

            <Panel
              title="长篇源材料"
              subtitle="小说/大文本先进入 Source Material，再由用户确认切片并创建 Episode。"
              actions={<ActionButton size="sm" variant="secondary" onClick={pickSourceFile} isLoading={busy === 'import'} icon={<Upload size={14} />}>选择文件</ActionButton>}
            >
              <div className="space-y-4">
                <FormField label="Series Project ID">
                  <TextInput value={sourceProjectId} onChange={(event: any) => setSourceProjectId(event.target.value)} placeholder="可空，导入时自动创建长篇项目" />
                </FormField>
                {sourceDraft && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/55 space-y-1">
                    <div className="font-bold text-white/80">{sourceDraft.fileName}</div>
                    <div>{sourceDraft.materialType || 'mixed'} · {sourceDraft.encoding || 'unknown'} · {(sourceDraft.content || '').length} 字符</div>
                  </div>
                )}
                <ActionBar className="flex-wrap" align="left">
                  <ActionButton size="sm" onClick={importSourceMaterial} disabled={busy === 'import'} isLoading={busy === 'import'}>导入源材料</ActionButton>
                  <ActionButton size="sm" variant="secondary" onClick={segmentSourceMaterial} disabled={!sourceMaterialId || busy === 'import'}>粗切</ActionButton>
                  <ActionButton size="sm" variant="secondary" onClick={confirmSourceSegments} disabled={sourceSegments.length === 0 || busy === 'import'}>确认切片</ActionButton>
                  <ActionButton size="sm" variant="secondary" onClick={createEpisodeFromChunks} disabled={confirmedChunks.length === 0 || busy === 'draft'}>创建 Episode</ActionButton>
                </ActionBar>
                {(sourceProjectId || sourceMaterialId) && (
                  <div className="text-[11px] font-mono text-white/35 break-all">
                    {sourceProjectId && <div>Series: {sourceProjectId}</div>}
                    {sourceMaterialId && <div>Source: {sourceMaterialId}</div>}
                  </div>
                )}
                {sourceSegments.length > 0 && (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                    {sourceSegments.map((segment, index) => (
                      <div key={index} className="rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-2">
                        <TextInput value={segment.title || ''} onChange={(event: any) => updateSourceSegment(index, { title: event.target.value })} />
                        <TextArea value={segment.content || ''} onChange={(event: any) => updateSourceSegment(index, { content: event.target.value, endChar: (event.target.value || '').length })} rows={4} />
                        <div className="text-[10px] text-white/30">{(segment.content || '').length} 字符 · 切片 #{index + 1}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            {review ? (
              <Panel title="审核结果" subtitle={`Score: ${review.score ?? 'N/A'} · ${review.status || 'done'}`}>
                {review.summary && <div className="rounded-xl bg-white/[0.04] border border-white/[0.05] p-3 text-sm text-white/75 leading-relaxed mb-4">{review.summary}</div>}
                <div className="space-y-4">
                  <ReviewList title="维度评分" items={review.dimensions} />
                  <ReviewList title="问题" items={review.issues} />
                  <ReviewList title="建议" items={review.suggestions} />
                </div>
              </Panel>
            ) : (
              <Panel title="审核结果" subtitle="运行审核后显示结构化结果">
                <EmptyState title="未审核" description="保存正文后点击运行审核，结果会显示分数、问题和建议。" icon={<CheckCircle2 size={28} />} />
              </Panel>
            )}
          </aside>
        </main>
      </div>
    </PageShell>
  );
}
