import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Boxes, CheckCircle2, Circle, Clapperboard, FileText, Film, FolderKanban, Loader2, Sparkles, Stethoscope, Wand2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import StepEngine from '../components/workflow/StepEngine';
import AiDoctorPanel from '../components/workflow/AiDoctorPanel';
import { WORKFLOW_STEPS } from '../constants';
import { getActiveVersion } from '../lib/format';
import type { ProjectRecord } from '../types/tudou';
import { useTudouBridge } from '../hooks/useTudouBridge';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ContextMetricGrid from '../components/ui/ContextMetricGrid';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import EmptyState from '../components/ui/EmptyState';

const asProject = (project?: ProjectRecord | null) => (project || {}) as any;
const projectIdOf = (project: ProjectRecord | null | undefined, fallback = '') => asProject(project).projectId || asProject(project).project_id || fallback;
const linkedTaskIdOf = (project: ProjectRecord | null | undefined) => asProject(project).linkedScriptTaskId || asProject(project).linked_script_task_id || null;
const backendStepOf = (project: ProjectRecord | null | undefined, fallback = 1) => Number(asProject(project).currentStep || asProject(project).current_step || fallback);
const shortId = (value?: string | null) => value ? value.split('-')[0] : 'N/A';
const looksLikeWorkflowProjectId = (value?: string | null) => Boolean(value && value.startsWith('sp_'));

