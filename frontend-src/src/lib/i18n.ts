import { useAppStore } from '../store/useAppStore';

type Dict = Record<string, string>;

const zh: Dict = {
  // Navigation
  'nav.assets': '资产',
  'nav.scripts': '剧本任务',

  // ProjectsPage
  'project.console.title': '项目控制台',
  'project.console.subtitle': '统一的正本流程流转中枢。选择项目即可衔接到工作流、剧本、资产、Prompt 或 Seedance。',
  'project.new.workflow': '新建工作流',
  'project.new': '创建新项目',
  'project.status.finalized': '已成稿',
  'project.status.ready': '待成稿',
  'project.status.in_progress': '推进中',
  'project.status.unknown': '未知',
  'project.renamed': '项目已重命名',
  'project.rename.failed': '重命名失败',
  'project.delete.confirm': '确认要删除此项目吗？所有数据将丢失。',
  'project.deleted': '项目已删除',
  'project.group.drafting': '推进中',
  'project.group.finalized': '已成稿',
  'project.group.tasks': '后期任务',
  'project.empty.title': '暂无项目档案',
  'project.empty.desc': '您还没有创建过任何项目。点击下方按钮前往灵感枢纽建立您的第一个工作流。',
  'project.queue': '项目队列',
  'project.action.workflow': '工作流',
  'project.action.script': '剧本',
  'project.action.rename': '重命名',
  'project.action.delete': '删除',
  'project.stat.done': '完成',
  
  // ScriptTasksPage
  'script.console.title': '剧本任务 / 验收工作台',
  'script.console.subtitle': '严格对应 script_planning、script_writing、script_review。工作流 finalize、直接生成、导入已有剧本都会汇聚成同一种 script task，并承接资产、视觉工坊、视频、逐镜提示词和 Seedance。',
};

const en: Dict = {
  // Navigation
  'nav.assets': 'Assets',
  'nav.scripts': 'Script Tasks',

  // ProjectsPage
  'project.console.title': 'Project Console',
  'project.console.subtitle': 'Unified canonical routing center. Select a project to continue the original flow.',
  'project.new.workflow': 'New Workflow',
  'project.new': 'Create Project',
  'project.status.finalized': 'Finalized',
  'project.status.ready': 'Ready',
  'project.status.in_progress': 'In Progress',
  'project.status.unknown': 'Unknown',
  'project.renamed': 'Project renamed',
  'project.rename.failed': 'Rename failed',
  'project.delete.confirm': 'Delete this project? All data will be lost.',
  'project.deleted': 'Project deleted',
  'project.group.drafting': 'In Progress',
  'project.group.finalized': 'Finalized',
  'project.group.tasks': 'Post Pipeline',
  'project.empty.title': 'No Projects Found',
  'project.empty.desc': 'You haven\'t created any projects yet. Go to Inspiration Hub to start.',
  'project.queue': 'Project Queue',
  'project.action.workflow': 'Workflow',
  'project.action.script': 'Script',
  'project.action.rename': 'Rename',
  'project.action.delete': 'Delete',
  'project.stat.done': 'done',

  // ScriptTasksPage
  'script.console.title': 'Script Tasks Console',
  'script.console.subtitle': 'Strictly corresponds to script_planning, writing, and review. Merges workflows into task queue.',
};

const dicts = { zh, en };

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  
  const t = (key: string, fallback?: string): string => {
    const text = dicts[language]?.[key];
    return text ?? fallback ?? key;
  };

  return { t, language, isZh: language === 'zh' };
}
