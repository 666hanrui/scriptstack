import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveFileSrc } from '../../lib/file-src';
import {
  Camera,
  Copy,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useTudouBridge } from '../../hooks/useTudouBridge';
import { useAppStore } from '../../store/useAppStore';
import Panel from '../ui/Panel';
import ActionBar, { ActionButton } from '../ui/ActionBar';
import FormField, { SelectInput, TextArea } from '../ui/FormField';
import EmptyState from '../ui/EmptyState';

export interface AssetImageRecord {
  id: string;
  projectId: string;
  taskId: string;
  assetType: string;
  assetId: string;
  assetName: string;
  category: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  sourcePromptId?: string;
  sourceTemplateId?: string;
  sourcePlatform?: string;
  visualIdentityJson?: string;
  tagsJson?: string;
  note: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const IMAGE_CATEGORIES = [
  { id: 'reference', label: '参考图', desc: '角色/场景/道具的参考设计图' },
  { id: 'turnaround', label: '三视图', desc: '角色多角度设定' },
  { id: 'costume', label: '定妆照', desc: '完整造型与服装' },
  { id: 'expression', label: '表情表', desc: '角色表情变化' },
  { id: 'keyframe', label: '关键帧', desc: '分镜关键画面' },
  { id: 'storyboard', label: '故事版', desc: '故事版分镜画面' },
  { id: 'concept', label: '概念图', desc: '场景或道具概念设计' },
  { id: 'moodboard', label: '氛围板', desc: '色彩与情绪参考' },
  { id: 'poster', label: '主视觉', desc: '海报或宣传图' },
  { id: 'other', label: '其他', desc: '未分类图片' },
] as const;

const ASSET_TYPE_LABELS: Record<string, string> = {
  character: '角色',
  scene: '场景',
  prop: '道具',
  shot: '镜头',
};

interface AssetImageGalleryProps {
  /** Which asset type to filter by. If not provided, show all. */
  assetType?: string;
  /** Which asset ID to filter by. If not provided, show all for the type. */
  assetId?: string;
  /** Asset name for display */
  assetName?: string;
  /** If true, show compact inline mode */
  compact?: boolean;
  /** Initial category for uploads in this gallery. */
  defaultCategory?: string;
  /** Callback when an image is selected */
  onSelectImage?: (image: AssetImageRecord) => void;
  /** Callback after images are uploaded/deleted/updated and reloaded. */
  onImagesChanged?: () => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AssetImageGallery({
  assetType,
  assetId,
  assetName,
  compact,
  defaultCategory,
  onSelectImage,
  onImagesChanged,
}: AssetImageGalleryProps) {
  const { invoke } = useTudouBridge();
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentTaskId = useAppStore((s) => s.currentTaskId);
  const showToast = useAppStore((s) => s.showToast);

  const [images, setImages] = useState<AssetImageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<AssetImageRecord | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(defaultCategory || 'reference');
  const [uploadNote, setUploadNote] = useState('');
  const [uploadPlatform, setUploadPlatform] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const loadImages = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const payload: Record<string, string> = { projectId: currentProjectId };
      if (assetType) payload.assetType = assetType;
      if (assetId) payload.assetId = assetId;
      const rows = await invoke<AssetImageRecord[]>('asset-image/list', payload);
      setImages(Array.isArray(rows) ? rows : []);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, assetType, assetId, invoke]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  useEffect(() => {
    if (defaultCategory) setUploadCategory(defaultCategory);
  }, [defaultCategory, assetType, assetId]);

