import React from 'react';
import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import GlobalSidebar from '../components/layout/GlobalSidebar';
import ContextStatusBar from '../components/layout/ContextStatusBar';
import GlobalErrorCard from '../components/layout/GlobalErrorCard';

import bgCloudcity from '../../assets/home-bg-cloudcity-D5U4Xepb.jpg';
import bgValley from '../../assets/home-bg-valley-B7cqOehM.jpg';
import bgSamurai from '../../assets/home-bg-samurai-DTWq3wRp.jpg';

const bgMap: Record<string, string> = {
  cloudcity: bgCloudcity,
  valley: bgValley,
  samurai: bgSamurai,
};

export default function MainLayout() {
  const { currentRealm, themeMode, accentColor } = useAppStore();
  const isLight = themeMode === 'light';
  const sceneFilter = isLight
    ? 'saturate(1.08) contrast(1.02) brightness(1.08)'
    : 'saturate(1.12) contrast(1.06) brightness(0.74)';
  const sceneOpacity = isLight ? 0.34 : 0.42;
  const workspaceSurface = isLight ? 'rgba(255,255,255,0.74)' : 'rgba(5,5,5,0.74)';

  return (
    <div
      data-theme={themeMode}
      className={`scriptstack-root relative w-screen h-screen overflow-hidden flex font-sans ${isLight ? 'light' : ''} bg-[var(--bg-primary)]`}
      style={{ '--accent': accentColor, '--workspace-surface': workspaceSurface } as React.CSSProperties}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentRealm}
          initial={{ opacity: 0, scale: 1.04, filter: `${sceneFilter} blur(14px)` }}
          animate={{ opacity: sceneOpacity, scale: 1, filter: `${sceneFilter} blur(0px)` }}
          exit={{ opacity: 0, scale: 0.98, filter: `${sceneFilter} blur(14px)` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -inset-[3%] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bgMap[currentRealm] || bgCloudcity})` }}
        />
      </AnimatePresence>
      <div
        className={`absolute inset-0 pointer-events-none ${
          isLight
            ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.62),rgba(247,249,255,0.48)_48%,rgba(255,255,255,0.68))]'
            : 'bg-[linear-gradient(135deg,rgba(0,0,0,0.66),rgba(0,0,0,0.34)_46%,rgba(0,0,0,0.72))]'
        }`}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background: `linear-gradient(115deg, transparent 0%, ${accentColor}18 30%, transparent 52%, ${accentColor}10 78%, transparent 100%)`,
        }}
      />
      <GlobalSidebar />

      <main className="relative z-10 flex-1 flex flex-col h-full min-w-0 bg-[var(--workspace-surface)] border-l border-[var(--border-subtle)] backdrop-blur-xl">
        <ContextStatusBar />
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </main>
      <GlobalErrorCard />
    </div>
  );
}
