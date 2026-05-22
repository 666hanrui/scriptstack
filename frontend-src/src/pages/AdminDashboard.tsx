import { useEffect, useState } from 'react';
import { Activity, Database, KeyRound, Server, Settings, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/ui/PageShell';
import ModuleHeader from '../components/ui/ModuleHeader';
import Panel from '../components/ui/Panel';
import ActionBar, { ActionButton } from '../components/ui/ActionBar';
import ResultViewer from '../components/ui/ResultViewer';
import { useTudouBridge } from '../hooks/useTudouBridge';

type AdminSummary = {
  users?: {
    total?: number;
    admins?: number;
    active15m?: number;
    active24h?: number;
    recent?: Array<Record<string, any>>;
  };
  workload?: Record<string, number>;
  model?: Record<string, any>;
  server?: Record<string, any>;
};

const nf = new Intl.NumberFormat('zh-CN');

export default function AdminDashboard() {
  const { invoke, isLoading } = useTudouBridge();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AdminSummary>({});
  const [error, setError] = useState('');

  const loadSummary = async () => {
    setError('');
    try {
      const next = await invoke<AdminSummary>('admin/summary', {}, { silent: true });
      setSummary(next || {});
    } catch (err: any) {
      setError(err.message || '加载管理员概览失败');
    }
  };

  useEffect(() => {
    loadSummary();
    const timer = window.setInterval(loadSummary, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const users = summary.users || {};
  const workload = summary.workload || {};
  const model = summary.model || {};
  const server = summary.server || {};
  const recentUsers = Array.isArray(users.recent) ? users.recent : [];

  return (
    <PageShell maxWidth="max-w-7xl">
      <ModuleHeader
        icon={<ShieldCheck size={26} />}
        eyebrow="Admin Console"
        title="管理员后台"
        subtitle="服务端公测运营面板：用户、活跃状态、模型配置与系统负载。"
        actions={
          <ActionBar align="right">
            <ActionButton variant="secondary" onClick={loadSummary} isLoading={isLoading} icon={<Activity size={16} />}>刷新</ActionButton>
            <ActionButton onClick={() => navigate('/settings')} icon={<Settings size={16} />}>模型与 API</ActionButton>
          </ActionBar>
        }
      />

      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric icon={<Users size={18} />} label="用户总数" value={users.total ?? 0} />
        <Metric icon={<ShieldCheck size={18} />} label="管理员" value={users.admins ?? 0} />
        <Metric icon={<Activity size={18} />} label="15分钟活跃" value={users.active15m ?? 0} />
        <Metric icon={<Activity size={18} />} label="24小时活跃" value={users.active24h ?? 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="模型 API 状态" subtitle="SERVER SIDE KEYS" actions={<KeyRound size={18} className="text-indigo-300" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Info label="文本端点" value={model.textEndpoint || '未配置'} />
            <Info label="文本模型" value={model.textModel || '未配置'} />
            <Info label="文本 Key" value={model.textKeyConfigured ? model.textKeyMasked || '已配置' : '未配置'} />
            <Info label="视觉 Key" value={model.imageKeyConfigured ? model.imageKeyMasked || '已配置' : '未配置'} />
            <Info label="DB 文本 Key" value={model.dbTextKeyConfigured ? '已配置' : '未配置'} />
            <Info label="ENV 文本 Key" value={model.envTextKeyConfigured ? '已配置' : '未配置'} />
          </div>
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/80 leading-relaxed">
            {model.concurrencyNote || '当前为单主 API 配置。公测初期可用；并发上来后再扩展 Key 池、队列和限流。'}
          </div>
        </Panel>

        <Panel title="服务端状态" subtitle="SERVER" actions={<Server size={18} className="text-cyan-300" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Info label="监听地址" value={server.listenAddr || '-'} />
            <Info label="JWT 有效期" value={`${server.jwtExpireHours || '-'} h`} />
            <Info label="数据库" value={server.dbPath || '-'} />
            <Info label="上传目录" value={server.uploadDir || '-'} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="工作负载" subtitle="CONTENT PIPELINE" actions={<Database size={18} className="text-emerald-300" />}>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(workload).map(([key, value]) => (
              <Info key={key} label={key} value={nf.format(Number(value || 0))} />
            ))}
          </div>
        </Panel>

        <Panel title="最近用户" subtitle="RECENT USERS">
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            {recentUsers.length === 0 ? (
              <div className="p-5 text-sm text-[var(--text-secondary)]">暂无用户活动。</div>
            ) : recentUsers.map((user) => (
              <div key={user.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--border-subtle)] last:border-b-0 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-black text-[var(--text-primary)] truncate">{user.username}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{user.email || 'no email'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--accent)]">{user.role}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{user.lastSeenAt || user.createdAt || '-'}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <ResultViewer title="ADMIN RAW SUMMARY" content={JSON.stringify(summary, null, 2)} />
    </PageShell>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest">{icon}{label}</div>
      <div className="mt-4 text-3xl font-black text-[var(--text-primary)]">{nf.format(Number(value || 0))}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">{label}</div>
      <div className="text-sm font-mono text-[var(--text-primary)] truncate" title={String(value)}>{value}</div>
    </div>
  );
}