export default function WorkflowValley() {
  const {
    setRealm,
    currentStep,
    setCurrentStep,
    scriptSeed,
    setScriptSeed,
    currentProjectId,
    setCurrentProjectId,
    currentWorkflowProjectId,
    setCurrentWorkflowProjectId,
    currentTaskId,
    setCurrentTaskId,
    isDoctorPanelOpen,
    setDoctorPanelOpen,
    showToast,
  } = useAppStore();
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const [direction, setDirection] = useState(1);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [error, setError] = useState('');
  const [staleProjectId, setStaleProjectId] = useState<string | null>(null);
  const workflowProjectId = currentWorkflowProjectId || (looksLikeWorkflowProjectId(currentProjectId) ? currentProjectId : null);

  useEffect(() => {
    setRealm('valley');
  }, [setRealm]);

  const clearStaleWorkflow = (projectId: string, message: string) => {
    setProject(null);
    setStaleProjectId(projectId);
    setCurrentWorkflowProjectId(null);
    if (currentProjectId === projectId) setCurrentProjectId(null);
    setError(message);
    showToast(message);
  };

  const restoreWorkflowFromTask = async (taskId: string) => {
    const rows = await invoke<any[]>('screenplay/list-recent', { limit: 200 }, { silent: true }).catch(() => []);
    const hit = (Array.isArray(rows) ? rows : []).find((item) => linkedTaskIdOf(item as any) === taskId);
    if (!hit) return null;
    const nextId = projectIdOf(hit as any);
    if (nextId) {
      setCurrentWorkflowProjectId(nextId);
    }
    return hit as ProjectRecord;
  };

  const applyWorkflowProject = (next: ProjectRecord, requestedProjectId: string) => {
    setStaleProjectId(null);
    setProject(next);
    const nextProjectId = projectIdOf(next, requestedProjectId);
    const init = asProject(next).init || {};
    const linkedTaskId = linkedTaskIdOf(next) || currentTaskId || null;
    setScriptSeed(String(init.concept || init.name || scriptSeed || ''));
    setCurrentWorkflowProjectId(nextProjectId);
    setCurrentTaskId(linkedTaskId);
    if (!linkedTaskId) {
      if (!currentProjectId || looksLikeWorkflowProjectId(currentProjectId)) setCurrentProjectId(nextProjectId);
    } else if (currentProjectId === nextProjectId || looksLikeWorkflowProjectId(currentProjectId)) {
      setCurrentProjectId(null);
    }
    const backendStep = backendStepOf(next, 1);
    const nextIndex = Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, backendStep - 1));
    setCurrentStep(nextIndex);
  };

  const reloadProject = async (projectIdOverride?: string | null) => {
    const requestedProjectId = projectIdOverride || workflowProjectId;
    if (!requestedProjectId) {
      if (currentTaskId) {
        setIsLoadingProject(true);
        setError('');
        try {
          const hit = await restoreWorkflowFromTask(currentTaskId);
          if (hit) applyWorkflowProject(hit, projectIdOf(hit, ''));
        } catch (err: any) {
          setError(err.message || '尝试通过剧本任务恢复工作流失败');
        } finally {
          setIsLoadingProject(false);
        }
      }
      return;
    }
    setIsLoadingProject(true);
    setError('');
    try {
      const next = await invoke<ProjectRecord | null>('screenplay/get', { projectId: requestedProjectId }, { silent: true });
      if (!next) {
        if (currentTaskId) {
          const hit = await restoreWorkflowFromTask(currentTaskId);
          if (hit) {
            applyWorkflowProject(hit, projectIdOf(hit, requestedProjectId));
            return;
          }
        }
        clearStaleWorkflow(requestedProjectId, '未找到该工作流项目。已清除失效的工作流选择，请从项目库重新选择，或继续使用已有剧本任务进入资产/Prompt 页面。');
        return;
      }
      applyWorkflowProject(next, requestedProjectId);
    } catch (err: any) {
      setError(err.message || '恢复工作流项目失败');
    } finally {
      setIsLoadingProject(false);
    }
  };

  useEffect(() => {
    reloadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowProjectId, currentTaskId]);

  const activeStep = WORKFLOW_STEPS[currentStep] || WORKFLOW_STEPS[0];
  const activeVersion = useMemo(() => getActiveVersion(project, activeStep.id), [project, activeStep.id]);
  const projectAny = asProject(project);
  const doneSteps = projectAny.doneSteps || projectAny.done_steps || [];
  const completedCount = doneSteps.length;
  const backendCurrentStep = backendStepOf(project, currentStep + 1);
  const projectTitle = String(projectAny.init?.name || projectAny.init?.concept || scriptSeed || '未命名工作流');

  const handleStepChange = (newStep: number) => {
    const safeStep = Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, newStep));
    setDirection(safeStep > currentStep ? 1 : -1);
    setCurrentStep(safeStep);
  };

  const handleProjectChanged = (nextProject?: ProjectRecord | null) => {
    if (nextProject) {
      setProject(nextProject);
      const backendStep = backendStepOf(nextProject, activeStep.id);
      const nextIndex = Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, backendStep - 1));
      setCurrentStep(nextIndex);
      const nextTaskId = linkedTaskIdOf(nextProject);
      if (nextTaskId) setCurrentTaskId(nextTaskId);
      return;
    }
    reloadProject();
  };

  if (!workflowProjectId && isLoadingProject) {
    return (
      <PageShell maxWidth="max-w-5xl">
        <Panel title="正在恢复工作流上下文" subtitle="Workflow Context Recovery" actions={<Loader2 size={18} className="animate-spin text-indigo-300" />}>
          <div className="text-white/55 text-sm leading-6">正在根据当前 Script Task 查找它对应的 screenplay 工作流项目。</div>
        </Panel>
      </PageShell>
    );
  }

  if (!workflowProjectId && staleProjectId) {
    return (
      <PageShell maxWidth="max-w-5xl">
        <Panel title="当前工作流项目锚点已失效" subtitle="Project Anchor Check" actions={<AlertTriangle size={18} className="text-red-300" />}>
          <div className="space-y-6">
            <p className="text-white/60 text-sm leading-6">前端保存的工作流项目 ID 在当前本地项目文件目录中找不到。资产、剧本任务、Prompt 记录可能仍在 SQLite 中，不代表数据全部丢失。</p>
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-100 text-sm font-mono break-all">失效 Project ID：{staleProjectId}</div>
            <ActionBar className="flex-wrap">
              <ActionButton onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>从项目库重新选择</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/')} icon={<Wand2 size={16} />}>返回枢纽新建项目</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>进入剧本任务页</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/assets')} disabled={!currentTaskId} icon={<Boxes size={16} />}>使用当前剧本任务进入资产</ActionButton>
            </ActionBar>
          </div>
        </Panel>
      </PageShell>
    );
  }

  if (!workflowProjectId && currentTaskId) {
    return (
      <PageShell maxWidth="max-w-5xl">
        <Panel title="已选择剧本任务，但没有工作流项目" subtitle="Task Handoff" actions={<FileText size={18} className="text-cyan-300" />}>
          <div className="space-y-6">
            <p className="text-white/60 text-sm leading-6">当前页面已经接收到 Script Task，但八步工作流只能恢复 screenplay 工作流项目。这个任务可以继续进入剧本、资产、视觉工坊、视频和 Seedance；如果要恢复 Step 1-8，请在项目库选择 WORKFLOW 类型项目。</p>
            <ContextMetricGrid metrics={[{ label: 'Script Task', value: shortId(currentTaskId), copyable: currentTaskId, isMono: true }, { label: 'Project', value: '未绑定工作流项目' }, { label: '推荐入口', value: '后期链路' }, { label: 'Workflow', value: '需 WORKFLOW 项目' }]} />
            <ActionBar className="flex-wrap">
              <ActionButton onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>进入剧本任务</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/assets')} icon={<Boxes size={16} />}>资产</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/visual-prompts')} icon={<Sparkles size={16} />}>视觉工坊</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/video')} icon={<Film size={16} />}>视频</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/seedance')} icon={<Clapperboard size={16} />}>Seedance</ActionButton>
              <ActionButton variant="ghost" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>去项目库找 WORKFLOW</ActionButton>
              <ActionButton variant="ghost" onClick={() => navigate('/')} icon={<Wand2 size={16} />}>新建工作流</ActionButton>
            </ActionBar>
          </div>
        </Panel>
      </PageShell>
    );
  }

  if (!workflowProjectId) {
    return (
      <PageShell maxWidth="max-w-5xl">
        <EmptyState
          icon={<Wand2 size={34} />}
          title={scriptSeed ? '缺失工作流项目锚点' : '引擎缺少初始参数'}
          description={scriptSeed ? '当前只恢复到了故事种子，但没有可用于 Step 1-8 的 screenplay 工作流项目 ID。请从项目库打开 WORKFLOW 项目，或返回灵感枢纽重新创建。' : '请返回灵感枢纽输入宇宙碎片，或从项目库打开已有工作流项目。'}
          primaryAction={<ActionButton onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>打开项目库</ActionButton>}
          secondaryAction={<ActionButton variant="secondary" onClick={() => navigate('/')} icon={<Wand2 size={16} />}>返回枢纽</ActionButton>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="max-w-full" scroll={false}>
      <ModuleHeader
        icon={<Wand2 size={24} />}
        eyebrow="Canonical Screenplay Flow"
        title="剧本生成向导"
        actions={
          <ActionBar align="right" className="flex-wrap">
            <ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>剧本</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/assets')} disabled={!currentTaskId} icon={<Boxes size={16} />}>资产</ActionButton>
            <ActionButton variant={isDoctorPanelOpen ? 'primary' : 'secondary'} onClick={() => setDoctorPanelOpen(!isDoctorPanelOpen)} icon={<Stethoscope size={16} />}>剧本诊断</ActionButton>
          </ActionBar>
        }
      />

      <ContextMetricGrid metrics={[
        { label: 'Workflow Project', value: workflowProjectId || '未绑定', copyable: workflowProjectId || undefined, isMono: true },
        { label: 'Downstream Project', value: currentProjectId || '未绑定', copyable: currentProjectId || undefined, isMono: true },
        { label: 'Script Task', value: currentTaskId || '未生成', copyable: currentTaskId || undefined, isMono: true },
        { label: '当前步骤', value: `${backendCurrentStep} / ${WORKFLOW_STEPS.length}` },
      ]} />

      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100/85 leading-6">
        按左侧顺序推进：先生成当前步骤，满意后点击“批准并进入下一步”。当前页支持单按 Enter 执行下一步；在文本框中用 Shift+Enter 换行。
      </div>

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

      <div className="grid flex-1 grid-cols-1 xl:grid-cols-[360px_1fr] gap-6 min-h-0">
        <aside className="flex min-h-0 min-w-0 flex-col gap-6">
          <Panel title="步骤导航" subtitle={projectTitle} className="flex-1" noPadding>
            <div className="h-full p-4 overflow-y-auto custom-scrollbar space-y-3">
              {WORKFLOW_STEPS.map((step, index) => {
                const isActive = currentStep === index;
                const isCompleted = doneSteps.includes(step.id);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepChange(index)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${isActive ? 'bg-indigo-500/20 border-indigo-500/40 shadow-[0_0_24px_rgba(99,102,241,0.15)]' : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06]'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{isCompleted ? <CheckCircle2 size={20} className="text-indigo-300" /> : <Circle size={20} className={isActive ? 'text-indigo-300' : 'text-white/30'} />}</div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-white/70'}`}>{step.title}</div>
                        <div className="text-[11px] text-white/35 mt-1 leading-5 line-clamp-2">{step.desc}</div>
                        <div className="text-[10px] text-white/25 font-mono mt-2">STEP {step.id}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="项目起点" subtitle="当前故事种子" className="shrink-0">
            <div className="text-sm text-white/70 leading-relaxed max-h-[120px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">{scriptSeed || projectAny.init?.concept || projectAny.init?.name || '未命名项目'}</div>
          </Panel>
        </aside>

        <main className="min-w-0 min-h-0 relative">
          <Panel title={activeStep.title} subtitle={`Step ${activeStep.id} · ${activeStep.desc}`} className="h-full min-h-0" noPadding>
            {isLoadingProject && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm"><div className="flex items-center gap-3 text-white/70 bg-black/70 border border-white/10 px-5 py-3 rounded-2xl"><Loader2 size={18} className="animate-spin" /> 正在恢复工作流状态...</div></div>}
            <AnimatePresence initial={false} mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={{
                  enter: (dir: number) => ({ opacity: 0, y: dir > 0 ? 40 : -40, scale: 0.99, filter: 'blur(8px)' }),
                  center: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
                  exit: (dir: number) => ({ opacity: 0, y: dir > 0 ? -40 : 40, scale: 0.99, filter: 'blur(8px)' }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring' as const, stiffness: 280, damping: 32 }}
                className="w-full h-full min-h-0 p-4 overflow-hidden"
              >
                <StepEngine stepConfig={activeStep} isLastStep={currentStep === WORKFLOW_STEPS.length - 1} activeVersion={activeVersion} project={project} onProjectChanged={handleProjectChanged} onNext={() => handleStepChange(currentStep + 1)} />
              </motion.div>
            </AnimatePresence>
          </Panel>
        </main>
      </div>

      <AiDoctorPanel />
    </PageShell>
  );
}
