import React from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Sparkles, AlertCircle, FileText, Boxes, Film, Clapperboard } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

interface EmptyStateProps {
  type: "project" | "task";
}

export default function EmptyStateGuide({ type }: EmptyStateProps) {
  const navigate = useNavigate();
  const language = useAppStore((state) => state.language);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentTaskId = useAppStore((state) => state.currentTaskId);
  const isZh = language === "zh";

  const hasTaskWithoutProject = type === "project" && Boolean(currentTaskId) && !currentProjectId;
  const hasProjectWithoutTask = type === "task" && Boolean(currentProjectId) && !currentTaskId;

  const title = hasTaskWithoutProject
    ? isZh ? "已选择剧本任务，但不是工作流项目" : "Script task selected, no workflow project"
    : hasProjectWithoutTask
      ? isZh ? "已选择工作流项目，但还没有剧本任务" : "Workflow selected, no script task yet"
      : type === "project"
        ? isZh ? "缺失工作流上下文" : "Missing Workflow Context"
        : isZh ? "缺失剧本任务上下文" : "Missing Script Task Context";

  const description = hasTaskWithoutProject
    ? isZh
      ? "当前已经有 Script Task，可以继续进入剧本、资产、视觉工坊、视频或 Seedance。若要恢复 Step 1-8，请在项目库选择 WORKFLOW 类型项目。"
      : "A Script Task is selected. You can continue to Scripts, Assets, Visual Forge, Video, or Seedance. To restore Step 1-8, select a WORKFLOW project from the project library."
    : hasProjectWithoutTask
      ? isZh
        ? "当前项目还没有绑定 Script Task。请先进入工作流完成 Finalize，或前往剧本任务页生成/导入任务。"
        : "This workflow has no Script Task yet. Finalize the workflow first, or generate/import a script task."
      : type === "project"
        ? isZh ? "当前页面需要正在进行中的 Workflow Project。可以从项目库恢复，或新建一个项目。" : "This page requires an active Workflow Project. Please restore or create a new one."
        : isZh ? "当前操作需要绑定一个 Script Task。请先完成工作流并 Finalize，或者前往剧本任务页导入或选择任务。" : "This action requires a Script Task. Please finalize a workflow or select a script.";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-black/20 backdrop-blur-md rounded-[2.5rem]">
      <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2 text-center">{title}</h2>
      <p className="text-white/50 text-sm max-w-xl text-center leading-relaxed mb-8">{description}</p>

      {hasTaskWithoutProject ? (
        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={() => navigate("/scripts")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <FileText size={16} /> {isZh ? "进入剧本任务" : "Scripts"}
          </button>
          <button onClick={() => navigate("/assets")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-all">
            <Boxes size={16} /> {isZh ? "资产" : "Assets"}
          </button>
          <button onClick={() => navigate("/visual-prompts")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-all">
            <Sparkles size={16} /> {isZh ? "视觉工坊" : "Visual Forge"}
          </button>
          <button onClick={() => navigate("/video")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-all">
            <Film size={16} /> {isZh ? "视频" : "Video"}
          </button>
          <button onClick={() => navigate("/seedance")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-all">
            <Clapperboard size={16} /> Seedance
          </button>
          <button onClick={() => navigate("/projects")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-all">
            <FolderKanban size={16} /> {isZh ? "去项目库找 WORKFLOW" : "Find Workflow"}
          </button>
        </div>
      ) : (
        <div className="flex gap-4 flex-wrap justify-center">
          <button onClick={() => navigate("/projects")} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-all">
            <FolderKanban size={16} /> {isZh ? "前往项目库" : "Projects Library"}
          </button>
          <button onClick={() => navigate("/scripts")} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <FileText size={16} /> {isZh ? "去剧本任务页选择" : "Select Script Task"}
          </button>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/10 transition-all">
            <Sparkles size={16} /> {type === "project" ? isZh ? "返回枢纽新建" : "New Workflow" : isZh ? "返回枢纽" : "Go to Hub"}
          </button>
        </div>
      )}
    </div>
  );
}
