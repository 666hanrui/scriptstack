import React from 'react';
import { Wand2, Save } from 'lucide-react';
import Panel from '../ui/Panel';
import ActionBar, { ActionButton } from '../ui/ActionBar';
import FormField, { TextArea, TextInput } from '../ui/FormField';
import Collapsible from '../ui/Collapsible';

export interface ScriptFormData {
  mode: string;
  inputSummary: string;
  genre: string;
  style: string;
  duration: string;
  audience: string;
  tone: string;
  ending: string;
  outputMode: string;
  episodes: string;
  customStyle: string;
}

interface Props {
  formData: ScriptFormData;
  setFormData: (data: ScriptFormData | ((prev: ScriptFormData) => ScriptFormData)) => void;
  selectedTaskId: string | null;
  busy: string;
  onGenerate: () => void;
  onSaveDraft: () => void;
}

export default function ScriptGenerationForm({ formData, setFormData, selectedTaskId, busy, onGenerate, onSaveDraft }: Props) {
  const updateField = (field: keyof ScriptFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <Panel
      title="生成新剧本"
      subtitle={selectedTaskId ? '可覆盖当前任务' : '将创建新 script task'}
      actions={<ActionButton onClick={onGenerate} isLoading={busy === 'generate'} icon={<Wand2 size={16} />}>生成剧本</ActionButton>}
      footer={
        <ActionBar>
          <ActionButton variant="secondary" onClick={onSaveDraft} isLoading={busy === 'draft'} icon={<Save size={16} />}>新建草稿</ActionButton>
          <ActionButton onClick={onGenerate} isLoading={busy === 'generate'} icon={<Wand2 size={16} />}>生成剧本</ActionButton>
        </ActionBar>
      }
    >
      <Collapsible title="生成参数" subtitle="Mode / Duration / Episodes / Genre / Style ...">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          <FormField label="Mode"><TextInput value={formData.mode} onChange={updateField('mode')} /></FormField>
          <FormField label="Duration"><TextInput value={formData.duration} onChange={updateField('duration')} /></FormField>
          <FormField label="Episodes"><TextInput value={formData.episodes} onChange={updateField('episodes')} /></FormField>
          <FormField label="Genre"><TextInput value={formData.genre} onChange={updateField('genre')} /></FormField>
          <FormField label="Style"><TextInput value={formData.style} onChange={updateField('style')} /></FormField>
          <FormField label="Output Mode"><TextInput value={formData.outputMode} onChange={updateField('outputMode')} /></FormField>
          <FormField label="Audience"><TextInput value={formData.audience} onChange={updateField('audience')} /></FormField>
          <FormField label="Tone"><TextInput value={formData.tone} onChange={updateField('tone')} /></FormField>
          <FormField label="Ending"><TextInput value={formData.ending} onChange={updateField('ending')} /></FormField>
        </div>
      </Collapsible>
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <FormField label="剧情描述" helperText="不走八步，直接输入剧情概念、人物冲突、目标平台和风格要求。">
          <TextArea value={formData.inputSummary} onChange={updateField('inputSummary')} rows={3} />
        </FormField>
        <FormField label="Custom Style" helperText="可选：补充结构、禁忌、语言、平台规则。">
          <TextArea value={formData.customStyle} onChange={updateField('customStyle')} rows={3} />
        </FormField>
      </div>
    </Panel>
  );
}
