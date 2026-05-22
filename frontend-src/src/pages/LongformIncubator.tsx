import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CornerDownRight, FileText, FolderKanban, Loader2, Route as RouteIcon, Sparkles, Wand2 } from 'lucide-react';
import { useTudouBridge } from '../hooks/useTudouBridge';
import { useAppStore } from '../store/useAppStore';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import FormField, { SelectInput, TextArea, TextInput } from '../components/ui/FormField';
import ResultViewer from '../components/ui/ResultViewer';
import EmptyState from '../components/ui/EmptyState';

type EpisodeOutline = {
  episodeIndex?: number;
  title?: string;
  logline?: string;
  openingHook?: string;
  mainConflict?: string;
  keyBeats?: string[];
  characterShift?: string;
  continuityNotes?: string;
  endingHook?: string;
  sourceForWorkflow?: string;
};

type LongformPlan = {
  seriesTitle?: string;
  format?: string;
  corePremise?: string;
  logline?: string;
  genrePromise?: string[];
  storyBible?: Record<string, any>;
  seasonOutline?: Record<string, any>;
  episodeOutlines?: EpisodeOutline[];
  quality?: Record<string, any>;
};

type IncubationResult = {
  seriesProjectId?: string;
  projectId?: string;
  ideaMaterialId?: string;
  storyBibleMaterialId?: string;
  plannedEpisodeIds?: string[];
  plan?: LongformPlan;
  storyBibleMarkdown?: string;
};

const FORMAT_OPTIONS = [
  { value: 'short_drama', label: '短剧' },
  { value: 'web_series', label: '网剧' },
  { value: 'feature_film', label: '电影长片' },
  { value: 'novel', label: '小说' },
  { value: 'anthology', label: '单元剧' },
];

const EPISODE_OPTIONS = [8, 12, 16, 24, 30, 60, 100];

function asTextList(value: any) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map((item) => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n');
  if (typeof value === 'object') return Object.entries(value).map(([key, val]) => `- ${key}: ${typeof val === 'string' ? val : JSON.stringify(val)}`).join('\n');
  return String(value);
}

function buildEpisodePacket(plan: LongformPlan, episode: EpisodeOutline, duration: string) {
  const bible = plan.storyBible || {};
  const beats = Array.isArray(episode.keyBeats) ? episode.keyBeats.map((item) => `- ${item}`).join('\n') : '';
  const source = episode.sourceForWorkflow?.trim();
  if (source) {
    return [
      `# ${plan.seriesTitle || '长故事'} · ${episode.title || `第 ${episode.episodeIndex || 1} 集`}`,
      '',
      `目标时长：${duration}`,
      '',
      source,
    ].join('\n');
  }
  return [
    `# ${plan.seriesTitle || '长故事'} · ${episode.title || `第 ${episode.episodeIndex || 1} 集`}`,
    '',
    `目标时长：${duration}`,
    '',
    '## 全局故事圣经',
    `主题：${bible.theme || ''}`,
    `世界观：${bible.world || ''}`,
    `核心冲突：${bible.coreConflict || ''}`,
    `长线主线：${bible.longArc || ''}`,
    '',
    '## 本集目标',
    episode.logline || '',
    '',
    '## 开场钩子',
    episode.openingHook || '',
    '',
    '## 本集主冲突',
    episode.mainConflict || '',
    '',
    '## 关键节拍',
    beats,
    '',
    '## 人物变化',
    episode.characterShift || '',
    '',
    '## 承接与伏笔',
    episode.continuityNotes || '',
    '',
    '## 结尾钩子',
    episode.endingHook || '',
  ].join('\n');
}

