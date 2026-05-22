import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, FileText, Library, Film, Clapperboard, LayoutPanelTop, Sparkles } from 'lucide-react';
import ActionBar, { ActionButton } from '../ui/ActionBar';
import PageShell from '../ui/PageShell';
import { useAppStore } from '../../store/useAppStore';

interface DetailLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export default function DetailLayout({ sidebar, children }: DetailLayoutProps) {
  const navigate = useNavigate();
  const currentTaskId = useAppStore((s) => s.currentTaskId);
  const hasTask = !!currentTaskId;

  return (
    <PageShell maxWidth="max-w-full">
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 min-h-0 h-full">
        <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
          {sidebar}

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="text-xs font-bold text-white/50 tracking-widest uppercase mb-3">
              快捷路由 (Quick Nav)
            </div>
            <ActionBar className="flex-wrap" align="left">
              <ActionButton size="sm" variant="secondary" icon={<FolderKanban size={14} />} onClick={() => navigate('/projects')}>
                项目库
              </ActionButton>
              <ActionButton size="sm" variant={hasTask ? 'primary' : 'secondary'} icon={<FileText size={14} />} onClick={() => navigate('/scripts')}>
                剧本任务
              </ActionButton>
              <ActionButton size="sm" variant="secondary" disabled={!hasTask} icon={<Library size={14} />} onClick={() => navigate('/assets')}>
                资产
              </ActionButton>
              <ActionButton size="sm" variant="secondary" disabled={!hasTask} icon={<Sparkles size={14} />} onClick={() => navigate('/visual-prompts')}>
                视觉工坊
              </ActionButton>
              <ActionButton size="sm" variant="secondary" disabled={!hasTask} icon={<Film size={14} />} onClick={() => navigate('/video')}>
                视频
              </ActionButton>
              <ActionButton size="sm" variant="secondary" disabled={!hasTask} icon={<Clapperboard size={14} />} onClick={() => navigate('/seedance')}>
                Seedance
              </ActionButton>
              <ActionButton size="sm" variant="secondary" disabled={!hasTask} icon={<LayoutPanelTop size={14} />} onClick={() => navigate('/frame-prompt')}>
                逐帧
              </ActionButton>
            </ActionBar>
          </div>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </PageShell>
  );
}
