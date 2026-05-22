import React from 'react';
import { Copy, Terminal } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface ResultViewerProps {
  content: string;
  title?: string;
  maxHeight?: string;
}

export default function ResultViewer({ content, title = 'OUTPUT', maxHeight = 'max-h-[400px]' }: ResultViewerProps) {
  const showToast = useAppStore((s) => s.showToast);

  const handleCopy = () => {
    navigator.clipboard.writeText(content || '');
    showToast({ message: '内容已复制', type: 'success' });
  };

  return (
    <div className="w-full flex flex-col bg-[#050505] border border-white/[0.06] rounded-xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
        <div className="flex items-center gap-2 text-white/40 text-[10px] font-mono tracking-widest font-semibold uppercase min-w-0">
          <Terminal size={12} className="shrink-0" /> <span className="truncate max-w-[200px]">{title}</span>
        </div>
        <button onClick={handleCopy} className="text-white/30 hover:text-white transition-colors p-1 hover:bg-white/5 rounded" title="复制">
          <Copy size={12} />
        </button>
      </div>
      <div className={`p-4 overflow-auto ${maxHeight} custom-scrollbar w-full`}>
        <pre className="text-[11px] text-green-400/80 font-mono whitespace-pre-wrap break-words leading-relaxed w-full">{content || 'NO DATA.'}</pre>
      </div>
    </div>
  );
}
