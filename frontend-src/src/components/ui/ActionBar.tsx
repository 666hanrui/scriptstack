import React from 'react';
import { Loader2 } from 'lucide-react';

interface ActionBarProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'between' | 'center';
}

export default function ActionBar({ children, className = '', align = 'left' }: ActionBarProps) {
  const alignMap = {
    left: 'justify-start',
    right: 'justify-end',
    between: 'justify-between w-full',
    center: 'justify-center',
  };
  return <div className={`flex items-center gap-3 ${alignMap[align]} ${className}`}>{children}</div>;
}

export function ActionButton({ children, variant = 'primary', size = 'md', isLoading, disabled, icon, onClick, title, className = '' }: {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const baseStyle = 'flex items-center justify-center gap-2 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  const variantMap = {
    primary: 'bg-[var(--accent)] hover:opacity-90 text-white shadow-md shadow-[var(--accent-glow)]',
    secondary: 'bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20',
    ghost: 'bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
  };
  const sizeMap = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button data-variant={variant} onClick={onClick} disabled={disabled || isLoading} title={title} className={`${baseStyle} ${variantMap[variant]} ${sizeMap[size]} ${className}`}>
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
