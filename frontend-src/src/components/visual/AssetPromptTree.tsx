import { useEffect, useState } from 'react';
import { Box, Clapperboard, Film, Layers3, MapPin, User } from 'lucide-react';
import { useTudouBridge } from '../../hooks/useTudouBridge';
import { useAppStore } from '../../store/useAppStore';
import Collapsible from '../ui/Collapsible';

export interface AssetItem {
  id: string;
  name: string;
  type: 'character' | 'scene' | 'prop' | 'shot';
  data: Record<string, any>;
}

interface SelectedNode {
  type: 'character' | 'scene' | 'prop' | 'shot';
  id: string;
  name: string;
  data: Record<string, any>;
}

interface AssetPromptTreeProps {
  onSelect: (node: SelectedNode) => void;
  onItemsLoaded?: (items: AssetItem[]) => void;
  initialType?: 'character' | 'scene' | 'prop' | 'shot' | null;
  initialId?: string | null;
  initialIndex?: number | null;
  /** Filter the tree to show only this type. 'all' or undefined = show all. */
  filterType?: 'character' | 'scene' | 'prop' | 'shot' | 'all';
}

const TYPE_META = {
  character: { label: '角色', icon: User, color: 'text-purple-300' },
  scene: { label: '场景', icon: MapPin, color: 'text-cyan-300' },
  prop: { label: '道具', icon: Box, color: 'text-amber-300' },
  shot: { label: '镜头', icon: Film, color: 'text-emerald-300' },
};

function parseJsonMaybe(value: any) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function assetTypeOf(row: any) {
  const type = row.assetType || row.asset_type || row.type;
  if (type === 'characters' || type === 'role') return 'character';
  if (type === 'scenes') return 'scene';
  if (type === 'props') return 'prop';
  return type;
}

function assetDataOf(row: any) {
  return parseJsonMaybe(row.assetDataJson || row.asset_data_json) || row.assetData || row.asset_data || row.data || row;
}

function normalizeAssetRows(rows: any[], type: 'character' | 'scene' | 'prop') {
  const out: AssetItem[] = [];
  rows.forEach((row: any, rowIndex: number) => {
    const rowType = assetTypeOf(row);
    const data = assetDataOf(row);
    if (rowType !== type) return;
    if (Array.isArray(data)) {
      data.forEach((item: any, itemIndex: number) => {
        out.push({ id: item.id || `${row.id || type}-${itemIndex}`, name: item.name || `未命名${itemIndex + 1}`, type, data: item || {} });
      });
      return;
    }
    out.push({ id: data?.id || data?.assetId || row.id || `${type}-${rowIndex}`, name: data?.name || '未命名', type, data: data || {} });
  });
  return out;
}

function normalizeShotRows(rows: any[], source: 'seedance' | 'prompt-output') {
  return rows.map((u: any, i: number) => {
    const copyArea = u.copyArea || u.copy_area || u.prompt || u.text || u.content || '';
    const sceneType = u.sceneType || u.scene_type || u.name || u.title || '';
    return {
      id: u.id || `${source}-shot-${u.unitIndex ?? u.unit_index ?? i}`,
      name: sceneType || copyArea.slice(0, 20) || `镜头 ${i + 1}`,
      type: 'shot' as const,
      data: {
        name: sceneType || `镜头 ${i + 1}`,
        sceneType,
        subShotCount: u.subShotCount || u.sub_shot_count || 0,
        durationSec: u.durationSec || u.duration_sec || 0,
        copyArea,
        noteArea: u.noteArea || u.note_area_json || '',
        status: u.status || '',
        characters: u.characters || u.character || '',
        action: u.action || copyArea,
        emotion: u.emotion || '',
        source,
        index: i,
      },
    };
  });
}

