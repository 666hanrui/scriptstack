import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, X } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export default function GlobalErrorCard() {
  const { globalError, clearError } = useAppStore();

  return (
    <AnimatePresence>
      {globalError && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -20, x: "-50%" }}
          transition={{ type: "spring", damping: 25 }}
          className="fixed top-6 left-1/2 z-[200] w-[520px] max-w-[90vw] bg-red-950/90 backdrop-blur-2xl border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-start gap-4 p-5">
            <AlertOctagon size={24} className="text-red-400 mt-1 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm mb-2">{globalError.title}</h3>
              <p className="text-red-100/80 text-xs mb-3 font-mono break-all line-clamp-4">{globalError.details}</p>
              <div className="text-red-300 text-[11px] font-mono bg-red-900/30 border border-red-500/20 rounded-lg px-3 py-2 mb-3">{globalError.action}</div>
              <p className="text-red-200 text-xs leading-5">{globalError.suggestion}</p>
            </div>
            <button onClick={clearError} className="text-red-300 hover:text-white transition-colors p-1 bg-red-500/10 rounded-md hover:bg-red-500/30">
              <X size={16} />
            </button>
          </div>
          <button onClick={clearError} className="w-full border-t border-red-500/20 py-2.5 text-xs font-bold text-red-200 hover:bg-red-500/20 transition-all">确认并关闭</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
