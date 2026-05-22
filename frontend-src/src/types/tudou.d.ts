export type RealmType = "cloudcity" | "valley" | "samurai";
export type PageId = "hub" | "longform" | "workflow" | "scripts" | "assets" | "visual-prompts" | "image" | "video" | "frame-prompt" | "seedance" | "flow" | "projects" | "admin" | "settings";

export interface UserProfile {
  username: string;
  token: string;
  avatarUrl?: string;
  role?: string;
  isAdmin?: boolean;
}

export interface AppSettings {
  textEndpoint: string;
  textKey: string;
  textModel: string;
  textMode: "openai" | "gemini" | "anthropic" | string;
  imageEndpoint: string;
  imageKey: string;
  imageModel: string;
  reviewThreshold: number;
  enableLocalSave: boolean;
}

export interface ScriptOutputRecord {
  id?: string;
  taskId?: string;
  task_id?: string;
  charactersJson?: string;
  characters_json?: string;
  plotOutline?: string;
  plot_outline?: string;
  scriptBody?: string;
  script_body?: string;
  hookOpening?: string;
  hook_opening?: string;
  storyboardBase?: string;
  storyboard_base?: string;
  rawResponse?: string;
  raw_response?: string;
  createdAt?: string;
  created_at?: string;
}

export interface ScriptTask {
  taskId?: string;
  task_id?: string;
  projectId?: string;
  project_id?: string;
  projectName?: string;
  project_name?: string;
  inputSummary?: string;
  input_summary?: string;
  name?: string;
  mode?: string;
  genre?: string;
  style?: string;
  duration?: string;
  stage?: string;
  status?: string;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
  generatedAt?: string;
  generated_at?: string;
  reviewScore?: number | null;
  review_score?: number | null;
  reviewStatus?: string | null;
  review_status?: string | null;
  scriptBody?: string;
  script_body?: string;
  plotOutline?: string;
  plot_outline?: string;
  body?: string;
  text?: string;
  output?: string;
  moduleType?: string;
  module_type?: string;
  outputs?: ScriptOutputRecord[];
  sections?: Array<{ title?: string; content?: string }>;
  characters?: any[];
  task?: ScriptTask;
  review?: ReviewResult | null;
  assets?: any[];
  promptOutput?: any;
}

export interface ProjectRecord {
  projectId?: string;
  project_id?: string;
  id?: string;
  name?: string;
  init?: Record<string, any>;
  currentStep?: number;
  current_step?: number;
  doneSteps?: number[];
  done_steps?: number[];
  steps?: Record<string, { versions?: StepVersion[] }>;
  linkedScriptTaskId?: string;
  linked_script_task_id?: string;
}

export interface StepVersion {
  id: string;
  output?: string;
  text?: string;
  structured?: any;
  isActive?: boolean;
  is_active?: boolean;
  createdAt?: string;
  created_at?: string;
}

export interface PromptResult {
  projectId?: string;
  project_id?: string;
  taskId?: string;
  task_id?: string;
  projectName?: string;
  project_name?: string;
  generatedAt?: string;
  generated_at?: string;
  sections?: Array<{ title?: string; name?: string; heading?: string; lines?: string[]; content?: string; prompt?: string; text?: string }>;
  groups?: any[];
  text?: string;
  prompt?: string;
  raw?: string;
}

export interface ReviewResult {
  score?: number;
  status?: string;
  summary?: string;
  issues?: string[];
  suggestions?: string[];
  dimensions?: any[];
  issuesJson?: string;
  issues_json?: string;
  suggestionsJson?: string;
  suggestions_json?: string;
  dimensionsJson?: string;
  dimensions_json?: string;
}

export interface AssetBundle {
  characters: any[];
  scenes: any[];
  props: any[];
}

