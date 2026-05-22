import { Activity, Boxes, Clapperboard, FileText, Film, FolderKanban, Layers3, Loader2, Save, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScriptSelector from '../components/ScriptSelector';
import { useTudouBridge } from '../hooks/useTudouBridge';
import { getTaskId, promptSections } from '../lib/format';
import { useAppStore } from '../store/useAppStore';
import type { PromptResult, ReviewResult, ScriptTask } from '../types/tudou';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ContextMetricGrid from '../components/ui/ContextMetricGrid';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import EmptyState from '../components/ui/EmptyState';
import FormField, { TextArea, TextInput } from '../components/ui/FormField';
import ResultViewer from '../components/ui/ResultViewer';
import Collapsible from '../components/ui/Collapsible';

interface PromptLabProps { kind: 'video'; }
function resultTaskId(result: any) { return result?.taskId || result?.task_id || result?.id || ''; }
function projectIdOfTask(task: ScriptTask) {
  const anyTask = task as any;
  return anyTask.projectId || anyTask.project_id || anyTask.task?.projectId || anyTask.task?.project_id || '';
}
function sectionLines(section: any) {
  return Array.isArray(section?.lines) ? section.lines : section?.content ? [section.content] : [];
}

export default function PromptLab({ kind }: PromptLabProps) {
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const setCurrentTaskId = useAppStore((state) => state.setCurrentTaskId);
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);
  const setRealm = useAppStore((state) => state.setRealm);
  const showToast = useAppStore((state) => state.showToast);

  const [task, setTask] = useState<ScriptTask | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [style, setStyle] = useState('电影分镜、真实摄影机运动、节奏清晰');
  const [goal, setGoal] = useState('输出可直接用于视频模型的镜头提示词');
  const [result, setResult] = useState<PromptResult | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState<'generate' | 'review' | ''>('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRealm('valley');
    setStyle('电影分镜、真实摄影机运动、节奏清晰');
    setGoal('输出可直接用于视频模型的镜头提示词');
    setResult(null);
    setReview(null);
    setError('');
  }, [kind, setRealm]);

  const sections = useMemo(() => promptSections(result), [result]);
  const sourceScriptTaskId = getTaskId(task) || currentTaskId || '';
  const generatedPromptTaskId = resultTaskId(result);
  const reviewStatus = review ? `${review.score ?? 'N/A'} · ${review.status || 'done'}` : '未审核';
  const outputStatus = busy === 'generate' ? '生成中' : generatedPromptTaskId ? '已有结果' : '待生成';
  const reviewSummary = (review as any)?.summary || '';

  const onSelectScript = (nextTask: ScriptTask, text: string) => {
    const nextTaskId = getTaskId(nextTask);
    const projectId = projectIdOfTask(nextTask);
    setTask(nextTask);
    setSourceText(text);
    if (nextTaskId) setCurrentTaskId(nextTaskId);
    if (projectId) setCurrentProjectId(projectId);
    setResult(null);
    setReview(null);
    setError('');
  };

  const generate = async () => {
    if (!sourceText.trim()) return setError('请先选择 script task 或粘贴源剧本正文。');
    setBusy('generate');
    setError('');
    setReview(null);
    try {
      const payload = { mode: 'beat', scriptBeats: sourceText, videoStyle: style, motionFocus: goal, existingTaskId: generatedPromptTaskId || undefined, existingProjectId: currentProjectId || undefined, sourceScriptTaskId };
      const next = await invoke<PromptResult>('prompt/video', payload, { timeout: 900000 });
      setResult(next);
      showToast('视频提示词已生成');
    } catch (err: any) {
      setError(err.message || '提示词生成失败');
    } finally {
      setBusy('');
    }
  };

  const runReview = async () => {
    if (!generatedPromptTaskId) return setError('请先生成提示词，再运行审核。');
    setBusy('review');
    setError('');
    try {
      const next = await invoke<ReviewResult>('prompt/video-review', { taskId: generatedPromptTaskId }, { timeout: 900000 });
      setReview(next);
      showToast('提示词审核完成');
    } catch (err: any) {
      setError(err.message || '审核失败');
    } finally {
      setBusy('');
    }
  };

  const openVisualPrompt = () => {
    const params = new URLSearchParams({
      type: 'video_single_shot',
    });
    navigate(`/visual-prompts?${params.toString()}`);
  };

  return (
    <PageShell maxWidth="max-w-full">
      <ModuleHeader
        icon={<Film size={24} />}
        eyebrow="Canonical Independent Prompt Flow"
        title="视频提示词 / 验收工作台"
        actions={<ActionBar align="right" className="flex-wrap"><ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>剧本</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/assets')} disabled={!sourceScriptTaskId} icon={<Boxes size={16} />}>资产</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/video')} disabled={!sourceScriptTaskId} icon={<Film size={16} />}>视频</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/frame-prompt')} disabled={!sourceScriptTaskId} icon={<Layers3 size={16} />}>逐镜</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/seedance')} disabled={!sourceScriptTaskId} icon={<Clapperboard size={16} />}>Seedance</ActionButton><ActionButton variant="secondary" onClick={openVisualPrompt} disabled={!sourceScriptTaskId} icon={<Sparkles size={16} />}>视觉工坊</ActionButton></ActionBar>}
      />

      <ContextMetricGrid metrics={[{ label: 'Project', value: currentProjectId || '未绑定', copyable: currentProjectId || undefined, isMono: true }, { label: 'Source Task', value: sourceScriptTaskId || '未选择', copyable: sourceScriptTaskId || undefined, isMono: true }, { label: 'Prompt Task', value: generatedPromptTaskId || '未生成', copyable: generatedPromptTaskId || undefined, isMono: true }, { label: '审核状态', value: reviewStatus }]} />
      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}
      {review && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/75 text-sm">审核分数：{review.score ?? 'N/A'} · {review.status || 'done'}<br />{reviewSummary}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 min-h-0">
        <aside className="space-y-6 min-w-0">
          <Panel title="Script Source" subtitle="选择剧本任务或手动粘贴源文本" noPadding><div className="p-4"><ScriptSelector selectedTaskId={sourceScriptTaskId} onSelect={onSelectScript} /></div></Panel>
          <Panel title="源剧本正文" subtitle={`长度 ${sourceText.trim().length} · 结果段落 ${sections.length}`}><TextArea value={sourceText} onChange={(event: any) => setSourceText(event.target.value)} rows={4} /></Panel>
        </aside>
        <main className="space-y-6 min-w-0">
          <Panel title="独立视频提示词" subtitle={outputStatus}
            footer={<ActionBar><ActionButton onClick={generate} disabled={!sourceText.trim()} isLoading={busy === 'generate'} icon={<Wand2 size={16} />}>生成提示词</ActionButton><ActionButton variant="secondary" onClick={runReview} disabled={!generatedPromptTaskId} isLoading={busy === 'review'} icon={<Activity size={16} />}>审核</ActionButton><ActionButton variant="secondary" onClick={() => navigate('/frame-prompt')} disabled={!sourceScriptTaskId} icon={<Layers3 size={16} />}>进入逐镜链路</ActionButton><ActionButton variant="secondary" onClick={openVisualPrompt} disabled={!sourceScriptTaskId} icon={<Sparkles size={16} />}>复制型视觉模板</ActionButton></ActionBar>}>
            <Collapsible title="风格参数" subtitle="Visual Style / Motion Focus">
              <div className="space-y-4">
                <FormField label="Video Style"><TextInput value={style} onChange={(event: any) => setStyle(event.target.value)} /></FormField>
                <FormField label="Motion Focus"><TextInput value={goal} onChange={(event: any) => setGoal(event.target.value)} /></FormField>
              </div>
            </Collapsible>
          </Panel>
          {busy === 'generate' && <EmptyState title="提示词生成中" description="本地提示词引擎正在工作。" icon={<Loader2 size={30} className="animate-spin" />} />}
          {!busy && sections.length === 0 && <EmptyState title="等待生成结果" description="选择剧本、设置风格后点击生成提示词。" icon={<Save size={30} />} />}
          {sections.length > 0 && <div className="grid grid-cols-1 gap-5">{sections.map((section, index) => <Panel key={`${section.title}-${index}`} title={section.title || `Segment ${index + 1}`} subtitle={`Segment ${index + 1}`}><ResultViewer maxHeight="max-h-[400px]" title={`PROMPT SEGMENT ${index + 1}`} content={sectionLines(section).join('\n')} /></Panel>)}</div>}
        </main>
      </div>
    </PageShell>
  );
}
