import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { Sparkles, Route as RouteIcon, FileText, Library, Film, Layers3, Clapperboard, FolderKanban, Settings, Command, User as UserIcon, LogOut, Camera, ShieldCheck, BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTudouBridge } from '../../hooks/useTudouBridge';
import { clearSessionAuth } from '../../lib/api-client';

export default function GlobalSidebar() {
  const { user, setUser, language, sidebarPinned, setSidebarPinned } = useAppStore();
  const { invoke } = useTudouBridge();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const isZh = language === 'zh';
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');
  const expanded = sidebarPinned || isHovering || isMenuOpen;

  const handleLogout = async () => {
    clearSessionAuth();
    await invoke('auth/set-token', { token: '', refreshToken: '' }, { silent: true, hideGlobalError: true }).catch(() => undefined);
    setUser(null);
    setIsMenuOpen(false);
    navigate('/');
    window.location.reload();
  };

  return (
    <aside
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`relative z-50 h-full flex flex-col py-5 flex-shrink-0 bg-[var(--bg-primary)] border-r border-[var(--border-subtle)] transition-[width] duration-200 ease-out ${expanded ? 'w-[220px]' : 'w-[52px]'}`}
    >
      <div className={`mb-5 flex items-center gap-3 px-2 ${expanded ? 'justify-between' : 'justify-center'}`}>
        <button
          onClick={() => navigate('/')}
          className="h-9 w-9 shrink-0 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent)] shadow-sm"
          title={isZh ? '回到灵感枢纽' : 'Back to hub'}
        >
          <Command size={18} />
        </button>
        {expanded && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-[var(--text-primary)]">ScriptStack</div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">{isZh ? '生产导航' : 'Production Nav'}</div>
          </div>
        )}
        {expanded && (
          <button
            onClick={() => setSidebarPinned(!sidebarPinned)}
            className="h-8 w-8 shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] flex items-center justify-center"
            title={sidebarPinned ? (isZh ? '取消固定侧栏' : 'Unpin sidebar') : (isZh ? '固定侧栏' : 'Pin sidebar')}
          >
            {sidebarPinned ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        )}
      </div>

      <nav className="relative flex w-full flex-col gap-2 px-2">
        <NavItem icon={<Sparkles size={18} />} path="/" currentPath={location.pathname} label={isZh ? '灵感枢纽' : 'Hub'} expanded={expanded} />
        <NavItem icon={<BookOpen size={18} />} path="/longform" currentPath={location.pathname} label={isZh ? '长故事' : 'Longform'} expanded={expanded} />
        <NavItem icon={<RouteIcon size={18} />} path="/workflow" currentPath={location.pathname} label={isZh ? '剧本生成向导' : 'Screenplay Guide'} expanded={expanded} />
        <NavItem icon={<FileText size={18} />} path="/scripts" currentPath={location.pathname} label={isZh ? '剧本任务' : 'Scripts'} expanded={expanded} />
        <NavItem icon={<Library size={18} />} path="/assets" currentPath={location.pathname} label={isZh ? '资产矩阵' : 'Assets'} expanded={expanded} />
        <NavItem icon={<Sparkles size={18} />} path="/visual-prompts" currentPath={location.pathname} label={isZh ? '视觉提示词' : 'Visual Prompts'} expanded={expanded} />
        <NavItem icon={<Camera size={18} />} path="/storyboard" currentPath={location.pathname} label={isZh ? '故事版' : 'Storyboard'} expanded={expanded} />

        <div className="w-5 h-px bg-[var(--border-divider)] my-2 mx-auto" />

        <NavItem icon={<Film size={18} />} path="/video" currentPath={location.pathname} label={isZh ? '视频提示词' : 'Video Prompt'} expanded={expanded} />
        <NavItem icon={<Layers3 size={18} />} path="/frame-prompt" currentPath={location.pathname} label={isZh ? '逐镜提示词' : 'Frame Prompt'} expanded={expanded} />
        <NavItem icon={<Clapperboard size={18} />} path="/seedance" currentPath={location.pathname} label="Seedance" expanded={expanded} />

        <div className="w-5 h-px bg-[var(--border-divider)] my-2 mx-auto" />

        <NavItem icon={<FolderKanban size={18} />} path="/projects" currentPath={location.pathname} label={isZh ? '项目库' : 'Projects'} expanded={expanded} />
        {isAdmin && (
          <>
            <NavItem icon={<ShieldCheck size={18} />} path="/admin" currentPath={location.pathname} label={isZh ? '管理员后台' : 'Admin'} expanded={expanded} />
            <NavItem icon={<Settings size={18} />} path="/settings" currentPath={location.pathname} label={isZh ? '模型/API' : 'Model API'} expanded={expanded} />
          </>
        )}
      </nav>

      <div className={`mt-auto relative cursor-pointer px-2 pt-2 ${expanded ? 'w-full' : 'self-center'}`} onClick={() => setIsMenuOpen(!isMenuOpen)}>
        <div className={`relative rounded-full bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center transition-all hover:bg-[var(--surface-hover)] ${expanded ? 'h-10 w-full justify-start gap-3 px-3' : 'w-8 h-8 justify-center'}`}>
          <span className="text-[var(--text-primary)] text-xs font-bold tracking-widest">
            {user ? user.username.charAt(0).toUpperCase() : 'U'}
          </span>
          {expanded && <span className="truncate text-xs font-semibold text-[var(--text-secondary)]">{user?.username || (isZh ? '未登录' : 'Guest')}</span>}
        </div>
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 10, y: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 10, y: 10 }}
              className="absolute bottom-[110%] left-full mb-1 w-44 bg-[#0d0d0d]/95 backdrop-blur-3xl border border-white/[0.08] rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex flex-col p-1.5 z-50 origin-bottom-left"
            >
              <button className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.06] rounded-xl text-white/80 text-xs font-medium transition-colors text-left group/btn">
                <UserIcon size={14} className="text-white/40 group-hover/btn:text-white/80 transition-colors" /> {isZh ? '个人中心' : 'Profile'}
              </button>
              <div className="w-full h-px bg-white/[0.04] my-1" />
              <button onClick={handleLogout} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-rose-500/10 text-rose-400 rounded-xl text-xs font-medium transition-colors text-left group/btn">
                <LogOut size={14} className="text-rose-500/50 group-hover/btn:text-rose-400 transition-colors" /> {isZh ? '退出登录' : 'Logout'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function NavItem({ icon, path, currentPath, label, expanded }: { icon: React.ReactNode; path: string; currentPath: string; label: string; expanded: boolean }) {
  const navigate = useNavigate();
  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path));
  return (
    <div className={`relative group w-full flex ${expanded ? 'justify-start' : 'justify-center'}`}>
      <button
        onClick={() => navigate(path)}
        aria-label={label}
        title={expanded ? label : undefined}
        className={`relative z-10 h-10 flex items-center rounded-xl transition-all duration-200 ${
          expanded ? 'w-full justify-start gap-3 px-3' : 'w-10 justify-center'
        } ${
          isActive
            ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
        }`}
      >
        {icon}
        {expanded && <span className="truncate text-xs font-bold">{label}</span>}
      </button>
      {!expanded && (
        <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] rounded opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap shadow-md">
          {label}
        </div>
      )}
    </div>
  );
}