export default function LongformIncubator() {
  const { invoke, isLoading } = useTudouBridge();
  const navigate = useNavigate();
  const setRealm = useAppStore((s) => s.setRealm);
  const setScriptSeed = useAppStore((s) => s.setScriptSeed);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const setCurrentWorkflowProjectId = useAppStore((s) => s.setCurrentWorkflowProjectId);
  const setCurrentTaskId = useAppStore((s) => s.setCurrentTaskId);
  const showToast = useAppStore((s) => s.showToast);

  const [idea, setIdea] = useState('');
  const [name, setName] = useState('');
  const [format, setFormat] = useState('short_drama');
  const [episodeCount, setEpisodeCount] = useState(12);
  const [episodeDuration, setEpisodeDuration] = useState('2分钟');
  const [genres, setGenres] = useState('短剧、悬念、反转');
  const [audience, setAudience] = useState('短视频观众');
  const [tone, setTone] = useState('强冲突、强钩子、强情绪、每集结尾有反转');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<IncubationResult | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [busy, setBusy] = useState<'incubate' | 'workflow' | ''>('');
  const [error, setError] = useState('');

  const plan = result?.plan || {};
  const episodes = useMemo(() => Array.isArray(plan.episodeOutlines) ? plan.episodeOutlines : [], [plan.episodeOutlines]);
  const activeEpisode = episodes[selectedEpisode] || episodes[0] || null;
  const activePacket = activeEpisode ? buildEpisodePacket(plan, activeEpisode, episodeDuration) : '';

  useEffect(() => {
    setRealm('cloudcity');
  }, [setRealm]);

  const incubate = async () => {
    if (!idea.trim()) {
      setError('请先输入故事想法。');
      return;
    }
    setBusy('incubate');
    setError('');
    try {
      const next = await invoke<IncubationResult>('series/incubate-idea', {
        idea,
        name: name.trim() || undefined,
        format,
        episodeCount,
        episodeDuration,
        genres,
        audience,
        tone,
        notes,
      }, { timeout: 900000 });
      setResult(next);
      setSelectedEpisode(0);
      showToast({ message: '长故事方案已生成', type: 'success' });
    } catch (err: any) {
      setError(err?.message || '长故事孵化失败');
    } finally {
      setBusy('');
    }
  };

  const createWorkflowFromEpisode = async (episode: EpisodeOutline) => {
    const packet = buildEpisodePacket(plan, episode, episodeDuration);
    if (!packet.trim()) return;
    setBusy('workflow');
    setError('');
    try {
      const episodeTitle = episode.title || `第 ${episode.episodeIndex || selectedEpisode + 1} 集`;
      const workflow = await invoke<any>('project/create', {
        name: `${plan.seriesTitle || name || '长故事'} · ${episodeTitle}`,
        concept: episode.logline || plan.logline || idea,
        duration: episodeDuration,
        format: 'series_episode',
        ultrashortMode: 'vertical_short',
        genres: genres.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean),
        chinese: true,
        master: 'longform_episode',
        path: 'import',
        importedScript: packet,
        importedFileName: `${plan.seriesTitle || 'longform'}_${episode.episodeIndex || selectedEpisode + 1}.md`,
      }, { timeout: 120000 });
      const projectId = workflow.projectId || workflow.project_id || '';
      if (!projectId) throw new Error('创建八步工作流未返回 projectId');
      setCurrentWorkflowProjectId(projectId);
      setCurrentProjectId(projectId);
      setCurrentTaskId(null);
      setScriptSeed(packet);
      showToast({ message: '已创建本集八步工作流', type: 'success' });
      navigate('/workflow');
    } catch (err: any) {
      setError(err?.message || '创建八步工作流失败');
    } finally {
      setBusy('');
    }
  };

  return (
    <PageShell maxWidth="max-w-full">
      <ModuleHeader
        icon={<BookOpen size={24} />}
        eyebrow="Longform Incubator"
        title="长故事孵化器"
        actions={
          <ActionBar align="right" className="flex-wrap">
            <ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton>
            <ActionButton variant="secondary" onClick={() => navigate('/workflow')} icon={<RouteIcon size={16} />}>工作流</ActionButton>
            <ActionButton onClick={incubate} disabled={!idea.trim() || busy === 'incubate' || isLoading} isLoading={busy === 'incubate'} icon={<Wand2 size={16} />}>生成长故事</ActionButton>
          </ActionBar>
        }
      />

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 min-h-0">
        <aside className="space-y-6 min-w-0">
          <Panel title="创意输入" subtitle="Idea">
            <div className="space-y-4">
              <FormField label="故事想法">
                <TextArea rows={6} value={idea} onChange={(event: any) => setIdea(event.target.value)} placeholder="例如：一个假发店老板娘靠给顾客换发型，帮她们改变人生。" />
              </FormField>
              <FormField label="项目名">
                <TextInput value={name} onChange={(event: any) => setName(event.target.value)} placeholder="可选" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="形态">
                  <SelectInput value={format} onChange={(event) => setFormat(event.target.value)}>
                    {FORMAT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </SelectInput>
                </FormField>
                <FormField label="数量">
                  <SelectInput value={episodeCount} onChange={(event) => setEpisodeCount(Number(event.target.value))}>
                    {EPISODE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </SelectInput>
                </FormField>
              </div>
              <FormField label="单集/单章长度">
                <TextInput value={episodeDuration} onChange={(event: any) => setEpisodeDuration(event.target.value)} />
              </FormField>
              <FormField label="题材">
                <TextInput value={genres} onChange={(event: any) => setGenres(event.target.value)} />
              </FormField>
              <FormField label="受众">
                <TextInput value={audience} onChange={(event: any) => setAudience(event.target.value)} />
              </FormField>
              <FormField label="风格">
                <TextInput value={tone} onChange={(event: any) => setTone(event.target.value)} />
              </FormField>
              <FormField label="补充约束">
                <TextArea rows={3} value={notes} onChange={(event: any) => setNotes(event.target.value)} placeholder="可写平台、禁忌、时代、人物偏好、结局方向等。" />
              </FormField>
            </div>
          </Panel>
        </aside>

        <main className="space-y-6 min-w-0">
          {!result ? (
            <Panel>
              <EmptyState
                title="等待长故事方案"
                description="输入想法后生成故事圣经、长线结构和分集单元。"
                icon={busy === 'incubate' ? <Loader2 size={32} className="animate-spin" /> : <Sparkles size={32} />}
              />
            </Panel>
          ) : (
            <>
              <Panel
                title={plan.seriesTitle || '长故事方案'}
                subtitle={plan.logline || plan.corePremise || 'Story Bible'}
                actions={<ActionButton size="sm" variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={14} />}>剧本任务</ActionButton>}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-2">Core Premise</div>
                    <div className="text-sm text-white/70 leading-relaxed">{plan.corePremise}</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-2">Genre Promise</div>
                    <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{asTextList(plan.genrePromise)}</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-2">Series Project</div>
                    <div className="text-xs text-white/45 font-mono break-all">{result.seriesProjectId || result.projectId}</div>
                  </div>
                </div>
              </Panel>

              <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                <Panel title="分集 / 分章" subtitle={`${episodes.length} 个单元`} noPadding>
                  <div className="max-h-[640px] overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {episodes.map((episode, index) => (
                      <button
                        key={`${episode.episodeIndex || index}-${episode.title || index}`}
                        onClick={() => setSelectedEpisode(index)}
                        className={`w-full text-left rounded-xl border p-3 transition-all ${selectedEpisode === index ? 'bg-indigo-500/18 border-indigo-500/40' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'}`}
                      >
                        <div className="text-sm font-bold text-[var(--text-primary)] line-clamp-1">{episode.episodeIndex || index + 1}. {episode.title || '未命名单元'}</div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)] line-clamp-2">{episode.logline || episode.mainConflict}</div>
                      </button>
                    ))}
                  </div>
                </Panel>

                <div className="space-y-6 min-w-0">
                  {activeEpisode && (
                    <Panel
                      title={`${activeEpisode.episodeIndex || selectedEpisode + 1}. ${activeEpisode.title || '未命名单元'}`}
                      subtitle={activeEpisode.logline || 'Episode Outline'}
                      actions={
                        <ActionButton
                          onClick={() => createWorkflowFromEpisode(activeEpisode)}
                          disabled={busy === 'workflow'}
                          isLoading={busy === 'workflow'}
                          icon={<CornerDownRight size={16} />}
                        >
                          进入八步工作流
                        </ActionButton>
                      }
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-2">Opening</div>
                          <div className="text-sm text-white/70 leading-relaxed">{activeEpisode.openingHook}</div>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35 mb-2">Ending</div>
                          <div className="text-sm text-white/70 leading-relaxed">{activeEpisode.endingHook}</div>
                        </div>
                      </div>
                      <ResultViewer title="WORKFLOW SOURCE PACKET" content={activePacket} maxHeight="max-h-[420px]" />
                    </Panel>
                  )}

                  <ResultViewer title="STORY BIBLE" content={result.storyBibleMarkdown || JSON.stringify(plan, null, 2)} maxHeight="max-h-[520px]" />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </PageShell>
  );
}
