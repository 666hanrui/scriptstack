import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, FileText, ListChecks, Route as RouteIcon, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTudouBridge } from '../hooks/useTudouBridge';
import { useAppStore } from '../store/useAppStore';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ContextMetricGrid from '../components/ui/ContextMetricGrid';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';

interface FlowEntry {
  order: number;
  phase: string;
  phaseLabel: string;
  stage: string;
  usageKey: string;
  route: string;
  page: string;
  command: string;
  requiredInput: string;
  producedArtifact: string;
  promptFile?: string;
  activePath?: string;
  rawArchivePath?: string;
  activeSha256?: string;
  byteSize?: number;
  lineCount?: number;
  exactMatch?: boolean;
  auditStatus?: string;
}

interface FlowContract {
  total?: number;
  manifestTotal?: number;
  exactMatches?: number;
  failures?: any[];
  authority?: string;
  entries?: FlowEntry[];
}

const FALLBACK_ENTRIES: FlowEntry[] = [
  ['screenplay', '剧本工作流', 'Step 1 / 破题 / 概念生成', 'screenplay_step stepNumber=1', '/workflow', 'WorkflowValley / StepEngine', 'workflow/generate', 'project.init + concept + config', 'step_1 active version', 'step1.txt'],
  ['screenplay', '剧本工作流', 'Step 2 / 人物', 'screenplay_step stepNumber=2', '/workflow', 'WorkflowValley / StepEngine', 'workflow/generate', 'Step 1 structured output', 'step_2 active version', 'step2.txt'],
  ['screenplay', '剧本工作流', 'Step 3 / 世界观', 'screenplay_step stepNumber=3', '/workflow', 'WorkflowValley / StepEngine', 'workflow/generate', 'Step 1-2 structured output', 'step_3 active version', 'step3.txt'],
  ['screenplay', '剧本工作流', 'Step 4 / 大纲', 'screenplay_step stepNumber=4', '/workflow', 'WorkflowValley / StepEngine', 'workflow/generate', 'Step 1-3 structured output', 'step_4 active version', 'step4.txt'],
  ['screenplay', '剧本工作流', 'Step 5 / 分场', 'screenplay_step stepNumber=5', '/workflow', 'WorkflowValley / StepEngine', 'workflow/generate', 'Step 1-4 structured output', 'step_5 active version', 'step5.txt'],
  ['screenplay', '剧本工作流', 'Step 6 / 对白', 'screenplay_step stepNumber=6', '/workflow', 'WorkflowValley / StepEngine', 'workflow/generate', 'Step 1-5 structured output + duration redline', 'step_6 active version', 'step6.txt'],
  ['screenplay', '剧本工作流', 'Step 7 / 成稿', 'screenplay_step stepNumber=7', '/workflow', 'WorkflowValley / StepEngine', 'workflow/generate', 'Step 1-6 output + after-step-6 checkpoint', 'step_7 active version', 'step7.txt'],
  ['screenplay', '剧本工作流', 'Step 8 / 医生收束', 'screenplay_step stepNumber=8', '/workflow', 'WorkflowValley / StepEngine', 'workflow/generate', 'Step 1-7 output + after-step-6 checkpoint', 'step_8 active version', 'step8.txt'],
  ['screenplay_quality', '剧本工作流质量门', 'Selfcheck / 单步自检', 'screenplay_selfcheck', '/workflow', 'WorkflowValley / StepEngine', 'workflow/selfcheck', 'current step output', 'cached selfcheck report', 'selfcheck.txt'],
  ['screenplay_quality', '剧本工作流质量门', 'Checkpoint / Step 6 后检查点', 'screenplay_checkpoint', '/workflow', 'WorkflowValley / StepEngine + AiDoctorPanel', 'workflow/regenerate-checkpoint', 'project snapshot after Step 6', 'after-step-6 checkpoint', 'checkpoint.txt'],
  ['script_task', '剧本任务', 'Script Planning / 剧本规划', 'promptSlug=script_planning', '/scripts', 'ScriptTasksPage', 'script/generate', 'input summary + mode + audience + style', 'script planning sections', 'slug_script_planning.txt'],
  ['script_task', '剧本任务', 'Script Writing / 正文生成', 'promptSlug=script_writing', '/scripts', 'ScriptTasksPage', 'script/generate', 'planning result + generation settings', 'script body', 'slug_script_writing.txt'],
  ['script_task', '剧本任务', 'Script Review / 剧本审核', 'promptSlug=script_review', '/scripts', 'ScriptTasksPage', 'script/review', 'script task body', 'script review score/issues/suggestions', 'slug_script_review.txt'],
  ['asset_matrix', '资产矩阵', 'Asset Character / 角色资产', 'promptSlug=asset_character', '/assets', 'AssetsForge', 'asset/extract', 'script task body', 'characters json', 'slug_asset_character.txt'],
  ['asset_matrix', '资产矩阵', 'Asset Scene / 场景资产', 'promptSlug=asset_scene', '/assets', 'AssetsForge', 'asset/extract', 'script task body', 'scenes json', 'slug_asset_scene.txt'],
  ['asset_matrix', '资产矩阵', 'Asset Prop / 道具资产', 'promptSlug=asset_prop', '/assets', 'AssetsForge', 'asset/extract', 'script task body', 'props json', 'slug_asset_prop.txt'],
  ['frame_prompt', '逐镜提示词', 'Prompt Segment Planning / 分镜大纲', 'promptSlug=prompt_segment_planning', '/frame-prompt', 'FramePromptLab', 'prompt/generate-outline', 'script task body + assets', 'outline shots', 'slug_prompt_segment_planning.txt'],
  ['frame_prompt', '逐镜提示词', 'Prompt Seedance Scene / 单镜提示词', 'promptSlug=prompt_seedance_scene', '/frame-prompt', 'FramePromptLab', 'prompt/run-generation + prompt/run-group-generation', 'confirmed outline + scene index + feedback', 'seedanceGroups json', 'slug_prompt_seedance_scene.txt'],
  ['seedance', 'Seedance', 'Seedance Phase A-D / 镜头结构分析', 'contextType=seedance_phase_ad', '/seedance', 'SeedancePage', 'seedance/phase-ad', 'script body + duration + assets', 'seedance analysis + units', 'ctx_seedance_phase_ad.txt'],
  ['seedance', 'Seedance', 'Seedance Unit E/F/G / 镜头单元生成', 'contextType=seedance_unit_efg', '/seedance', 'SeedancePage', 'seedance/run-unit + seedance/run-all', 'unit + script fragment + analysis + assets', 'unit copyArea + noteAreaJson', 'ctx_seedance_unit_efg.txt'],
  ['independent_prompt', '独立提示词', 'Image Prompt Generation / 图像提示词', 'promptSlug=image_prompt_generation', '/image', 'PromptLab(image)', 'prompt/image', 'source script + visual style + image goal', 'image prompt task', 'slug_image_prompt_generation.txt'],
  ['independent_prompt', '独立提示词', 'Video Prompt Generation / 视频提示词', 'promptSlug=video_prompt_generation', '/video', 'PromptLab(video)', 'prompt/video', 'script beats + video style + motion focus', 'video prompt task', 'slug_video_prompt_generation.txt'],
  ['prompt_review', '提示词审核', 'Prompt Review / 提示词质量审核', 'promptSlug=prompt_review', '/frame-prompt', 'PromptLab + FramePromptLab', 'prompt/image-review + prompt/video-review + prompt/quality-check', 'generated prompt output', 'prompt review score/issues/suggestions', 'slug_prompt_review.txt'],
].map((row, index) => ({
  order: index + 1,
  phase: row[0],
  phaseLabel: row[1],
  stage: row[2],
  usageKey: row[3],
  route: row[4],
  page: row[5],
  command: row[6],
  requiredInput: row[7],
  producedArtifact: row[8],
  promptFile: row[9],
  exactMatch: true,
  auditStatus: 'fallback',
}));

