import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AuthModal from './components/AuthModal';
import RouteGuard from './components/router/RouteGuard';
import GlobalErrorBoundary from './components/router/ErrorBoundary';

import InspirationHub from './pages/InspirationHub';
import LongformIncubator from './pages/LongformIncubator';
import WorkflowValley from './pages/WorkflowValley';
import ProjectsPage from './pages/ProjectsPage';
import ScriptTasksPage from './pages/ScriptTasksPage';
import AssetsForge from './pages/AssetsForge';
import PromptLab from './pages/PromptLab';
import SeedancePage from './pages/SeedancePage';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import FramePromptLab from './pages/FramePromptLab';
import VisualPromptForge from './components/visual/VisualPromptForge';
import StoryboardPromptBuilder from './components/visual/StoryboardPromptBuilder';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<InspirationHub />} />
        <Route path="longform" element={<LongformIncubator />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="scripts" element={<ScriptTasksPage />} />
        <Route path="admin" element={
          <RouteGuard requireAdmin><AdminDashboard /></RouteGuard>
        } />
        <Route path="settings" element={
          <RouteGuard requireAdmin><Settings /></RouteGuard>
        } />
        <Route path="flow" element={<Navigate to="/projects" replace />} />

        <Route path="workflow" element={<WorkflowValley />} />

        <Route path="assets" element={
          <RouteGuard requireTaskId><AssetsForge /></RouteGuard>
        } />
        <Route path="image" element={<Navigate to="/visual-prompts" replace />} />
        <Route path="video" element={
          <RouteGuard requireTaskId><PromptLab kind="video" /></RouteGuard>
        } />
        <Route path="seedance" element={
          <RouteGuard requireTaskId><SeedancePage /></RouteGuard>
        } />
        <Route path="frame-prompt" element={
          <RouteGuard requireTaskId><FramePromptLab /></RouteGuard>
        } />
        <Route path="visual-prompts" element={
          <RouteGuard requireTaskId><VisualPromptForge /></RouteGuard>
        } />
        <Route path="storyboard" element={
          <RouteGuard requireTaskId><StoryboardPromptBuilder /></RouteGuard>
        } />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <GlobalErrorBoundary>
        <AuthModal />
        <AppRoutes />
      </GlobalErrorBoundary>
    </HashRouter>
  );
}
