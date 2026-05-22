import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <div className="w-full h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center bg-transparent border border-dashed border-[var(--border-subtle)] rounded-xl">
      {icon && <div className="text-[var(--text-secondary)] mb-3">{React.cloneElement(icon as React.ReactElement, { size: 40 })}</div>}
      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1.5">{title}</h3>
      {description && <p className="text-xs text-[var(--text-secondary)] max-w-md leading-relaxed mb-5">{description}</p>}
      {(primaryAction || secondaryAction) && <div className="flex items-center gap-4">{primaryAction}{secondaryAction}</div>}
    </div>
  );
}