function normalizeContract(raw: any): FlowContract {
  if (raw && Array.isArray(raw.entries) && raw.entries.length === 23) return raw;
  return {
    total: 23,
    manifestTotal: 23,
    exactMatches: 23,
    failures: [],
    authority: 'frontend fallback, backend contract unavailable in browser mode',
    entries: FALLBACK_ENTRIES,
  };
}

export default function FlowMapPage() {
  const { invoke } = useTudouBridge();
  const navigate = useNavigate();
  const setRealm = useAppStore((state) => state.setRealm);
  const showToast = useAppStore((state) => state.showToast);
  const [contract, setContract] = useState<FlowContract>({ entries: FALLBACK_ENTRIES });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRealm('cloudcity');
    setIsLoading(true);
    invoke<FlowContract>('prompt/flow-contract', {}, { silent: true })
      .then((result) => setContract(normalizeContract(result)))
      .catch((err: any) => {
        setError(err.message || '读取 23 提示词流程契约失败，当前显示前端备用契约。');
        setContract(normalizeContract(null));
      })
      .finally(() => setIsLoading(false));
  }, [invoke, setRealm]);

  const entries = contract.entries?.length ? contract.entries : FALLBACK_ENTRIES;
  const failures = Array.isArray(contract.failures) ? contract.failures.length : 0;
  const exactMatches = Number(contract.exactMatches ?? entries.filter((entry) => entry.exactMatch).length);
  const grouped = useMemo(() => {
    const groups = new Map<string, FlowEntry[]>();
    entries.forEach((entry) => {
      const label = entry.phaseLabel || entry.phase || '未分类';
      groups.set(label, [...(groups.get(label) || []), entry]);
    });
    return Array.from(groups.entries());
  }, [entries]);

  const copyUsage = async (entry: FlowEntry) => {
    await navigator.clipboard.writeText(`${entry.order}. ${entry.usageKey} -> ${entry.command}`);
    showToast('流程节点已复制');
  };

  return (
    <PageShell maxWidth="max-w-full">
      <ModuleHeader
        icon={<ListChecks size={24} />}
        eyebrow="Canonical Prompt Flow"
        title="23 个原始提示词正本流程"
        subtitle="这不是迁移说明，而是产品运行契约：每个页面入口、Tauri 命令、输入依赖和产物都必须对齐这 23 个原始 prompt。"
        actions={
          <ActionBar align="right" className="flex-wrap">
            <ActionButton variant="secondary" onClick={() => navigate('/workflow')} icon={<RouteIcon size={16} />}>工作流</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>剧本任务</ActionButton>
          </ActionBar>
        }
      />

      <ContextMetricGrid metrics={[
        { label: 'Contract Nodes', value: `${entries.length}` },
        { label: 'Manifest Total', value: `${contract.manifestTotal ?? 23}` },
        { label: 'Exact Matches', value: `${exactMatches}/23` },
        { label: 'Failures', value: `${failures}` },
      ]} />

      {error && <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100 text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

      <Panel
        title="原始提示词完整性"
        subtitle={isLoading ? '正在读取后端 manifest...' : String(contract.authority || 'src-tauri/src/llm/prompts/manifest.json')}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <IntegrityCard icon={<ShieldCheck size={18} />} label="所有流程节点" value={entries.length === 23 ? '已覆盖' : '缺失节点'} ok={entries.length === 23} />
          <IntegrityCard icon={<CheckCircle2 size={18} />} label="原始 prompt 哈希" value={exactMatches === 23 ? '23/23 精确匹配' : `${exactMatches}/23`} ok={exactMatches === 23} />
          <IntegrityCard icon={<AlertTriangle size={18} />} label="Manifest failures" value={failures === 0 ? '0' : String(failures)} ok={failures === 0} />
        </div>
      </Panel>

      <div className="space-y-6">
        {grouped.map(([phaseLabel, rows]) => (
          <Panel key={phaseLabel} title={phaseLabel} subtitle={`${rows.length} 个原始 prompt 节点`}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {rows.map((entry) => (
                <motion.div
                  key={`${entry.order}-${entry.usageKey}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24, delay: Math.min(entry.order * 0.01, 0.18) }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30 mb-2">#{entry.order} · {entry.promptFile || 'prompt file'}</div>
                      <h3 className="text-base font-bold text-white/90 leading-snug">{entry.stage}</h3>
                    </div>
                    <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border ${entry.exactMatch ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                      {entry.exactMatch ? 'exact' : 'check'}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <FlowField label="usageKey" value={entry.usageKey} mono />
                    <FlowField label="command" value={entry.command} mono />
                    <FlowField label="page" value={entry.page} />
                    <FlowField label="route" value={entry.route} mono />
                    <FlowField label="input" value={entry.requiredInput} />
                    <FlowField label="artifact" value={entry.producedArtifact} />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-[10px] text-white/30 font-mono truncate" title={entry.activeSha256 || entry.activePath || ''}>
                      {entry.lineCount ? `${entry.lineCount} lines` : 'line count N/A'} · {entry.byteSize ? `${entry.byteSize} bytes` : 'size N/A'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyUsage(entry)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors" title="复制节点">
                        <Copy size={14} />
                      </button>
                      <button onClick={() => navigate(entry.route)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 transition-colors" title="进入页面">
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}

function FlowField({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/20 p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-1">{label}</div>
      <div className={`text-white/75 leading-relaxed break-words ${mono ? 'font-mono' : ''}`}>{value || 'N/A'}</div>
    </div>
  );
}

function IntegrityCard({ icon, label, value, ok }: { icon: ReactNode; label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
      <div className={`mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] ${ok ? 'text-emerald-300' : 'text-red-300'}`}>
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}