  const handleUpload = async (base64: string, mimeType: string, originalName: string) => {
    if (!currentProjectId) return;
    setUploading(true);
    try {
      await invoke('asset-image/save-file', {
        base64,
        mimeType,
        projectId: currentProjectId,
        taskId: currentTaskId || '',
        assetType: assetType || 'misc',
        assetId: assetId || '',
        assetName: assetName || '',
        category: uploadCategory,
        note: uploadNote,
        sourcePlatform: uploadPlatform,
        fileName: originalName,
      });
      showToast({ message: '图片已保存', type: 'success' });
      setShowUpload(false);
      setUploadNote('');
      setUploadPlatform('');
      await loadImages();
      onImagesChanged?.();
    } catch (err: any) {
      showToast({ message: err?.message || '上传失败', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const base64 = await fileToBase64(file);
      await handleUpload(base64, file.type, file.name);
    }
  };

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const base64 = await fileToBase64(file);
          await handleUpload(base64, file.type, `paste-${Date.now()}.png`);
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await handleFileSelect(e.dataTransfer.files);
  };

  const deleteImage = async (id: string) => {
    try {
      await invoke('asset-image/delete', { id });
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (selectedImage?.id === id) setSelectedImage(null);
      showToast({ message: '已删除', type: 'success' });
      onImagesChanged?.();
    } catch (err: any) {
      showToast({ message: err?.message || '删除失败', type: 'error' });
    }
  };

  const updateImageNote = async (id: string, note: string) => {
    try {
      await invoke('asset-image/update', { id, note });
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, note } : img)));
    } catch {}
  };

  const copyVisualIdentity = async (image: AssetImageRecord) => {
    const identity = image.visualIdentityJson
      ? JSON.parse(image.visualIdentityJson)
      : {
          assetType: image.assetType,
          assetName: image.assetName,
          category: image.category,
          note: image.note,
        };
    await navigator.clipboard.writeText(JSON.stringify(identity, null, 2));
    showToast({ message: '角色视觉身份已复制', type: 'success' });
  };

  useEffect(() => {
    const handler = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, assetType, assetId, uploadCategory]);

  const filtered = filterCategory
    ? images.filter((img) => img.category === filterCategory)
    : images;

  const grouped = filtered.reduce<Record<string, AssetImageRecord[]>>((acc, img) => {
    const key = img.assetType || 'other';
    (acc[key] ||= []).push(img);
    return acc;
  }, {});

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/40 font-mono">{images.length} 张图片</span>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
          >
            <Plus size={10} />
            添加
          </button>
        </div>
        {showUpload && renderUploadPanel()}
        <div className="grid grid-cols-3 gap-1.5">
          {filtered.slice(0, 9).map((img) => (
            <button
              key={img.id}
              onClick={() => {
                setSelectedImage(img);
                onSelectImage?.(img);
              }}
              className={`aspect-square rounded-lg border overflow-hidden transition-all ${
                selectedImage?.id === img.id
                  ? 'border-indigo-500/60 ring-1 ring-indigo-500/30'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <img
                src={resolveFileSrc(img.filePath)}
                alt={img.assetName || img.fileName}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderUploadPanel() {
    return (
      <div className="rounded-lg border border-dashed border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/80">上传图片</span>
          <button onClick={() => setShowUpload(false)} className="text-white/30 hover:text-white/60">
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="图片分类">
            <SelectInput value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
              {IMAGE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label} — {cat.desc}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="来源平台">
            <SelectInput value={uploadPlatform} onChange={(e) => setUploadPlatform(e.target.value)}>
              <option value="">未指定</option>
              <option value="chatgpt">ChatGPT / GPT Image</option>
              <option value="gemini">Gemini</option>
              <option value="midjourney">Midjourney</option>
              <option value="jimeng">即梦 / 可灵</option>
              <option value="comfyui">ComfyUI</option>
              <option value="sd">Stable Diffusion</option>
              <option value="other">其他</option>
            </SelectInput>
          </FormField>
        </div>
        <FormField label="备注">
          <TextArea
            rows={2}
            value={uploadNote}
            onChange={(e) => setUploadNote(e.target.value)}
            placeholder="描述这张图片的用途、使用的提示词、或其他备注..."
          />
        </FormField>
        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center gap-2 py-6 rounded-lg border border-dashed border-white/15 hover:border-indigo-500/40 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={20} className="text-white/30" />
          <span className="text-xs text-white/40">
            拖拽图片到此处、点击选择文件、或直接 <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/60 text-[10px]">⌘V</kbd> 粘贴
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        </div>
        {uploading && (
          <div className="text-xs text-indigo-300 animate-pulse text-center">保存中...</div>
        )}
      </div>
    );
  }

  return (
    <Panel
      title={assetName ? `${assetName} 的图片` : '资产图片库'}
      subtitle={`${images.length} 张 · ${assetType ? ASSET_TYPE_LABELS[assetType] || assetType : '全部'}`}
      actions={
        <ActionBar align="right" className="flex-wrap">
          <ActionButton
            size="sm"
            variant="secondary"
            onClick={() => setShowUpload(!showUpload)}
            icon={<Plus size={14} />}
          >
            上传图片
          </ActionButton>
          <ActionButton
            size="sm"
            variant="ghost"
            onClick={loadImages}
            isLoading={loading}
            icon={<FolderOpen size={14} />}
          >
            刷新
          </ActionButton>
        </ActionBar>
      }
    >
      {showUpload && renderUploadPanel()}

      {/* Filter bar */}
      {images.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button
            onClick={() => setFilterCategory('')}
            className={`text-[10px] px-2 py-1 rounded-lg transition-all ${
              !filterCategory
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'bg-white/[0.04] text-white/40 border border-transparent hover:text-white/60'
            }`}
          >
            全部
          </button>
          {IMAGE_CATEGORIES.filter((cat) => images.some((img) => img.category === cat.id)).map(
            (cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-all ${
                  filterCategory === cat.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-white/[0.04] text-white/40 border border-transparent hover:text-white/60'
                }`}
              >
                {cat.label} ({images.filter((img) => img.category === cat.id).length})
              </button>
            ),
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="暂无图片"
          description={
            showUpload
              ? '请上传图片或从剪贴板粘贴'
              : '点击"上传图片"添加角色设计、场景概念图等资产图片。\n支持拖拽、选择文件和 ⌘V 粘贴。'
          }
          icon={<Camera size={24} />}
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, typeImages]) => (
            <div key={type}>
              {!assetType && (
                <div className="text-[11px] font-mono uppercase text-white/30 mb-2">
                  {ASSET_TYPE_LABELS[type] || type} ({typeImages.length})
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {typeImages.map((img) => (
                  <div
                    key={img.id}
                    className={`group relative rounded-lg border overflow-hidden transition-all cursor-pointer ${
                      selectedImage?.id === img.id
                        ? 'border-indigo-500/60 ring-1 ring-indigo-500/30'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                    onClick={() => {
                      setSelectedImage(selectedImage?.id === img.id ? null : img);
                      onSelectImage?.(img);
                    }}
                  >
                    <div className="aspect-[16/10] bg-black/40">
                      <img
                        src={resolveFileSrc(img.filePath)}
                        alt={img.assetName || img.fileName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono">
                          {IMAGE_CATEGORIES.find((c) => c.id === img.category)?.label || img.category}
                        </span>
                        {img.sourcePlatform && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono">
                            {img.sourcePlatform}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/60 truncate">
                        {img.assetName || img.fileName}
                      </div>
                      {img.note && (
                        <div className="text-[10px] text-white/30 truncate mt-0.5">{img.note}</div>
                      )}
                    </div>
                    {/* Hover actions */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyVisualIdentity(img);
                        }}
                        className="p-1 rounded bg-black/60 text-white/60 hover:text-white"
                        title="复制视觉身份"
                      >
                        <Copy size={10} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImage(img.id);
                        }}
                        className="p-1 rounded bg-black/60 text-white/60 hover:text-red-400"
                        title="删除"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedImage && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-bold text-white/85">{selectedImage.assetName || selectedImage.fileName}</div>
              <div className="text-[10px] text-white/30 font-mono mt-0.5">
                {selectedImage.category} · {formatFileSize(selectedImage.fileSize)}
                {selectedImage.width && selectedImage.height && ` · ${selectedImage.width}×${selectedImage.height}`}
                {selectedImage.sourcePlatform && ` · ${selectedImage.sourcePlatform}`}
              </div>
            </div>
            <button onClick={() => setSelectedImage(null)} className="text-white/30 hover:text-white/60">
              <X size={14} />
            </button>
          </div>
          <div className="rounded-lg overflow-hidden bg-black/30 max-h-[400px]">
            <img
              src={resolveFileSrc(selectedImage.filePath)}
              alt={selectedImage.assetName || selectedImage.fileName}
              className="w-full h-full object-contain max-h-[400px]"
            />
          </div>
          <FormField label="备注">
            <TextArea
              rows={2}
              value={selectedImage.note}
              onChange={(e) => {
                setSelectedImage({ ...selectedImage, note: e.target.value });
                setImages((prev) =>
                  prev.map((img) =>
                    img.id === selectedImage.id ? { ...img, note: e.target.value } : img,
                  ),
                );
              }}
              onBlur={() => updateImageNote(selectedImage.id, selectedImage.note)}
              placeholder="图片备注..."
            />
          </FormField>
        </div>
      )}
    </Panel>
  );
}
