import React, { useState, useRef, useEffect } from "react";
import { listenEvent } from "../../lib/event-bridge";
import { useNavigate } from "react-router-dom";
import { useTudouBridge } from "../../hooks/useTudouBridge";
import { useAppStore } from "../../store/useAppStore";
import type { ProjectRecord, StepVersion } from "../../types/tudou";
import {
  Play,
  Edit3,
  Save,
  RefreshCw,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ClipboardCheck,
  History,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StepEngineProps {
  stepConfig: any;
  isLastStep: boolean;
  activeVersion?: StepVersion | null;
  project?: ProjectRecord | null;
  onProjectChanged?: (project?: ProjectRecord | null) => void;
  onNext: () => void;
}

function normalizeSelfcheck(payload: any) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.selfcheck)) return payload.selfcheck;
  return [payload];
}

function getVersionId(version: StepVersion | any) {
  return version?.id || version?.versionId || version?.version_id || "";
}

function getVersionText(version: StepVersion | any) {
  return version?.output || version?.text || "";
}

function getVersionCreatedAt(version: StepVersion | any) {
  return version?.createdAt || version?.created_at || "";
}

function getVersionNumber(version: StepVersion | any, index: number) {
  return version?.versionNumber || version?.version_number || index + 1;
}

function getFinalizedTaskId(result: any) {
  return result?.scriptTaskId || result?.script_task_id || result?.taskId || result?.task_id || "";
}

function getFinalizedProjectId(result: any) {
  return result?.projectId || result?.project_id || "";
}

