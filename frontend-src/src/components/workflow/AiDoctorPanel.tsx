import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Activity, Terminal } from "lucide-react";
import { listenEvent } from "../../lib/event-bridge";
import { useTudouBridge } from "../../hooks/useTudouBridge";
import { useAppStore } from "../../store/useAppStore";

export default function AiDoctorPanel() {
  const { invoke, isLoading } = useTudouBridge();
  const {
    isDoctorPanelOpen,
    setDoctorPanelOpen,
    currentWorkflowProjectId,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<{ role: "sys" | "user" | "doc"; text: string }[]>([
    { role: "sys", text: "SYSTEM: 剧本诊断模块在线。" },
    {
      role: "doc",
      text: "创作者你好。你可以让我审查当前设定的逻辑漏洞，或者分析人物动机是否合理。",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, isDoctorPanelOpen]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    listenEvent("doctor:stream-chunk", (payload: any) => {
      const { chunk, projectId } = payload || {};
      if (projectId && currentWorkflowProjectId && projectId !== currentWorkflowProjectId) return;
      setLogs((prev) => {
        const newLogs = [...prev];
        const lastLog = newLogs[newLogs.length - 1];
        if (lastLog && lastLog.role === "doc") lastLog.text += chunk;
        else newLogs.push({ role: "doc", text: chunk });
        return newLogs;
      });
    }).then((fn) => { cleanup = fn; });
    return () => {
      if (cleanup) cleanup();
    };
  }, [currentWorkflowProjectId]);

  const handleAsk = async () => {
    if (!query.trim()) return;
    if (!currentWorkflowProjectId) {
      setLogs((prev) => [
        ...prev,
        { role: "sys", text: "ERROR: 当前没有绑定工作流项目，无法运行剧本医生。" },
      ]);
      return;
    }
    const userQ = query;
    setQuery("");
    setLogs((prev) => [...prev, { role: "user", text: userQ }]);

    try {
      await invoke(
        "workflow/doctor",
        { question: userQ, projectId: currentWorkflowProjectId },
        { silent: true }
      );
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        { role: "sys", text: `ERROR: ${err.message}` },
      ]);
    }
  };

  return (
    <AnimatePresence>
      {isDoctorPanelOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDoctorPanelOpen(false)}
            className="absolute inset-0 z-40 bg-black/20"
          />
          <motion.div
            initial={{ x: "100%", opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: "100%", opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute right-6 top-6 bottom-6 w-[400px] bg-[#001018]/90 backdrop-blur-3xl border border-cyan-500/30 rounded-[2rem] shadow-[-20px_0_60px_rgba(0,180,255,0.15)] z-50 flex flex-col overflow-hidden"
          >
            <div className="h-1 w-full bg-gradient-to-r from-cyan-900 via-cyan-400 to-cyan-900 animate-[pulse_2s_infinite]" />
            <div className="flex items-center justify-between p-6 border-b border-cyan-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cyan-50 tracking-widest">
                    DR. SCRIPTSTACK
                  </h3>
                  <p className="text-[10px] text-cyan-500/70 font-mono">
                    NEURAL DIAGNOSTICS
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDoctorPanelOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-cyan-500/50 hover:text-cyan-300 hover:bg-cyan-500/20 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div
              ref={scrollRef}
              className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6"
            >
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    log.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {log.role === "sys" && (
                    <div className="text-[10px] text-cyan-700 font-mono mb-2 flex items-center gap-1">
                      <Terminal size={10} /> SYSTEM LOG
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] p-4 text-sm leading-relaxed ${
                      log.role === "user"
                        ? "bg-cyan-900/40 text-cyan-50 rounded-2xl rounded-tr-sm border border-cyan-500/20"
                        : log.role === "sys"
                        ? "text-cyan-600 font-mono text-xs"
                        : "bg-black/40 text-cyan-100 rounded-2xl rounded-tl-sm border border-cyan-800/50 shadow-inner"
                    }`}
                  >
                    {log.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-cyan-500 text-xs font-mono">
                  <Activity size={12} className="animate-spin" /> DIAGNOSING...
                </div>
              )}
            </div>
            <div className="p-5 border-t border-cyan-500/10 bg-cyan-950/20">
              <div className="relative group">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                  placeholder="请求诊断分析..."
                  className="w-full bg-black/60 border border-cyan-900/50 rounded-xl py-3 pl-4 pr-12 text-cyan-50 text-sm placeholder-cyan-800 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                />
                <button
                  onClick={handleAsk}
                  disabled={isLoading || !query.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-20 disabled:bg-cyan-900 disabled:text-cyan-500 transition-all"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
