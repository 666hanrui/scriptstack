import React from 'react';

interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function Panel({ title, subtitle, actions, children, footer, className = '', noPadding = false }: PanelProps) {
  return (
    <div className={`min-h-0 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg flex flex-col overflow-hidden transition-colors duration-500 ${className}`}>
      {(title || actions) && (
        <div className="shrink-0 flex flex-col gap-3 px-6 py-5 border-b border-[var(--border-divider)] bg-[var(--surface-muted)] md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col flex-1 min-w-0 pr-4">
            {typeof title === 'string' ? <h3 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight leading-snug">{title}</h3> : title}
            {subtitle && (typeof subtitle !== 'string' || subtitle.length <= 48) && <span className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed font-medium">{subtitle}</span>}
          </div>
          {actions && <div className="flex items-center gap-3 shrink-0 flex-wrap">{actions}</div>}
        </div>
      )}
      <div className={`min-h-0 flex-1 relative ${noPadding ? '' : 'p-6'}`}>{children}</div>
      {footer && <div className="shrink-0 px-6 py-4 border-t border-[var(--border-divider)] bg-[var(--surface-muted)]">{footer}</div>}
    </div>
  );
}
