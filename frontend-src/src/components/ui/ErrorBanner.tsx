import React from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  type?: 'error' | 'success' | 'warning' | 'info';
  className?: string;
}

export default function ErrorBanner({ message, type = 'error', className = '' }: ErrorBannerProps) {
  if (!message) return null;

  const styles = {
    error: 'border-red-500/20 bg-red-500/10 text-red-200',
    success: 'border-green-500/20 bg-green-500/10 text-green-200',
    warning: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-200',
    info: 'border-blue-500/20 bg-blue-500/10 text-blue-200',
  };

  const icons = {
    error: <AlertCircle size={16} />,
    success: <CheckCircle size={16} />,
    warning: <AlertCircle size={16} />,
    info: <Info size={16} />,
  };

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 text-sm ${styles[type]} ${className}`}>
      {icons[type]}
      <span className="break-words">{message}</span>
    </div>
  );
}
