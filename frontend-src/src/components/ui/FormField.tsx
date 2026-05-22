import React, { forwardRef } from 'react';

interface FormFieldProps {
  label: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}

export default function FormField({ label, helperText, children, className = '' }: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <label className="text-xs font-bold text-[var(--text-secondary)] tracking-wider uppercase ml-1">
        {label}
      </label>
      {children}
      {helperText && (
        <span className="text-[11px] text-[var(--text-secondary)] opacity-80 ml-1 leading-relaxed font-medium">
          {helperText}
        </span>
      )}
    </div>
  );
}

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className = '', ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full bg-[var(--field-bg)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] focus:bg-[var(--surface-muted)] hover:border-[var(--border-divider)] transition-all font-mono disabled:opacity-50 shadow-sm ${className}`}
        {...rest}
      />
    );
  }
);
TextInput.displayName = 'TextInput';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = '', rows = 3, ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`w-full bg-[var(--field-bg)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] focus:bg-[var(--surface-muted)] hover:border-[var(--border-divider)] transition-all font-serif resize-y custom-scrollbar disabled:opacity-50 shadow-sm ${className}`}
        {...rest}
      />
    );
  }
);
TextArea.displayName = 'TextArea';

export interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ className = '', children, ...rest }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full bg-[var(--field-bg)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] focus:bg-[var(--surface-muted)] hover:border-[var(--border-divider)] transition-all font-sans disabled:opacity-50 shadow-sm appearance-none ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  }
);
SelectInput.displayName = 'SelectInput';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ value, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{ backgroundColor: value ? 'var(--accent)' : undefined }}
      className={`w-14 h-8 rounded-full p-1 transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${value ? '' : 'bg-white/10'}`}
    >
      <span className={`block w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}
