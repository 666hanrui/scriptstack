import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Compass, FolderKanban } from 'lucide-react';

export default function ContextStatusBar() {
  const { language } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isZh = language === 'zh';

  const routeNameMap: Record<string, string> = {
    '/': isZh ? '灵感枢纽' : 'Inspiration Hub',
    '/longform': isZh ? '长故事孵化器' : 'Longform Incubator',
    '/workflow': isZh ? '剧本生成向导' : 'Screenplay Guide',
    '/scripts': isZh ? '剧本任务库' : 'Script Tasks',
    '/assets': isZh ? '资产矩阵' : 'Assets Forge',
    '/visual-prompts': isZh ? '视觉提示词工坊' : 'Visual Prompt Forge',
    '/video': isZh ? '视频工作台' : 'Video PromptLab',
    '/frame-prompt': isZh ? '逐镜提示词' : 'Frame PromptLab',
    '/seedance': isZh ? 'Seedance V5' : 'Seedance',
    '/projects': isZh ? '项目控制台' : 'Project Console',
    '/admin': isZh ? '管理员后台' : 'Admin Console',
    '/settings': isZh ? '模型与 API' : 'Model API',
  };
  const routeGuideMap: Record<string, string> = {
    '/': isZh ? '输入核心概念或导入剧本，按 Enter 创建项目。' : 'Enter a concept or import a script, then press Enter.',
    '/longform': isZh ? '先建长篇项目，再导入材料或从概念滚动生成。' : 'Create a series, then import source material or grow from an idea.',
    '/workflow': isZh ? '按左侧步骤生成，确认后进入下一步；Enter 可继续。' : 'Generate the current step, approve, then continue.',
    '/scripts': isZh ? '生成或导入剧本，完成后进入资产扫描。' : 'Generate or import a script, then scan assets.',
    '/assets': isZh ? '扫描角色/场景/道具，保存后进入视觉工坊或逐镜。' : 'Scan assets, save them, then continue to visual prompts or frames.',
    '/visual-prompts': isZh ? '补齐人物、场景、道具英文视觉标准件。' : 'Complete English visual standards for characters, scenes, and props.',
    '/storyboard': isZh ? '检查分镜、资产图和文案后导出故事版资料包。' : 'Review shots, asset images, and copy before exporting.',
    '/video': isZh ? '基于剧本和资产生成视频提示词。' : 'Generate video prompts from the script and assets.',
    '/frame-prompt': isZh ? '生成 Outline，确认后全量逐镜；缺标准件会自动补齐。' : 'Generate an outline, confirm it, then generate all frame prompts.',
    '/seedance': isZh ? '先跑 Phase A-D，再逐个或批量生成镜头单元。' : 'Run Phase A-D first, then generate units one by one or in batch.',
    '/projects': isZh ? '从这里恢复项目上下文，避免重复创建。' : 'Restore project context here instead of recreating work.',
    '/settings': isZh ? '配置模型 API；测试通过后再生成。' : 'Configure model APIs and test them before generation.',
  };

  const currentRouteName = routeNameMap[location.pathname] || (isZh ? '工作空间' : 'Workspace');
  const currentGuide = routeGuideMap[location.pathname] || (isZh ? '按当前页面的主按钮继续。' : 'Continue with the primary action on this page.');

  return (
    <header className="h-14 shrink-0 w-full flex items-center justify-between px-6 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded bg-[var(--surface-muted)] border border-[var(--border-divider)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)] animate-pulse" />
          <span className="text-[var(--text-secondary)] text-[10px] font-bold tracking-widest uppercase truncate max-w-[120px]">{currentRouteName}</span>
        </div>
        <div className="hidden min-w-0 items-center gap-2 rounded border border-[var(--border-divider)] bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] xl:flex">
          <Compass size={13} className="shrink-0 text-[var(--accent)]" />
          <span className="truncate">{currentGuide}</span>
        </div>
      </div>

      <div>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 px-4 py-1.5 rounded text-xs font-semibold bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <FolderKanban size={14} /> {isZh ? '项目库' : 'Projects'}
        </button>
      </div>
    </header>
  );
}
