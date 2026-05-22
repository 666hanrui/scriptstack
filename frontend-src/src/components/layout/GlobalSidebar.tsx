import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { Sparkles, Route as RouteIcon, FileText, Library, Film, Layers3, Clapperboard, FolderKanban, Settings, Command, User as UserIcon, LogOut, Camera, ShieldCheck, BookOpen } from 'lucide-react';
import { useTudouBridge } from '../../hooks/useTudouBridge';

export default function GlobalSidebar() {
  const { user, setUser, language, themeMode } = useAppStore();
  const { invoke } = useTudouBridge();
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isZh = language === 'zh';
  const isLight = themeMode === 'light';
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleLogout = async () => {
    await invoke('auth/set-token', { token: '', refreshToken: '' }, { silent: true, hideGlobalError: true }).catch(() => undefined);
    setUser(null);
    setIsMenuOpen(false);
    navigate('/');
    window.location.reload();
  };

  return (
    <aside
      className="relative z-50 h-full w-[64px] flex flex-col items-center py-5 flex-shrink-0 bg-[var(--bg-primary)] border-r border-[var(--border-subtle)]"
    >
      <div className="mb-6 w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent)] shadow-sm">
        <Command size={18} />
      </div>

      <nav className="flex flex-col gap-3 relative w-full px-2">
        <NavItem icon={<Sparkles size={18} />} path="/" currentPath={location.pathname} tooltip={isZh ? '灵感枢纽' : 'Hub'} />
        <NavItem icon={<BookOpen size={18} />} path="/longform" currentPath={location.pathname} tooltip={isZh ? '长故事' : 'Longform'} />
        <NavItem icon={<RouteIcon size={18} />} path="/workflow" currentPath={location.pathname} tooltip={isZh ? '工作流' : 'Workflow'} />
        <NavItem icon={<FileText size={18} />} path="/scripts" currentPath={location.pathname} tooltip={isZh ? '剧本任务' : 'Scripts'} />
        <NavItem icon={<Library size={18} />} path="/assets" currentPath={location.pathname} tooltip={isZh ? '资产矩阵' : 'Assets'} />
        <NavItem icon={<Sparkles size={18} />} path="/visual-prompts" currentPath={location.pathname} tooltip={isZh ? '视觉提示词' : 'Visual Prompts'} />
        <NavItem icon={<Camera size={18} />} path="/storyboard" currentPath={location.pathname} tooltip={isZh ? '故事版' : 'Storyboard'} />

        <div className="w-5 h-px bg-[var(--border-divider)] my-2 mx-auto" />

        <NavItem icon={<Film size={18} />} path="/video" currentPath={location.pathname} tooltip={isZh ? '视频提示词' : 'Video Prompt'} />
        <NavItem icon={<Layers3 size={18} />} path="/frame-prompt" currentPath={location.pathname} tooltip={isZh ? '逐镜提示词' : 'Frame Prompt'} />
        <NavItem icon={<Clapperboard size={18} />} path="/seedance" currentPath={location.pathname} tooltip="Seedance" />

        <div className="w-5 h-px bg-[var(--border-divider)] my-2 mx-auto" />

        <NavItem icon={<FolderKanban size={18} />} path="/projects" currentPath={location.pathname} tooltip={isZh ? '项目库' : 'Projects'} />
        {isAdmin && (
          <>
            <NavItem icon={<ShieldCheck size={18} />} path="/admin" currentPath={location.pathname} tooltip={isZh ? '管理员后台' : 'Admin'} />
            <NavItem icon={<Settings size={18} />} path="/settings" currentPath={location.pathname} tooltip={isZh ? '模型/API' : 'Model API'} />
          </>
        )}
      </nav>

      <div className="mt-auto relative cursor-pointer pt-2 group" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        <div className="relative w-8 h-8 rounded-full bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center transition-all hover:bg-[var(--surface-hover)]">
          <span className="text-[var(--text-primary)] text-xs font-bold tracking-widest">
            {user ? user.username.charAt(0).toUpperCase() : 'U'}
          </span>
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

function NavItem({ icon, path, currentPath, tooltip }: { icon: React.ReactNode; path: string; currentPath: string; tooltip: string }) {
  const navigate = useNavigate();
  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path));
  return (
    <div className="relative group w-full flex justify-center">
      <button
        onClick={() => navigate(path)}
        className={`relative z-10 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
        }`}
      >
        {icon}
      </button>
      <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] rounded opacity-0 -translate-x-2 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap shadow-md">
        {tooltip}
      </div>
    </div>
  );
}
