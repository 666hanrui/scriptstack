import React from 'react';

interface Metric {
  label: string;
  value: React.ReactNode;
  copyable?: string;
  isMono?: boolean;
}

export default function ContextMetricGrid({ metrics }: { metrics: Metric[] }) {
  void metrics;
  return null;
}
