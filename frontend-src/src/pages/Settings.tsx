import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Cpu, Database, HardDrive, Image as ImageIcon, Key, Link, Save, ShieldAlert, Sparkles, TestTube2 } from 'lucide-react';
import { useTudouBridge } from '../hooks/useTudouBridge';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import Collapsible from '../components/ui/Collapsible';
import FormField, { SelectInput, TextInput, Toggle } from '../components/ui/FormField';
import { useAppStore } from '../store/useAppStore';
import ResultViewer from '../components/ui/ResultViewer';

type TextMode = 'openai' | 'anthropic' | 'gemini';
type SettingsConfig = {
  textEndpoint: string;
  textKey: string;
  textModel: string;
  textMode: TextMode | string;
  imageEndpoint: string;
  imageKey: string;
  imageModel: string;
  reviewThreshold: number;
  enableLocalSave: boolean;
};

type TextProviderPreset = {
  id: string;
  label: string;
  badge: string;
  endpoint: string;
  mode: TextMode;
  models: string[];
  imageModels?: string[];
  custom?: boolean;
};

type ImageProviderPreset = {
  id: string;
  label: string;
  badge: string;
  endpoint: string;
  models: string[];
  custom?: boolean;
};

const TEXT_PROVIDERS: TextProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    badge: 'OpenAI 兼容',
    endpoint: 'https://api.deepseek.com/v1',
    mode: 'openai',
    models: ['deepseek-reasoner', 'deepseek-chat'],
  },
  {
    id: 'openai',
    label: 'OpenAI / ChatGPT',
    badge: '文本 + 图像',
    endpoint: 'https://api.openai.com/v1',
    mode: 'openai',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    imageModels: ['gpt-image-1', 'dall-e-3'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic / Claude',
    badge: 'Claude Messages',
    endpoint: 'https://api.anthropic.com/v1',
    mode: 'anthropic',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    badge: '多模态理解',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    mode: 'gemini',
    models: ['gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    badge: 'OpenAI 兼容',
    endpoint: 'https://openrouter.ai/api/v1',
    mode: 'openai',
    models: ['openai/gpt-4.1', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-pro', 'deepseek/deepseek-r1'],
  },
  {
    id: 'dashscope',
    label: '通义千问 / DashScope',
    badge: 'OpenAI 兼容',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    mode: 'openai',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long'],
  },
  {
    id: 'custom',
    label: '自定义兼容端点',
    badge: '高级',
    endpoint: '',
    mode: 'openai',
    models: [],
    custom: true,
  },
];

const IMAGE_PROVIDERS: ImageProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI Images',
    badge: '官方图像',
    endpoint: 'https://api.openai.com/v1',
    models: ['gpt-image-1', 'dall-e-3'],
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI 兼容图像端点',
    badge: '自定义',
    endpoint: '',
    models: [],
    custom: true,
  },
];

const DEFAULT_TEXT_PROVIDER = TEXT_PROVIDERS[0];
const DEFAULT_CONFIG: SettingsConfig = {
  textEndpoint: DEFAULT_TEXT_PROVIDER.endpoint,
  textKey: '',
  textModel: DEFAULT_TEXT_PROVIDER.models[0],
  textMode: DEFAULT_TEXT_PROVIDER.mode,
  imageEndpoint: '',
  imageKey: '',
  imageModel: '',
  reviewThreshold: 90,
  enableLocalSave: true,
};

const providerMatchesTextConfig = (config: SettingsConfig, provider: TextProviderPreset) => {
  if (provider.custom) return false;
  return config.textEndpoint.trim().replace(/\/$/, '') === provider.endpoint.replace(/\/$/, '') && config.textMode === provider.mode;
};

const resolveTextProvider = (config: SettingsConfig) => {
  return TEXT_PROVIDERS.find((provider) => providerMatchesTextConfig(config, provider)) || TEXT_PROVIDERS.find((provider) => provider.id === 'custom')!;
};

const resolveImageProvider = (config: SettingsConfig) => {
  return IMAGE_PROVIDERS.find((provider) => !provider.custom && config.imageEndpoint.trim().replace(/\/$/, '') === provider.endpoint.replace(/\/$/, '')) || IMAGE_PROVIDERS.find((provider) => provider.id === 'openai-compatible')!;
};

const mergeModelOptions = (models: string[], current: string) => {
  const next = [...models];
  if (current && !next.includes(current)) next.unshift(current);
  return next;
};

const isVisualFollowingText = (config: SettingsConfig) => {
  return Boolean(config.imageEndpoint && config.imageEndpoint === config.textEndpoint && config.imageKey === config.textKey);
};

