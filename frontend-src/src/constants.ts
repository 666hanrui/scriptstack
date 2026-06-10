import type { PageId, RealmType } from "./types/tudou";

export interface WorkflowStep {
  id: number;
  title: string;
  desc: string;
  slug: string;
}

export interface NavItem {
  id: PageId;
  label: string;
  eyebrow: string;
  realm: RealmType;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 1, title: "故事定位", desc: "明确卖点、核心冲突和类型承诺", slug: "concept" },
  { id: 2, title: "人物关系", desc: "主角欲望、对手压力和人物张力", slug: "characters" },
  { id: 3, title: "世界规则", desc: "故事场域、规则代价和视觉母题", slug: "world" },
  { id: 4, title: "剧情大纲", desc: "主线推进、关键转折和结尾钩子", slug: "outline" },
  { id: 5, title: "场景拆解", desc: "把大纲拆成可拍摄的场景节拍", slug: "scenes" },
  { id: 6, title: "对白节奏", desc: "角色声音、潜台词和信息密度", slug: "dialogue" },
  { id: 7, title: "完整剧本", desc: "生成完整剧本文本并统一格式", slug: "script" },
  { id: 8, title: "剧本体检", desc: "扫描结构漏洞并给出修改建议", slug: "doctor" },
];

export const NAV_ITEMS: NavItem[] = [
  { id: "hub", label: "灵感枢纽", eyebrow: "Genesis", realm: "cloudcity" },
  { id: "longform", label: "长故事", eyebrow: "Longform", realm: "cloudcity" },
  { id: "workflow", label: "剧本生成向导", eyebrow: "Screenplay", realm: "valley" },
  { id: "scripts", label: "剧本任务", eyebrow: "Script Tasks", realm: "valley" },
  { id: "assets", label: "资产锻造", eyebrow: "Assets", realm: "samurai" },
  { id: "visual-prompts", label: "视觉提示词", eyebrow: "Visual Forge", realm: "samurai" },
  { id: "video", label: "视频提示词", eyebrow: "Video Prompt", realm: "valley" },
  { id: "frame-prompt", label: "逐镜提示词", eyebrow: "Frame Prompt", realm: "valley" },
  { id: "seedance", label: "Seedance", eyebrow: "Shot Units", realm: "valley" },
  { id: "projects", label: "项目库", eyebrow: "Archive", realm: "cloudcity" },
  { id: "admin", label: "管理员后台", eyebrow: "Admin", realm: "cloudcity" },
  { id: "settings", label: "模型与 API", eyebrow: "Server Core", realm: "cloudcity" },
];

export const IPC_TIMEOUTS = {
  NORMAL: 30_000,
  LONG: 120_000,
  EXTREME: 900_000,
} as const;

export const UI_DEFAULTS = {
  TOAST_DURATION: 2_200,
  ANIMATION_MS: 350,
} as const;

export const NAV_ROUTES = [
  { path: '/', label: '灵感枢纽', icon: 'Sparkles' },
  { path: '/longform', label: '长故事', icon: 'BookOpen' },
  { path: '/workflow', label: '剧本生成', icon: 'RouteIcon' },
  { path: '/scripts', label: '剧本任务', icon: 'FileText' },
  { path: '/assets', label: '资产矩阵', icon: 'Library' },
  { path: '/video', label: '视频提示词', icon: 'Film' },
  { path: '/frame-prompt', label: '逐帧', icon: 'LayoutPanelTop' },
  { path: '/seedance', label: 'Seedance', icon: 'Clapperboard' },
  { path: '/visual-prompts', label: '视觉提示词', icon: 'Sparkles' },
  { path: '/projects', label: '项目库', icon: 'FolderKanban' },
] as const;
