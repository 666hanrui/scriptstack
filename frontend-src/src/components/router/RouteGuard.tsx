import React from "react";
import { useAppStore } from "../../store/useAppStore";
import EmptyStateGuide from "./EmptyStateGuide";

interface RouteGuardProps {
  children: React.ReactNode;
  requireProjectId?: boolean;
  requireTaskId?: boolean;
  requireAdmin?: boolean;
}

export default function RouteGuard({ children, requireProjectId, requireTaskId, requireAdmin }: RouteGuardProps) {
  const { currentProjectId, currentTaskId, user } = useAppStore();

  if (requireAdmin && !user?.isAdmin) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <div className="text-lg font-black text-[var(--text-primary)] mb-2">需要管理员权限</div>
          <div className="text-sm text-[var(--text-secondary)] leading-relaxed">这个页面用于服务端运营、API Key 与用户管理。请使用管理员账号登录。</div>
        </div>
      </div>
    );
  }
  if (requireProjectId && !currentProjectId) return <EmptyStateGuide type="project" />;
  if (requireTaskId && !currentTaskId) return <EmptyStateGuide type="task" />;

  return <>{children}</>;
}