export default function Settings() {
  const { invoke, isLoading } = useTudouBridge();
  const [config, setConfig] = useState<SettingsConfig>(DEFAULT_CONFIG);
  const [appVersion, setAppVersion] = useState('');
  const [dbMeta, setDbMeta] = useState<{ dbPath?: string; dataDir?: string }>({});
  const [textTestResult, setTextTestResult] = useState<any>(null);
  const [imageTestResult, setImageTestResult] = useState<any>(null);
  const [isTestingText, setIsTestingText] = useState(false);
  const [isTestingImage, setIsTestingImage] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  const [error, setError] = useState('');

  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const accentColor = useAppStore((state) => state.accentColor);
  const setAccentColor = useAppStore((state) => state.setAccentColor);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const [res, version, meta] = await Promise.all([
          invoke<any>('config/get', {}, { silent: true }).catch(() => null),
          invoke<string>('app/version', {}, { silent: true }).catch(() => ''),
          invoke<any>('database/meta', {}, { silent: true }).catch(() => null),
        ]);
        if (res && typeof res === 'object' && !Array.isArray(res)) {
          setConfig((prev) => {
            const merged = { ...prev, ...res } as SettingsConfig;
            if (!merged.textEndpoint) merged.textEndpoint = DEFAULT_TEXT_PROVIDER.endpoint;
            if (!merged.textMode) merged.textMode = DEFAULT_TEXT_PROVIDER.mode;
            if (!merged.textModel) merged.textModel = DEFAULT_TEXT_PROVIDER.models[0];
            return merged;
          });
        }
        if (typeof version === 'string' && version) {
          setAppVersion(version);
        } else if (version && typeof version === 'object' && 'version' in version) {
          setAppVersion(String((version as any).version));
        }
        if (meta && typeof meta === 'object' && !Array.isArray(meta)) setDbMeta(meta);
      } catch {}
    };
    fetchConfig();
  }, [invoke]);

  const selectedTextProvider = useMemo(() => resolveTextProvider(config), [config]);
  const selectedImageProvider = useMemo(() => resolveImageProvider(config), [config]);
  const textModelOptions = useMemo(() => mergeModelOptions(selectedTextProvider.models, config.textModel), [config.textModel, selectedTextProvider]);
  const imageModelOptions = useMemo(() => mergeModelOptions(selectedImageProvider.models, config.imageModel), [config.imageModel, selectedImageProvider]);
  const canFollowTextForImages = Boolean(selectedTextProvider.imageModels?.length);
  const imageSource = isVisualFollowingText(config) ? 'follow-text' : selectedImageProvider.id;

  const markDirty = () => {
    setIsDirty(true);
    setSavedStatus(false);
  };

  const patchConfig = (patch: Partial<SettingsConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    markDirty();
  };

  const updateConfig = (key: keyof SettingsConfig, value: any) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'textKey' && isVisualFollowingText(prev)) {
        next.imageKey = value;
      }
      return next;
    });
    markDirty();
  };

  const applyTextProvider = (providerId: string) => {
    const provider = TEXT_PROVIDERS.find((item) => item.id === providerId) || DEFAULT_TEXT_PROVIDER;
    setConfig((prev) => {
      const wasFollowingVisual = isVisualFollowingText(prev);
      const shouldAttachVisual = Boolean(provider.imageModels?.length && (!prev.imageEndpoint || wasFollowingVisual));
      const nextModel = provider.custom
        ? prev.textModel
        : provider.models.includes(prev.textModel) ? prev.textModel : provider.models[0];
      const next: SettingsConfig = {
        ...prev,
        textEndpoint: provider.custom ? prev.textEndpoint : provider.endpoint,
        textMode: provider.custom ? prev.textMode : provider.mode,
        textModel: nextModel,
      };
      if (shouldAttachVisual && provider.imageModels?.length) {
        next.imageEndpoint = provider.endpoint;
        next.imageKey = prev.textKey;
        next.imageModel = provider.imageModels.includes(prev.imageModel) ? prev.imageModel : provider.imageModels[0];
      }
      return next;
    });
    markDirty();
  };

  const applyImageSource = (sourceId: string) => {
    if (sourceId === 'follow-text' && selectedTextProvider.imageModels?.length) {
      patchConfig({
        imageEndpoint: config.textEndpoint,
        imageKey: config.textKey,
        imageModel: selectedTextProvider.imageModels.includes(config.imageModel) ? config.imageModel : selectedTextProvider.imageModels[0],
      });
      return;
    }

    const provider = IMAGE_PROVIDERS.find((item) => item.id === sourceId) || IMAGE_PROVIDERS[0];
    patchConfig({
      imageEndpoint: provider.custom ? config.imageEndpoint : provider.endpoint,
      imageModel: provider.custom ? config.imageModel : provider.models[0],
      imageKey: provider.custom ? config.imageKey : config.imageKey,
    });
  };

  const handleDeploy = async () => {
    setError('');
    try {
      await invoke('config/set', config);
      setIsDirty(false);
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2200);
    } catch (err: any) {
      setError(err.message || '参数覆写失败');
    }
  };

  const testTextConnection = async () => {
    setIsTestingText(true);
    setTextTestResult(null);
    setError('');
    try {
      const result = await invoke('config/test', {
        endpoint: config.textEndpoint,
        key: config.textKey,
        model: config.textModel,
        mode: config.textMode,
      }, { timeout: 30000 });
      setTextTestResult(result);
    } catch (err: any) {
      setTextTestResult({ ok: false, error: err.message || '连接测试失败' });
    } finally {
      setIsTestingText(false);
    }
  };

  const testImageConnection = async () => {
    setIsTestingImage(true);
    setImageTestResult(null);
    setError('');
    try {
      const result = await invoke('config/test', {
        type: 'image',
        endpoint: config.imageEndpoint,
        key: config.imageKey,
        model: config.imageModel,
      }, { timeout: 30000 });
      setImageTestResult(result);
    } catch (err: any) {
      setImageTestResult({ ok: false, error: err.message || '视觉连接测试失败' });
    } finally {
      setIsTestingImage(false);
    }
  };

  const maskedKey = (value: unknown) => {
    const text = typeof value === 'string' ? value : '';
    return text ? `${text.slice(0, 4)}••••${text.slice(-4)}` : '未配置';
  };

  return (
    <PageShell maxWidth="max-w-7xl">
      <ModuleHeader
        icon={<Cpu size={28} />}
        eyebrow="Admin Model Settings"
        title="模型与 API 配置 / 管理员"
        subtitle="配置服务端文本模型、视觉模型、数据库与审核阈值。API Key 只保存在后端配置中，普通用户页面不读取、不展示。"
        actions={<ActionBar align="right"><ActionButton onClick={handleDeploy} disabled={!isDirty || isLoading} isLoading={isLoading} icon={savedStatus ? <CheckCircle2 size={16} /> : <Save size={16} />}>{savedStatus ? '已保存' : '保存配置'}</ActionButton></ActionBar>}
      />

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6 min-w-0">
          <Panel title="文本 / 多模态模型" subtitle="TEXT GENERATION / LLM" actions={<ActionButton size="sm" variant="secondary" onClick={testTextConnection} disabled={isTestingText} isLoading={isTestingText} icon={<TestTube2 size={14} />}>测试连接</ActionButton>}>
            <div className="space-y-4">
              <FormField label="供应商">
                <SelectInput value={selectedTextProvider.id} onChange={(event) => applyTextProvider(event.target.value)}>
                  {TEXT_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                </SelectInput>
              </FormField>
              <ProviderStrip icon={<Sparkles size={15} />} label={selectedTextProvider.label} badge={selectedTextProvider.badge} />
              <FormField label="Access Key"><TextInput type="password" value={config.textKey} onChange={(event: any) => updateConfig('textKey', event.target.value)} placeholder="sk-..." /></FormField>
              <FormField label="模型">
                {selectedTextProvider.custom ? (
                  <TextInput value={config.textModel} onChange={(event: any) => updateConfig('textModel', event.target.value)} placeholder="model id" />
                ) : (
                  <SelectInput value={config.textModel} onChange={(event) => updateConfig('textModel', event.target.value)}>
                    {textModelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                  </SelectInput>
                )}
              </FormField>
              <Collapsible title="高级连接" subtitle="自动填充，一般不用改">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Endpoint URL"><TextInput value={config.textEndpoint} onChange={(event: any) => updateConfig('textEndpoint', event.target.value)} placeholder="Endpoint URL" /></FormField>
                  <FormField label="Mode">
                    <SelectInput value={config.textMode} onChange={(event) => updateConfig('textMode', event.target.value)}>
                      <option value="openai">openai</option>
                      <option value="anthropic">anthropic</option>
                      <option value="gemini">gemini</option>
                    </SelectInput>
                  </FormField>
                </div>
              </Collapsible>
              {textTestResult && <ResultViewer maxHeight="max-h-[200px]" title="TEXT MODEL TEST" content={JSON.stringify(textTestResult, null, 2)} />}
            </div>
          </Panel>

          <Panel title="视觉 / 图像模型" subtitle="VISUAL GENERATION" actions={<ActionButton size="sm" variant="secondary" onClick={testImageConnection} disabled={isTestingImage || !config.imageEndpoint || !config.imageKey || !config.imageModel} isLoading={isTestingImage} icon={<TestTube2 size={14} />}>测试视觉</ActionButton>}>
            <div className="space-y-4">
              <FormField label="视觉来源">
                <SelectInput value={imageSource} onChange={(event) => applyImageSource(event.target.value)}>
                  {canFollowTextForImages && <option value="follow-text">跟随文本供应商</option>}
                  {IMAGE_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                </SelectInput>
              </FormField>
              <ProviderStrip
                icon={<ImageIcon size={15} />}
                label={imageSource === 'follow-text' ? selectedTextProvider.label : selectedImageProvider.label}
                badge={imageSource === 'follow-text' ? '共用 Key / Endpoint' : selectedImageProvider.badge}
              />
              {imageSource !== 'follow-text' && (
                <FormField label="Access Key"><TextInput type="password" value={config.imageKey} onChange={(event: any) => updateConfig('imageKey', event.target.value)} placeholder="sk-..." /></FormField>
              )}
              <FormField label="图像模型">
                {imageSource === 'follow-text' && selectedTextProvider.imageModels?.length ? (
                  <SelectInput value={config.imageModel} onChange={(event) => updateConfig('imageModel', event.target.value)}>
                    {mergeModelOptions(selectedTextProvider.imageModels, config.imageModel).map((model) => <option key={model} value={model}>{model}</option>)}
                  </SelectInput>
                ) : selectedImageProvider.custom ? (
                  <TextInput value={config.imageModel} onChange={(event: any) => updateConfig('imageModel', event.target.value)} placeholder="image model id" />
                ) : (
                  <SelectInput value={config.imageModel} onChange={(event) => updateConfig('imageModel', event.target.value)}>
                    {imageModelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                  </SelectInput>
                )}
              </FormField>
              <Collapsible title="高级连接" subtitle="OpenAI-compatible images endpoint">
                <FormField label="Endpoint URL"><TextInput value={config.imageEndpoint} onChange={(event: any) => updateConfig('imageEndpoint', event.target.value)} placeholder="Endpoint URL" /></FormField>
              </Collapsible>
              {imageTestResult && <ResultViewer maxHeight="max-h-[200px]" title="VISUAL MODEL TEST" content={JSON.stringify(imageTestResult, null, 2)} />}
            </div>
          </Panel>
        </div>

        <div className="space-y-6 min-w-0">
          <Panel title="服务端持久化与诊断" subtitle="SERVER STORAGE / SQLITE" actions={<HardDrive size={18} className="text-cyan-300" />}>
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-white font-bold mb-3"><Database size={16} /> 数据库路径</div>
                <ResultViewer maxHeight="max-h-[150px]" title="DATABASE META" content={JSON.stringify(dbMeta, null, 2)} />
              </div>
              <FormField label="强制实体化保存">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">enableLocalSave · 触发服务端 SQLite 引擎写入磁盘</span>
                  <Toggle value={config.enableLocalSave} onChange={(v) => updateConfig('enableLocalSave', v)} />
                </div>
              </FormField>
              <FormField label="审核阈值 reviewThreshold"><TextInput className="w-24" type="number" value={config.reviewThreshold} onChange={(event: any) => updateConfig('reviewThreshold', Number(event.target.value))} /></FormField>
            </div>
          </Panel>

          <Panel title="主题设置" subtitle="切换暗色/亮色模式与强调色">
            <div className="space-y-4">
              <FormField label="暗色模式">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{themeMode === 'dark' ? '暗色' : '亮色'}</span>
                  <Toggle value={themeMode === 'dark'} onChange={(v) => setThemeMode(v ? 'dark' : 'light')} />
                </div>
              </FormField>
              <FormField label="强调色">
                <div className="flex items-center gap-3">
                  <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/10" />
                  <span className="text-sm font-mono text-white/60">{accentColor}</span>
                </div>
              </FormField>
            </div>
          </Panel>

          <Panel title="配置边界" subtitle="SERVER ONLY" actions={<ShieldAlert size={18} className="text-rose-300" />}>
            <div className="space-y-3 text-sm text-white/55 leading-relaxed">
              <p>供应商预设只负责填充 endpoint、mode 与默认模型。</p>
              <p>业务提示词、模板与运行链路全部留在服务端，客户端只负责展示与发起任务。</p>
              <p>API Key 只进入服务端配置，不返回普通用户、不写入 prompt dump、prompt audit 或业务日志。</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <BoundaryItem icon={<Link size={14} />} label="Endpoint" value={config.textEndpoint || '未配置'} />
              <BoundaryItem icon={<Key size={14} />} label="Text Key" value={maskedKey(config.textKey)} />
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function ProviderStrip({ icon, label, badge }: { icon: ReactNode; label: string; badge: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-indigo-300 shrink-0">{icon}</span>
        <span className="text-sm font-bold text-white/85 truncate">{label}</span>
      </div>
      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-widest text-white/45 uppercase">{badge}</span>
    </div>
  );
}

function BoundaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3 min-w-0"><div className="flex items-center gap-2 text-white/35 text-[10px] uppercase tracking-widest mb-2">{icon}{label}</div><div className="text-white/80 text-xs font-mono truncate" title={value}>{value}</div></div>;
}