export default function StepEngine({
  stepConfig,
  isLastStep,
  activeVersion,
  project,
  onProjectChanged,
  onNext,
}: StepEngineProps) {
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const downstreamProjectId = useAppStore((state) => state.currentProjectId);
  const currentWorkflowProjectId = useAppStore((state) => state.currentWorkflowProjectId);
  const setCurrentTaskId = useAppStore((state) => state.setCurrentTaskId);
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);
  const setCurrentWorkflowProjectId = useAppStore((state) => state.setCurrentWorkflowProjectId);
  const showToast = useAppStore((state) => state.showToast);
  const currentProjectId = currentWorkflowProjectId || (downstreamProjectId?.startsWith("sp_") ? downstreamProjectId : "");

  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelfchecking, setIsSelfchecking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCheckpointing, setIsCheckpointing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState("");
  const [versions, setVersions] = useState<StepVersion[]>([]);
  const [selfcheckItems, setSelfcheckItems] = useState<any[]>([]);
  const [checkpoint, setCheckpoint] = useState("");
  const [error, setError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(getVersionText(activeVersion));
    setIsEditing(false);
    setSelfcheckItems([]);
    setCheckpoint("");
    setVersions([]);
    setShowVersions(false);
    setError("");
  }, [activeVersion?.id, stepConfig.id]);

  useEffect(() => {
    if (!currentProjectId) return;
    let cancelled = false;
    const loadCachedQualityData = async () => {
      try {
        const cached = await invoke<any>(
          "workflow/selfcheck-cached",
          { projectId: currentProjectId, stepNumber: stepConfig.id },
          { silent: true, hideGlobalError: true, timeout: 5000 }
        ).catch(() => null);
        if (!cancelled) setSelfcheckItems(normalizeSelfcheck(cached));

        if (stepConfig.id === 6 || stepConfig.id === 7 || stepConfig.id === 8) {
          const ckpt = await invoke<string | null>(
            "workflow/get-checkpoint",
            { projectId: currentProjectId, trigger: "after-step-6" },
            { silent: true, hideGlobalError: true, timeout: 5000 }
          ).catch(() => null);
          if (!cancelled) setCheckpoint(ckpt || "");
        }
      } catch {
        // Cached quality data is optional; do not block the editor.
      }
    };
    loadCachedQualityData();
    return () => {
      cancelled = true;
    };
  }, [currentProjectId, stepConfig.id, invoke]);

  useEffect(() => {
    if (isGenerating)
      contentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [content, isGenerating]);

  const loadVersions = async () => {
    if (!currentProjectId) return;
    setIsLoadingVersions(true);
    setError("");
    try {
      const rows = await invoke<StepVersion[]>(
        "workflow/versions",
        { projectId: currentProjectId, stepNumber: stepConfig.id },
        { silent: true }
      );
      setVersions(Array.isArray(rows) ? rows : []);
      setShowVersions(true);
    } catch (err: any) {
      setError(err.message || "读取版本历史失败");
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const restoreVersion = async (version: StepVersion | any) => {
    if (!currentProjectId) return;
    const versionId = getVersionId(version);
    if (!versionId) return;
    setRestoringVersionId(versionId);
    setError("");
    try {
      await invoke(
        "workflow/restore-version",
        { projectId: currentProjectId, stepNumber: stepConfig.id, versionId },
        { silent: true }
      );
      setContent(getVersionText(version));
      onProjectChanged?.();
    } catch (err: any) {
      setError(err.message || "恢复版本失败");
    } finally {
      setRestoringVersionId("");
    }
  };

  const ensureCheckpointForLaterSteps = async () => {
    if (!currentProjectId || !(stepConfig.id === 7 || stepConfig.id === 8)) return true;
    if (checkpoint.trim()) return true;
    const existing = await invoke<string | null>(
      "workflow/get-checkpoint",
      { projectId: currentProjectId, trigger: "after-step-6" },
      { silent: true }
    ).catch(() => null);
    if (existing) {
      setCheckpoint(existing);
      return true;
    }
    setError("Step 7/8 生成前需要 after-step-6 checkpoint。请先回到 Step 6 批准并生成 checkpoint。");
    return false;
  };

  const handleIgnite = async () => {
    if (!currentProjectId) return alert("致命错误：缺失 ProjectID");
    const checkpointReady = await ensureCheckpointForLaterSteps();
    if (!checkpointReady) return;
    setIsGenerating(true);
    setContent("");
    setError("");
    setIsEditing(false);

    let streamed = "";
    let unlistenFn: (() => void) | null = null;
    try {
      unlistenFn = await listenEvent("screenplay:stream-chunk", (payload: any) => {
        if (
          payload.projectId === currentProjectId &&
          payload.stepNumber === stepConfig.id
        ) {
          streamed += payload.chunk || "";
          setContent((prev) => prev + (payload.chunk || ""));
        }
      });

      const result = await invoke<any>(
        "workflow/generate",
        { projectId: currentProjectId, stepNumber: stepConfig.id },
        { timeout: 300000 }
      );

      const finalText = result?.text || streamed;
      if (finalText) setContent(finalText);
      onProjectChanged?.();
    } catch (error: any) {
      const message = error.message || "生成失败";
      setError(message);
      setContent(streamed || `\n\n[CRITICAL ERROR] 引擎推演阻断：${message}`);
    } finally {
      if (unlistenFn) unlistenFn();
      setIsGenerating(false);
    }
  };

  const handleSelfcheck = async () => {
    if (!currentProjectId) return alert("致命错误：缺失 ProjectID");
    if (!content.trim()) return;
    setIsSelfchecking(true);
    setError("");
    try {
      const result = await invoke<any>(
        "workflow/selfcheck",
        { projectId: currentProjectId, stepNumber: stepConfig.id },
        { timeout: 300000 }
      );
      setSelfcheckItems(normalizeSelfcheck(result));
      onProjectChanged?.();
    } catch (err: any) {
      setError(err.message || "自检失败");
    } finally {
      setIsSelfchecking(false);
    }
  };

  const saveManualEdit = async () => {
    if (!currentProjectId) return;
    if (!content.trim()) return;
    setIsSavingEdit(true);
    setError("");
    try {
      await invoke(
        "screenplay/update-structured",
        {
          projectId: currentProjectId,
          stepNumber: stepConfig.id,
          structured: { _manualOutput: content },
        },
        { timeout: 120000 }
      );
      setIsEditing(false);
      onProjectChanged?.();
      showToast("手动覆写已保存");
    } catch (err: any) {
      setError(err.message || "保存覆写失败");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const regenerateCheckpoint = async () => {
    if (!currentProjectId) return "";
    setIsCheckpointing(true);
    try {
      const next = await invoke<string>(
        "workflow/regenerate-checkpoint",
        { projectId: currentProjectId, trigger: "after-step-6" },
        { timeout: 300000 }
      );
      setCheckpoint(next || "");
      return next || "";
    } finally {
      setIsCheckpointing(false);
    }
  };

  const finalizeToAssets = async () => {
    if (!currentProjectId) return;
    setIsFinalizing(true);
    try {
      const result = await invoke<any>(
        "workflow/finalize",
        { projectId: currentProjectId },
        { timeout: 300000 }
      );
      const taskId = getFinalizedTaskId(result);
      if (!taskId) throw new Error("finalize 没有返回 scriptTaskId/taskId");
      const nextDownstreamProjectId = getFinalizedProjectId(result);
      setCurrentWorkflowProjectId(currentProjectId);
      setCurrentProjectId(nextDownstreamProjectId || downstreamProjectId || currentProjectId);
      setCurrentTaskId(taskId);
      showToast("工作流已成稿，已进入资产矩阵");
      navigate("/assets");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleApprove = async () => {
    if (!currentProjectId) return alert("致命错误：缺失 ProjectID");
    if (!content.trim() && !isImportFinalize) return;
    setIsApproving(true);
    setError("");
    try {
      const nextStep = isLastStep ? stepConfig.id : stepConfig.id + 1;
      const nextProject = await invoke<ProjectRecord>(
        "workflow/approve",
        { projectId: currentProjectId, stepNumber: stepConfig.id, nextStep },
        { timeout: 120000 }
      );
      if (stepConfig.id === 6) {
        await regenerateCheckpoint();
        onProjectChanged?.();
      } else {
        onProjectChanged?.(nextProject);
      }
      if (isLastStep) {
        await finalizeToAssets();
      } else {
        onNext();
      }
    } catch (err: any) {
      setError(err.message || "批准本步失败");
    } finally {
      setIsApproving(false);
    }
  };

  const doneSteps = project?.doneSteps || project?.done_steps || [];
  const isApproved = doneSteps.includes(stepConfig.id);
  const isImportFinalize = isLastStep && ((project as any)?.init?.path === "import" || Boolean((project as any)?.init?.importedScript || (project as any)?.init?.imported_script));
  const canGenerate = !(isGenerating || isApproving || isSelfchecking || isCheckpointing || isSavingEdit || isFinalizing || isLoadingVersions || Boolean(restoringVersionId));
  const canApprove = (Boolean(content.trim()) || isImportFinalize) && canGenerate;

  return (
    <div className="w-full h-full min-h-0 flex flex-col bg-[#080808]/80 backdrop-blur-2xl rounded-[2rem] border border-white/[0.08] shadow-[0_30px_60px_rgba(0,0,0,0.6)] relative overflow-hidden group">
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-32 blur-[100px] transition-all duration-1000 pointer-events-none ${
          isGenerating || isSelfchecking || isCheckpointing || isSavingEdit || isFinalizing
            ? "bg-indigo-600/30 animate-pulse"
            : "bg-indigo-900/10"
        }`}
      />

      <header className="shrink-0 flex items-center justify-between gap-4 px-8 py-6 border-b border-white/[0.05] relative z-10">
        <div className="flex flex-col">
          <h3 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3">
            {stepConfig.title}
            {isApproved && <CheckCircle2 size={20} className="text-green-400" />}
          </h3>
          <span className="text-[10px] font-mono text-white/30 uppercase mt-1">
            Step Module ID: {stepConfig.id} {activeVersion?.id ? `· Version ${activeVersion.id}` : ""}
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-3">
          <button onClick={handleIgnite} disabled={!canGenerate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all duration-300 disabled:opacity-50 active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            {isGenerating ? <Loader2 className="animate-spin" size={16} /> : content ? <RefreshCw size={16} /> : <Play size={16} className="fill-white" />}
            {isGenerating ? "流式解算中..." : content ? "重新生成" : "生成"}
          </button>
          <button onClick={handleSelfcheck} disabled={!content.trim() || !canGenerate} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-900/30 border border-cyan-500/30 text-cyan-100 font-bold text-sm transition-all duration-300 disabled:opacity-40 hover:bg-cyan-900/50">
            {isSelfchecking ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            自检
          </button>
          <button onClick={() => showVersions ? setShowVersions(false) : loadVersions()} disabled={!currentProjectId || isLoadingVersions} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm transition-all duration-300 disabled:opacity-40 hover:bg-white/10">
            {isLoadingVersions ? <Loader2 className="animate-spin" size={16} /> : <History size={16} />}
            版本
          </button>
          <AnimatePresence>
            {content && !isGenerating && (
              <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} onClick={() => isEditing ? saveManualEdit() : setIsEditing(true)} disabled={isSavingEdit} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${isEditing ? "bg-white text-black" : "bg-white/5 border border-white/10 text-white hover:bg-white/10"}`}>
                {isSavingEdit ? <Loader2 size={16} className="animate-spin" /> : isEditing ? <Save size={16} /> : <Edit3 size={16} />}
                {isEditing ? "保存覆写" : "介入编辑"}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-8 overflow-y-auto custom-scrollbar relative z-10">
        {error && <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}
        {checkpoint && stepConfig.id >= 6 && <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100"><div className="flex items-center gap-2 font-bold mb-2"><ClipboardCheck size={16} /> after-step-6 checkpoint 已存在</div><div className="line-clamp-3 text-emerald-100/70">{checkpoint}</div></div>}
        {showVersions && <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80"><div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2 font-bold"><History size={16} /> 版本历史</div><button className="text-xs text-white/40 hover:text-white" onClick={loadVersions}>刷新</button></div>{versions.length === 0 ? <div className="text-white/35">当前步骤暂无历史版本。</div> : <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">{versions.map((version, index) => { const versionId = getVersionId(version); const active = versionId && versionId === getVersionId(activeVersion); const preview = getVersionText(version).slice(0, 160); return <div key={versionId || index} className={`rounded-xl border p-3 ${active ? "border-indigo-400/40 bg-indigo-500/10" : "border-white/5 bg-black/20"}`}><div className="flex items-center justify-between gap-3"><div><div className="font-bold text-white/90">Version {getVersionNumber(version, index)} {active ? "· 当前" : ""}</div><div className="text-xs text-white/35">{getVersionCreatedAt(version) || versionId}</div></div><button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40" onClick={() => restoreVersion(version)} disabled={active || restoringVersionId === versionId}>{restoringVersionId === versionId ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}恢复</button></div><div className="mt-2 text-xs text-white/45 line-clamp-2 whitespace-pre-wrap">{preview || "无文本预览"}</div></div>; })}</div>}</div>}
        {selfcheckItems.length > 0 && <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100"><div className="flex items-center gap-2 font-bold mb-3"><ShieldCheck size={16} /> 自检结果</div><div className="space-y-2">{selfcheckItems.map((item, index) => <div key={index} className="rounded-xl bg-black/25 border border-white/5 p-3 text-cyan-100/80 whitespace-pre-wrap">{typeof item === "string" ? item : JSON.stringify(item, null, 2)}</div>)}</div></div>}
        {!content && !isGenerating ? <div className="h-full flex flex-col items-center justify-center text-white/20"><Play size={48} className="mb-4 opacity-30" /><p className="tracking-widest uppercase font-mono text-sm">Awaiting Engine Ignition</p><p className="text-xs text-white/30 mt-2">当前步骤还没有 active version 输出。</p></div> : isEditing ? <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-full bg-transparent text-white/90 text-lg leading-loose p-4 focus:outline-none resize-none font-serif custom-scrollbar" autoFocus /> : <div className="prose prose-invert max-w-none font-serif text-lg leading-loose text-white/80 whitespace-pre-wrap">{content}{isGenerating && <span className="inline-block w-[0.6em] h-[1.2em] bg-white/80 align-middle ml-1 animate-[pulse_0.8s_infinite]" />}<div ref={contentEndRef} className="h-10" /></div>}
      </div>

      <div className="shrink-0 px-8 py-5 border-t border-white/[0.05] flex flex-wrap justify-between items-center gap-3 bg-black/20 relative z-10 shadow-[0_-16px_32px_rgba(0,0,0,0.28)]">
        <div className="text-white/30 text-xs font-mono flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${isGenerating || isSelfchecking || isCheckpointing || isSavingEdit || isFinalizing ? "bg-yellow-400 animate-ping" : content ? isApproved ? "bg-green-400" : "bg-cyan-400" : "bg-white/20"}`} />{isGenerating ? "STREAMING DATA..." : isSelfchecking ? "SELF CHECKING..." : isCheckpointing ? "CHECKPOINTING..." : isSavingEdit ? "SAVING EDIT..." : isFinalizing ? "FINALIZING..." : isApproved ? "STEP APPROVED" : content ? "MODULE READY" : "STANDBY"}</div>
        <button onClick={handleApprove} disabled={!canApprove} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black font-bold text-sm transition-all duration-300 disabled:opacity-20 disabled:scale-100 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] group">
          {isApproving || isCheckpointing || isFinalizing ? <Loader2 size={16} className="animate-spin" /> : null}
          {isImportFinalize && !content.trim() ? "导入剧本并进入资产锻造" : isLastStep ? "批准并进入资产锻造" : "批准本步并进入下一步"}
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
