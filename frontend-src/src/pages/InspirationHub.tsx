import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { BookOpen, CornerDownLeft, FileText, FolderKanban, Sparkles, Upload, Wand2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useTudouBridge } from '../hooks/useTudouBridge';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import FormField, { SelectInput, TextArea, TextInput, Toggle } from '../components/ui/FormField';

const DURATION_OPTIONS = ['30秒', '1分钟', '2分钟', '3分钟', '5分钟', '10分钟'];
const FORMAT_OPTIONS = [
  { value: 'short_drama', label: '短剧' },
  { value: 'micro_movie', label: '小微电影' },
  { value: 'feature_scene', label: '电影片段' },
  { value: 'series_episode', label: '连续剧单集' },
];
const ULTRASHORT_OPTIONS = [
  { value: 'vertical_short', label: '竖屏短视频' },
  { value: 'horizontal_short', label: '横屏短片' },
  { value: 'dialogue_scene', label: '对白场景' },
  { value: 'montage', label: '蒙太奇' },
];
const GENRE_OPTIONS = ['短剧', '悬念', '反转', '恐怖', '爱情', '喜剧', '犯罪', '奇幻', '科幻', '家庭'];
const MASTER_OPTIONS = [
  { value: '', label: '不使用模板' },
  { value: 'commercial_hook', label: '强商业钩子' },
  { value: 'literary', label: '文学质感' },
  { value: 'high_concept', label: '高概念类型片' },
  { value: 'social_emotion', label: '社会情绪' },
];