export default function AssetPromptTree({ onSelect, onItemsLoaded, initialType, initialId, initialIndex, filterType }: AssetPromptTreeProps) {
  const { invoke } = useTudouBridge();
  const currentTaskId = useAppStore((s) => s.currentTaskId);
  const [characters, setCharacters] = useState<AssetItem[]>([]);
  const [scenes, setScenes] = useState<AssetItem[]>([]);
  const [props, setProps] = useState<AssetItem[]>([]);
  const [shots, setShots] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!currentTaskId) return;
    setLoading(true);
    Promise.all([
      invoke<any[]>('asset/get-all', { taskId: currentTaskId }),
      invoke<any[]>('seedance/list-units', { taskId: currentTaskId }).catch(() => []),
      invoke<any>('prompt/get-output', { taskId: currentTaskId }, { silent: true }).catch(() => null),
    ]).then(([assetRows, seedanceRows, promptOutput]) => {
      const assets = Array.isArray(assetRows) ? assetRows : [];
      const nextCharacters = normalizeAssetRows(assets, 'character');
      const nextScenes = normalizeAssetRows(assets, 'scene');
      const nextProps = normalizeAssetRows(assets, 'prop');
      setCharacters(nextCharacters);
      setScenes(nextScenes);
      setProps(nextProps);

      const units = Array.isArray(seedanceRows) ? seedanceRows : [];
      const outputGroups = parseJsonMaybe(promptOutput?.seedanceGroupsJson || promptOutput?.seedance_groups_json) || [];
      const nextShots = [
        ...normalizeShotRows(Array.isArray(outputGroups) ? outputGroups : [], 'prompt-output'),
        ...normalizeShotRows(units, 'seedance'),
      ].filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index);
      setShots(nextShots);

      const itemsByType = {
        character: nextCharacters,
        scene: nextScenes,
        prop: nextProps,
        shot: nextShots,
      };
      const allItems = [...nextCharacters, ...nextScenes, ...nextProps, ...nextShots];
      onItemsLoaded?.(allItems);
      const requested = (initialId ? allItems.find((item) => item.id === initialId) : null) ||
        (initialType && Number.isFinite(initialIndex as number) ? itemsByType[initialType]?.[initialIndex as number] : null) ||
        (initialType ? itemsByType[initialType]?.[0] : null);
      if (requested) selectItem(requested);
    }).catch(() => {
      setCharacters([]); setScenes([]); setProps([]); setShots([]);
      onItemsLoaded?.([]);
    }).finally(() => setLoading(false));
  }, [currentTaskId, invoke, initialType, initialId, initialIndex, onItemsLoaded]);

  function selectItem(item: AssetItem) {
    setSelectedId(item.id);
    onSelect({ type: item.type, id: item.id, name: item.name, data: item.data });
  }

  function renderSection(type: 'character' | 'scene' | 'prop' | 'shot', items: AssetItem[]) {
    if (items.length === 0) return null;
    const meta = TYPE_META[type];
    const Icon = meta.icon;
    return (
      <Collapsible title={meta.label} subtitle={`${items.length} 个`} defaultOpen={type === 'character'}>
        <div className="space-y-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => selectItem(item)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${selectedId === item.id ? 'bg-indigo-500/20 border border-indigo-500/40' : 'hover:bg-white/[0.04] border border-transparent'}`}
            >
              <Icon size={12} className={meta.color + ' shrink-0'} />
              <span className={`truncate ${selectedId === item.id ? 'text-white/90' : 'text-white/60'}`}>{item.name}</span>
            </button>
          ))}
        </div>
      </Collapsible>
    );
  }

  if (!currentTaskId) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-white/30 text-sm gap-2">
        <Layers3 size={20} />
        <span>请先选择一个剧本任务</span>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-white/40 text-sm">加载资产中…</div>;
  }

  const total = characters.length + scenes.length + props.length + shots.length;

  return (
    <div className="space-y-1">
      <div className="text-[11px] text-white/30 px-2 pb-2 font-mono">
        {total === 0 ? '暂无资产' : `${characters.length} 角色 / ${scenes.length} 场景 / ${props.length} 道具 / ${shots.length} 镜头`}
      </div>
      {(!filterType || filterType === 'all' || filterType === 'character') && renderSection('character', characters)}
      {(!filterType || filterType === 'all' || filterType === 'scene') && renderSection('scene', scenes)}
      {(!filterType || filterType === 'all' || filterType === 'prop') && renderSection('prop', props)}
      {(!filterType || filterType === 'all' || filterType === 'shot') && renderSection('shot', shots)}
    </div>
  );
}
