import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { FolderKanban } from 'lucide-react';

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

  const currentRouteName = routeNameMap[location.pathname] || (isZh ? '工作空间' : 'Workspace');

  return (
    <header className="h-14 shrink-0 w-full flex items-center justify-between px-6 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded bg-[var(--surface-muted)] border border-[var(--border-divider)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)] animate-pulse" />
          <span className="text-[var(--text-secondary)] text-[10px] font-bold tracking-widest uppercase truncate max-w-[120px]">{currentRouteName}</span>
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
