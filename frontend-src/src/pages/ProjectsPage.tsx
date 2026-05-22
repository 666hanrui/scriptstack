import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderKanban, Trash2, Edit2, Play, FileText, Library, Film, Layers3, Clapperboard, Clock, Loader2, Check, X, Sparkles } from 'lucide-react';
import { useTudouBridge } from '../hooks/useTudouBridge';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../lib/i18n';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import EmptyState from '../components/ui/EmptyState';
import { TextInput } from '../components/ui/FormField';

interface ArchiveProject {
  projectId: string;
  projectName: string;
  moduleType: string;
  status: string;
  latestDate: string;
  taskCount: number;
  tasks: any[];
  source: 'screenplay' | 'sqlite';
  raw: any;
  currentStep: number | null;
  doneSteps: number[];
  linkedScriptTaskId: string | null;
  versionCount: number;
  activeVersionCount: number;
}

const toNumber = (value: any, fallback: number | null = null) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeDoneSteps = (value: any): number[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
};

const workflowStatusLabel = (status: string, t: any) => {
  if (status === 'finalized') return t('project.status.finalized');
  if (status === 'ready_to_finalize') return t('project.status.ready');
  if (status === 'in_progress') return t('project.status.in_progress');
  return status || t('project.status.unknown');
};

export default function ProjectsPage() {
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const { setCurrentProjectId, setCurrentWorkflowProjectId, setCurrentTaskId, setScriptSeed, setCurrentStep, setRealm, showToast } = useAppStore();
  const { t, isZh } = useTranslation();

  const [projects, setProjects] = useState<ArchiveProject[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const taskIdOf = (task: any) => task?.taskId || task?.task_id || task?.id || '';

  const primaryScriptTask = (project: ArchiveProject) => {
    if (project.linkedScriptTaskId) return project.linkedScriptTaskId;

    const direct = project.raw?.scriptTaskId || project.raw?.script_task_id || project.raw?.linkedScriptTaskId || project.raw?.linked_script_task_id;
    if (direct) return direct;

    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    const scriptTask = tasks.find((task: any) => taskIdOf(task) && (task.moduleType || task.module_type || 'script') === 'script');
    if (scriptTask) return taskIdOf(scriptTask);

    const anyTask = tasks.find((task: any) => taskIdOf(task));
    return anyTask ? taskIdOf(anyTask) : null;
  };

  const normalizeSqliteProject = (project: any): ArchiveProject => {
    const projectId = project.projectId || project.project_id || project.id || '';
    const linkedScriptTaskId = project.scriptTaskId || project.script_task_id || project.linkedScriptTaskId || project.linked_script_task_id || null;
    const doneSteps = normalizeDoneSteps(project.doneSteps || project.done_steps);
    return {
      projectId,
      projectName: project.projectName || project.project_name || project.name || projectId,
      moduleType: project.moduleType || project.module_type || 'project',
      status: project.status || 'active',
      latestDate: String(project.updatedAt || project.updated_at || project.createdAt || project.created_at || ''),
      taskCount: project.taskCount || project.task_count || (Array.isArray(project.tasks) ? project.tasks.length : 0),
      tasks: Array.isArray(project.tasks) ? project.tasks : [],
      source: 'sqlite',
      raw: project,
      currentStep: toNumber(project.currentStep || project.current_step, null),
      doneSteps,
      linkedScriptTaskId,
      versionCount: toNumber(project.versionCount || project.version_count, 0) || 0,
      activeVersionCount: toNumber(project.activeVersionCount || project.active_version_count, 0) || 0,
    };
  };

  const normalizeScreenplayProject = (summary: any): ArchiveProject | null => {
    const init = summary.init || {};
    const projectId = summary.projectId || summary.project_id || summary.id;
    if (!projectId) return null;

    const linkedTaskId = summary.scriptTaskId || summary.script_task_id || summary.linkedScriptTaskId || summary.linked_script_task_id || null;
    const currentStep = toNumber(summary.currentStep || summary.current_step, 1) || 1;
    const doneSteps = normalizeDoneSteps(summary.doneSteps || summary.done_steps);
    const status = summary.status || (linkedTaskId ? 'finalized' : currentStep >= 8 ? 'ready_to_finalize' : 'in_progress');

    return {
      projectId,
      projectName: init.name || summary.name || init.concept || summary.concept || projectId,
      moduleType: 'workflow',
      status,
      latestDate: String(summary.updatedAt || summary.updated_at || ''),
      taskCount: toNumber(summary.taskCount || summary.task_count, linkedTaskId ? 1 : 0) || 0,
      tasks: linkedTaskId ? [{ taskId: linkedTaskId, moduleType: 'script', stage: 'workflow-finalized', mode: 'workflow', updatedAt: summary.updatedAt || summary.updated_at }] : [],
      source: 'screenplay',
      raw: summary,
      currentStep,
      doneSteps,
      linkedScriptTaskId: linkedTaskId,
      versionCount: toNumber(summary.versionCount || summary.version_count, 0) || 0,
      activeVersionCount: toNumber(summary.activeVersionCount || summary.active_version_count, 0) || 0,
    };
  };

  const loadProjects = async () => {
    setIsFetching(true);
    try {
      const [sqliteRows, screenplayRows] = await Promise.all([
        invoke<any[]>('project/get-all', {}, { silent: true }).catch(() => []),
        invoke<any[]>('screenplay/list-recent', { limit: 50 }, { silent: true }).catch(() => []),
      ]);

      const sqliteProjects = Array.isArray(sqliteRows) ? sqliteRows.map(normalizeSqliteProject) : [];
      const screenplayProjects = (Array.isArray(screenplayRows) ? screenplayRows : []).map(normalizeScreenplayProject).filter(Boolean) as ArchiveProject[];
      const merged = [...sqliteProjects, ...screenplayProjects];
      merged.sort((a, b) => String(b.latestDate || '').localeCompare(String(a.latestDate || '')));
      setProjects(merged);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    setRealm('cloudcity');
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRealm]);

  const startRename = (project: ArchiveProject) => {
    setRenameId(`${project.source}:${project.projectId}`);
    setRenameValue(project.projectName);
  };

  const cancelRename = () => {
    setRenameId(null);
    setRenameValue('');
  };

  const saveRename = async (project: ArchiveProject) => {
    const nextName = renameValue.trim();
    if (!nextName || nextName === project.projectName) {
      cancelRename();
      return;
    }
    try {
      if (project.source === 'screenplay') await invoke('screenplay/rename', { projectId: project.projectId, newName: nextName }, { silent: true });
      else await invoke('project/rename', { projectId: project.projectId, newName: nextName }, { silent: true });
      showToast({ message: t('project.renamed'), type: 'success' });
      await loadProjects();
    } catch {
      showToast({ message: t('project.rename.failed'), type: 'error' });
    } finally {
      cancelRename();
    }
  };

  const removeProject = async (project: ArchiveProject) => {
    if (!window.confirm(t('project.delete.confirm'))) return;
    try {
      if (project.source === 'screenplay') await invoke('screenplay/delete', { projectId: project.projectId });
      else await invoke('project/delete', { projectId: project.projectId });
      showToast({ message: t('project.deleted'), type: 'success' });
      await loadProjects();
    } catch {
      // Global error card displays IPC failures.
    }
  };

  const openWorkflowProject = (project: ArchiveProject) => {
    if (project.source !== 'screenplay') return;
    const taskId = primaryScriptTask(project);
    setCurrentWorkflowProjectId(project.projectId);
    setCurrentProjectId(taskId ? null : project.projectId);
    const init = project.raw?.init || {};
    setScriptSeed(init.concept || init.name || project.projectName);
    setCurrentStep(Math.max(0, Number(project.currentStep || 1) - 1));
    setCurrentTaskId(taskId ? taskId : null);
    navigate('/workflow');
  };

  const openTask = (project: ArchiveProject, stage: 'scripts' | 'assets' | 'image' | 'video' | 'frame-prompt' | 'seedance' | 'visual-prompts') => {
    const taskId = primaryScriptTask(project);
    if (project.source === 'screenplay') setCurrentWorkflowProjectId(project.projectId);
    setCurrentProjectId(project.source === 'screenplay' ? null : project.projectId || null);
    setCurrentTaskId(taskId ? taskId : null);
    const init = project.raw?.init || {};
    setScriptSeed(init.concept || init.name || project.projectName);
    navigate(`/${stage}`);
  };

  const handleRoute = (project: ArchiveProject, stage: 'workflow' | 'scripts' | 'assets' | 'image' | 'video' | 'frame-prompt' | 'seedance' | 'visual-prompts') => {
    if (stage === 'workflow') openWorkflowProject(project);
    else openTask(project, stage);
  };

  const projectGroups = [
    {
      id: 'drafting',
      title: t('project.group.drafting'),
      items: projects.filter((project) => project.source === 'screenplay' && project.status !== 'finalized'),
    },
    {
      id: 'finalized',
      title: t('project.group.finalized'),
      items: projects.filter((project) => project.source === 'screenplay' && project.status === 'finalized'),
    },
    {
      id: 'tasks',
      title: t('project.group.tasks'),
      items: projects.filter((project) => project.source !== 'screenplay'),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <PageShell maxWidth="max-w-full">
      <ModuleHeader
        icon={<FolderKanban size={24} />}
        eyebrow="System Console"
        title={t('project.console.title')}
        actions={<ActionButton onClick={() => navigate('/')} icon={<Play size={16} />}>{t('project.new.workflow')}</ActionButton>}
      />

      {isFetching ? (
        <div className="w-full py-20 flex justify-center text-white/20"><Loader2 size={32} className="animate-spin" /></div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={32} />}
          title={t('project.empty.title')}
          description={t('project.empty.desc')}
          primaryAction={<ActionButton onClick={() => navigate('/')}>{t('project.new')}</ActionButton>}
        />
      ) : (
        <div className="space-y-12">
            {projectGroups.map((group) => (
              <section key={group.id} className="space-y-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{group.title}</h2>
                  <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-mono text-[var(--text-secondary)] border border-[var(--border-divider)]">{group.items.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {group.items.map((project) => {
                    const editKey = `${project.source}:${project.projectId}`;
                    const isRenaming = renameId === editKey;
                    const taskId = primaryScriptTask(project);
                    const hasTask = Boolean(taskId);
                    const isWorkflowProject = project.source === 'screenplay';
                    const doneCount = project.doneSteps.length;
                    const stepText = project.currentStep ? `Step ${project.currentStep}/8` : 'N/A';
                    const progressPercent = project.currentStep ? Math.min(100, Math.max(0, (project.currentStep / 8) * 100)) : 0;
                    return (
                        <div key={editKey} className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--accent)] transition-colors gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                            <div className="min-w-0 flex-1">
                              {isRenaming ? (
                                <div className="flex items-center gap-2">
                                  <TextInput value={renameValue} onChange={(event: any) => setRenameValue(event.target.value)} autoFocus />
                                  <ActionButton size="sm" variant="ghost" onClick={cancelRename} icon={<X size={14} />} />
                                  <ActionButton size="sm" variant="primary" onClick={() => saveRename(project)} icon={<Check size={14} />} />
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <h3 className="font-bold text-[var(--text-primary)] text-base truncate">{project.projectName || project.projectId}</h3>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ActionButton variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={() => startRename(project)} title={t('project.action.rename')} />
                                    <ActionButton variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => removeProject(project)} title={t('project.action.delete')} />
                                  </div>
                                </div>
                              )}
                              {!isRenaming && (
                                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                                  <span className="px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-divider)] font-bold">{isWorkflowProject ? 'WORKFLOW' : 'TASK'}</span>
                                  <span className="text-[var(--accent)] font-medium">{workflowStatusLabel(project.status, t)}</span>
                                  <span className="text-[var(--text-secondary)]">{isWorkflowProject ? stepText : project.moduleType}</span>
                                  <span className="text-[var(--text-secondary)] flex items-center gap-1"><Clock size={12} /> {project.latestDate ? new Date(project.latestDate).toLocaleDateString() : 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {!isRenaming && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
                              <ActionButton variant="secondary" size="sm" disabled={!hasTask} icon={<FileText size={14} />} onClick={() => handleRoute(project, 'scripts')}>{t('project.action.script')}</ActionButton>
                              <ActionButton variant="secondary" size="sm" disabled={!hasTask} icon={<Library size={14} />} onClick={() => handleRoute(project, 'assets')}>{t('nav.assets')}</ActionButton>
                              <ActionButton variant="primary" size="sm" disabled={!isWorkflowProject} icon={<Play size={14} />} onClick={() => handleRoute(project, 'workflow')}>{t('project.action.workflow')}</ActionButton>
                            </div>
                          )}
                        </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
      )}
    </PageShell>
  );
}
