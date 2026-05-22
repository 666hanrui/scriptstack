import React from 'react';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'max-w-5xl' | 'max-w-7xl' | 'max-w-full';
  scroll?: boolean;
}

export default function PageShell({ children, className = '', maxWidth = 'max-w-7xl', scroll = true }: PageShellProps) {
  return (
    <div className={`w-full h-full ${scroll ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'} px-6 py-6 lg:px-8 lg:py-8 ${className}`}>
      <div className={`${maxWidth} mx-auto flex ${scroll ? 'min-h-full' : 'h-full min-h-0'} flex-col gap-8`}>
        {children}
      </div>
    </div>
  );
}