export interface TudouBridge {
  invoke(command: string, args?: Record<string, any>): Promise<any>;
  getAppVersion(): Promise<string>;
  setAuthToken(token: string, refreshToken?: string): Promise<void>;
  getAppSettings(): Promise<AppSettings>;
  saveAppSettings(payload: AppSettings): Promise<AppSettings>;
  getDatabaseMeta(): Promise<{ dbPath: string; dataDir: string }>;
  testConnection(payload: Record<string, any>): Promise<any>;
  getRecentScriptTasks(): Promise<ScriptTask[]>;
  getRecentImagePromptTasks(): Promise<any[]>;
  getRecentVideoPromptTasks(): Promise<any[]>;
  loadScriptTask(taskId: string): Promise<ScriptTask>;
  deleteScriptTask(taskId: string): Promise<any>;
  deleteImageTask(taskId: string): Promise<any>;
  deleteVideoTask(taskId: string): Promise<any>;
  saveScriptDraft(payload: Record<string, any>): Promise<any>;
  saveImagePromptDraft(payload: Record<string, any>): Promise<any>;
  saveVideoPromptDraft(payload: Record<string, any>): Promise<any>;
  runScriptGeneration(payload: Record<string, any>): Promise<any>;
  updateScriptBody(taskId: string, newBody: string): Promise<any>;
  importExistingScript(payload: Record<string, any>): Promise<any>;
  runScriptReview(payload: Record<string, any>): Promise<ReviewResult>;
  runImagePromptGeneration(payload: Record<string, any>): Promise<PromptResult>;
  runVideoPromptGeneration(payload: Record<string, any>): Promise<PromptResult>;
  runImagePromptReview(payload: Record<string, any>): Promise<ReviewResult>;
  runVideoPromptReview(payload: Record<string, any>): Promise<ReviewResult>;
  extractAssets(payload: Record<string, any>): Promise<any>;
  getAssetsByTask(taskId: string): Promise<any[]>;
  updateAssets(taskId: string, characters: any[], scenes: any[], props: any[]): Promise<any>;
  getProjects(): Promise<any[]>;
  renameProject(projectId: string, newName: string): Promise<any>;
  deleteProject(projectId: string, newName?: string): Promise<any>;
  screenplay: {
    skillStatus(): Promise<any>;
    createProject(init: Record<string, any>): Promise<ProjectRecord>;
    getProject(projectId: string): Promise<ProjectRecord | null>;
    listRecentProjects(limit?: number): Promise<any[]>;
    deleteProject(projectId: string): Promise<any>;
    renameProject(payload: Record<string, any>): Promise<any>;
    updateStepStructured(payload: Record<string, any>): Promise<any>;
    finalizeToScriptTask(payload: Record<string, any>): Promise<any>;
    generateStep(payload: Record<string, any>): Promise<any>;
    selfcheckStep(payload: Record<string, any>): Promise<any>;
    getCachedSelfcheck(payload: Record<string, any>): Promise<any>;
    approveStep(payload: Record<string, any>): Promise<any>;
    listVersions(payload: Record<string, any>): Promise<any[]>;
    setStepSelection(payload: Record<string, any>): Promise<any>;
    onStreamChunk(callback: (payload: any) => void): Promise<() => void>;
  };
  seedance: {
    runPhaseAD(payload: Record<string, any>): Promise<any>;
    getAnalysis(payload: Record<string, any>): Promise<any>;
    listUnits(payload: Record<string, any>): Promise<any[]>;
    getUnit(payload: Record<string, any>): Promise<any>;
    runUnit(payload: Record<string, any>): Promise<any>;
    runAll(payload: Record<string, any>): Promise<any>;
    onProgress(callback: (payload: any) => void): Promise<() => void>;
    onAnalysisChunk(callback: (payload: any) => void): Promise<() => void>;
    onUnitChunk(callback: (payload: any) => void): Promise<() => void>;
  };
  on(eventName: string, callback: (payload: any) => void): Promise<() => void>;
  onSessionExpired?(callback: () => void): () => void;
}

declare global {
  interface Window {
    tudouApp?: TudouBridge;
    __TAURI_INTERNALS__?: unknown;
  }
}

export {};