export default function InspirationHub() {
  const { setRealm, setScriptSeed, setCurrentProjectId, setCurrentWorkflowProjectId, setCurrentTaskId, showToast } = useAppStore();
  const { invoke, isLoading } = useTudouBridge();
  const navigate = useNavigate();

  const [localSeed, setLocalSeed] = useState('');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('2分钟');
  const [format, setFormat] = useState('short_drama');
  const [ultrashortMode, setUltrashortMode] = useState('vertical_short');
  const [genres, setGenres] = useState<string[]>(['短剧', '悬念', '反转']);
  const [chinese, setChinese] = useState(true);
  const [master, setMaster] = useState('');
  const [importedScript, setImportedScript] = useState('');
  const [importedFile, setImportedFile] = useState<any>(null);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const controls = useAnimation();

  useEffect(() => {
    setRealm('cloudcity');
    setTimeout(() => textareaRef.current?.focus(), 350);
  }, [setRealm]);

  const concept = localSeed.trim() || importedScript.slice(0, 300).trim();
  const canStart = Boolean(localSeed.trim() || importedScript.trim());

  const toggleGenre = (genre: string) => {
    setGenres((prev) => prev.includes(genre) ? prev.filter((item) => item !== genre) : [...prev, genre]);
  };

  const selectImportFile = async () => {
    setError('');
    try {
      const picked = await invoke<any>('select_text_file', {}, { timeout: 900000 });
      if (picked?.cancelled) return;
      setImportedFile(picked);
      setImportedScript(picked.content || '');
      if (!name.trim() && picked.fileName) setName(String(picked.fileName).replace(/\.[^.]+$/, '').slice(0, 30));
      showToast({ message: `已读取文件：${picked.fileName || '未命名文件'}`, type: 'success' });
    } catch (err: any) {
      setError(err.message || '选择文件失败');
    }
  };

  const handleIgnite = async () => {
    if (!canStart) return;
    setError('');
    const init = {
      name: name.trim() || concept.slice(0, 30),
      concept,
      duration,
      format,
      ultrashortMode,
      genres,
      chinese,
      master: master.trim() || undefined,
      importedScript: importedScript.trim() || undefined,
      importedFileName: importedFile?.fileName,
      path: importedScript.trim() ? 'import' : 'new',
    };

    try {
      const project = await invoke<{ projectId?: string; project_id?: string }>('project/create', init);
      const projectId = project.projectId || project.project_id || '';
      if (!projectId) throw new Error('创建工作流未返回 projectId');
      setCurrentWorkflowProjectId(projectId);
      setCurrentProjectId(projectId);
      setCurrentTaskId(null);
      setScriptSeed(concept);
      showToast({ message: '工作流项目已创建', type: 'success' });
      await controls.start({ scale: 0.98, opacity: 0, filter: 'blur(16px)', transition: { duration: 0.35, ease: 'easeInOut' } });
      navigate('/workflow');
    } catch (err: any) {
      setError(err.message || '创世引擎点火失败');
    }
  };

  return (
    <PageShell maxWidth="max-w-7xl">
      <motion.div animate={controls} className="space-y-6">
        <ModuleHeader
          icon={<Sparkles size={26} />}
          eyebrow="Inspiration Hub"
          title="新建工作流"
          actions={
            <ActionBar align="right" className="flex-wrap">
              <ActionButton variant="secondary" onClick={() => navigate('/projects')} icon={<FolderKanban size={16} />}>项目库</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/longform')} icon={<BookOpen size={16} />}>长故事</ActionButton>
              <ActionButton variant="secondary" onClick={() => navigate('/scripts')} icon={<FileText size={16} />}>剧本任务</ActionButton>
              <ActionButton onClick={handleIgnite} disabled={!canStart || isLoading} isLoading={isLoading} icon={<Wand2 size={16} />}>开始推演</ActionButton>
            </ActionBar>
          }
        />

        {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          <main className="space-y-6 min-w-0">
            <Panel title="核心概念">
              <FormField label="核心概念">
                <TextArea
                  ref={textareaRef as any}
                  value={localSeed}
                  onChange={(event: any) => setLocalSeed(event.target.value)}
                  onKeyDown={(event: any) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') handleIgnite(); }}
                  rows={3}
                  placeholder="例如：一个在赛博朋克废墟中寻找旧时代黑胶唱片的失明武士..."
                />
              </FormField>
            </Panel>

            <Panel
              title="导入剧本"
              actions={<ActionButton size="sm" variant="secondary" onClick={selectImportFile} icon={<Upload size={14} />}>选择文件</ActionButton>}
            >
               <FormField label="剧本正文">
                 <TextArea value={importedScript} onChange={(event: any) => setImportedScript(event.target.value)} rows={3} placeholder="粘贴单集内容，流程将从第 1 步破题开始。" />
                 {importedScript.length > 0 && (
                   <div className={`mt-1.5 text-xs ${importedScript.length > 15000 ? 'text-yellow-400' : 'text-white/30'}`}>
                     字数: {importedScript.length.toLocaleString()}
                     {importedScript.length > 15000 && (
                       <span className="ml-2">⚠ 文本较长（约 {importedScript.length.toLocaleString()} 字），建议分章节粘贴</span>
                     )}
                   </div>
                 )}
               </FormField>
              {importedFile && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/50">
                  {importedFile.fileName || '已选择文件'} · {importedFile.materialType || 'mixed'} · {importedFile.encoding || 'unknown'}
                </div>
              )}
            </Panel>
          </main>

          <aside className="space-y-6 min-w-0">
            <Panel title="项目参数"
              footer={
                <ActionButton onClick={handleIgnite} disabled={!canStart || isLoading} isLoading={isLoading} icon={<CornerDownLeft size={16} />}>
                  开始推演
                </ActionButton>
              }
            >
              <div className="space-y-4">
                <FormField label="项目名称"><TextInput value={name} onChange={(event: any) => setName(event.target.value)} placeholder="可选，不填自动生成" /></FormField>
                <FormField label="时长">
                  <SelectInput value={duration} onChange={(event) => setDuration(event.target.value)}>
                    {DURATION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </SelectInput>
                </FormField>
                <FormField label="格式">
                  <SelectInput value={format} onChange={(event) => setFormat(event.target.value)}>
                    {FORMAT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </SelectInput>
                </FormField>
                <FormField label="短片模式">
                  <SelectInput value={ultrashortMode} onChange={(event) => setUltrashortMode(event.target.value)}>
                    {ULTRASHORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </SelectInput>
                </FormField>
                <FormField label="题材">
                  <div className="flex flex-wrap gap-2">
                    {GENRE_OPTIONS.map((genre) => {
                      const selected = genres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${selected ? 'border-indigo-400/50 bg-indigo-500/18 text-indigo-100' : 'border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08]'}`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </FormField>
                <FormField label="大师模板">
                  <SelectInput value={master} onChange={(event) => setMaster(event.target.value)}>
                    {MASTER_OPTIONS.map((item) => <option key={item.value || 'none'} value={item.value}>{item.label}</option>)}
                  </SelectInput>
                </FormField>
                <FormField label="中文叙事">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <span className="text-sm font-semibold text-white/65">启用中文叙事</span>
                    <Toggle value={chinese} onChange={setChinese} />
                  </div>
                </FormField>
              </div>
            </Panel>
          </aside>
        </div>
      </motion.div>
    </PageShell>
  );
}
