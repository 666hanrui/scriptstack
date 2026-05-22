import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className = ''
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`w-full rounded-xl border border-white/10 bg-black/20 overflow-hidden transition-colors hover:border-white/20 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 focus:outline-none cursor-pointer"
      >
        <div className="flex flex-col text-left">
          <span className="text-sm font-bold text-white/90 tracking-wide">{title}</span>
          {subtitle && <span className="text-[11px] text-white/40 mt-1 font-mono uppercase tracking-widest">{subtitle}</span>}
        </div>
        <ChevronDown
          size={18}
          className={`text-white/50 transition-transform duration-300 ease-out shrink-0 ml-4 ${
            isOpen ? 'rotate-180 text-white/90' : 'rotate-0'
          }`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'grid grid-rows-[1fr] opacity-100' : 'grid grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-4 pt-0 border-t border-white/5 mt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
