import React from 'react';

interface ModuleHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  showSubtitle?: boolean;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
}

export default function ModuleHeader({ eyebrow, title, subtitle, showSubtitle = false, icon, actions, compact = true }: ModuleHeaderProps) {
  void eyebrow;
  return (
    <div className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${compact ? 'mb-4 pb-4' : 'mb-6 pb-6'} border-b border-[var(--border-divider)]`}>
      <div className="flex items-center gap-4 min-w-0">
        {icon && <div className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent)] shrink-0`}>{icon}</div>}
        <div className="min-w-0">
          <h1 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-[var(--text-primary)] tracking-tight truncate`}>{title}</h1>
          {subtitle && showSubtitle && <p className="text-sm text-[var(--text-secondary)] mt-1.5 font-medium truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 flex-wrap justify-start lg:justify-end">{actions}</div>}
    </div>
  );
}
