import { FileText, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTudouBridge } from "../hooks/useTudouBridge";
import { formatDate, getProjectName, getScriptText, getTaskId, getUpdatedAt } from "../lib/format";
import type { ScriptTask } from "../types/tudou";

interface ScriptSelectorProps {
  selectedTaskId?: string | null;
  onSelect: (task: ScriptTask, text: string) => void;
}

export default function ScriptSelector({ selectedTaskId, onSelect }: ScriptSelectorProps) {
  const { invoke, isLoading } = useTudouBridge();
  const [tasks, setTasks] = useState<ScriptTask[]>([]);
  const [error, setError] = useState("");
  const autoSelectedRef = useRef<string | null>(null);

  const loadTasks = async () => {
    setError("");
    try {
      const rows = await invoke<ScriptTask[]>("script/recent", {}, { silent: true });
      setTasks(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      setError(err.message || "加载剧本任务失败");
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (!selectedTaskId || autoSelectedRef.current === selectedTaskId || tasks.length === 0) return;
    const task = tasks.find((item) => getTaskId(item) === selectedTaskId);
    if (!task) return;
    autoSelectedRef.current = selectedTaskId;
    choose(task);
  }, [selectedTaskId, tasks]);

  const choose = async (task: ScriptTask) => {
    const taskId = getTaskId(task);
    if (!taskId) {
      setError("剧本任务缺少 taskId");
      return;
    }
    try {
      const full = await invoke<ScriptTask>("script/load", { taskId }, { silent: true });
      const merged = { ...task, ...full };
      const text = getScriptText(merged) || getScriptText(task);
      if (!text.trim()) {
        setError("已读取任务，但没有找到剧本正文");
      } else {
        setError("");
      }
      onSelect(merged, text);
    } catch (err: any) {
      setError(err.message || "读取剧本文本失败");
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/35">Script Source</p>
          <h3 className="mt-1 text-base font-bold text-white">选择剧本</h3>
        </div>
        <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40" onClick={loadTasks} disabled={isLoading} title="刷新">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>
      {error && <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      <div className="space-y-2">
        {tasks.length === 0 && <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/35">还没有可承接的剧本任务</div>}
        {tasks.map((task) => {
          const taskId = getTaskId(task);
          const active = selectedTaskId === taskId;
          return (
            <button
              key={taskId || JSON.stringify(task)}
              className={`w-full rounded-xl border p-3 text-left transition-all ${active ? "border-indigo-400/45 bg-indigo-500/15 shadow-[0_0_18px_rgba(99,102,241,0.12)]" : "border-white/[0.06] bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]"}`}
              onClick={() => choose(task)}
            >
              <span className="block min-w-0">
                <span className="flex items-center gap-2 truncate text-sm font-bold text-white/85">
                  <FileText size={15} /> {getProjectName(task)}
                </span>
                <span className="mt-1 block truncate text-[11px] font-mono text-white/35">
                  {task.mode || "script"} · {task.stage || "ready"} · {formatDate(getUpdatedAt(task))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
