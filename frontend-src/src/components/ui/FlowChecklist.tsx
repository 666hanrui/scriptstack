import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

export type FlowStepStatus = 'done' | 'active' | 'pending' | 'working';

export interface FlowChecklistItem {
  label: string;
  detail?: string;
  status: FlowStepStatus;
}

interface FlowChecklistProps {
  title: string;
  items: FlowChecklistItem[];
  className?: string;
}

export default function FlowChecklist({ title, items, className = '' }: FlowChecklistProps) {
  return (
    <section className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Next Path</span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        {items.map((item, index) => {
          const isDone = item.status === 'done';
          const isActive = item.status === 'active' || item.status === 'working';
          return (
            <div
              key={`${item.label}-${index}`}
              className={`flex min-h-[58px] items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                isActive
                  ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10'
                  : isDone
                    ? 'border-emerald-500/20 bg-emerald-500/10'
                    : 'border-[var(--border-divider)] bg-[var(--surface-muted)]'
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${isDone ? 'text-emerald-300' : isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                {item.status === 'working' ? <Loader2 size={16} className="animate-spin" /> : isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-[var(--text-primary)]">{item.label}</div>
                {item.detail && <div className="mt-1 max-h-8 overflow-hidden text-[11px] leading-4 text-[var(--text-secondary)]">{item.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
