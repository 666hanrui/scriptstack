import { useAppStore } from '../store/useAppStore';

export function useContextMetrics(extraMetrics: Array<{ label: string; value: unknown }> = []) {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentTaskId = useAppStore((s) => s.currentTaskId);

  return [
    {
      label: 'Project ID',
      value: currentProjectId ? `${currentProjectId.slice(0, 8)}...` : 'N/A',
      copyable: currentProjectId || undefined,
      isMono: true,
    },
    {
      label: 'Script Task ID',
      value: currentTaskId ? `${currentTaskId.slice(0, 8)}...` : 'N/A',
      copyable: currentTaskId || undefined,
      isMono: true,
    },
    ...extraMetrics,
  ];
}
