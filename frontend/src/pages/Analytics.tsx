import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import api from '../utils/api';

type AnalyticsTab = 'production' | 'materials' | 'moulds' | 'downtime';
type RiskFilter = 'all' | 'healthy' | 'watch' | 'critical' | 'expired';

const tabConfig: Array<{ id: AnalyticsTab; label: string; icon: string; endpoint: string }> = [
  { id: 'production', label: 'Production Volume', icon: 'precision_manufacturing', endpoint: '/analytics/production' },
  { id: 'materials', label: 'Material Usage', icon: 'inventory_2', endpoint: '/analytics/raw-material' },
  { id: 'moulds', label: 'Mould Lifecycle', icon: 'timer', endpoint: '/analytics/mould-life' },
  { id: 'downtime', label: 'Downtime Analysis', icon: 'warning', endpoint: '/analytics/downtime' },
];

const riskLabels: Record<RiskFilter, string> = {
  all: 'All',
  healthy: 'Healthy',
  watch: 'Watch',
  critical: 'Critical',
  expired: 'Expired',
};

function csvEncode(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, records: Array<Record<string, unknown>>) {
  if (records.length === 0) return;

  const keys = Object.keys(records[0]);
  const csv = [
    keys.join(','),
    ...records.map(record => keys.map(key => csvEncode(record[key])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  return `${(minutes / 60).toFixed(1)} hr`;
}

export function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('production');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mouldSearch, setMouldSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');

  const activeConfig = tabConfig.find(tab => tab.id === activeTab) || tabConfig[0];

  const fetchData = useCallback(async () => {
    if (user?.role !== 'company') return;

    setLoading(true);
    setError('');
    try {
      const res = await api.get(activeConfig.endpoint);
      setData(res.data?.data || null);
    } catch (err: any) {
      setData(null);
      setError(err.response?.data?.error?.message || `Failed to fetch ${activeConfig.label}.`);
    } finally {
      setLoading(false);
    }
  }, [activeConfig.endpoint, activeConfig.label, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mouldItems = useMemo(() => {
    const items = data?.items || [];
    return items
      .filter((mould: any) => riskFilter === 'all' || mould.riskLevel === riskFilter)
      .filter((mould: any) => {
        const haystack = `${mould.code} ${mould.name} ${mould.vendor?.name || ''}`.toLowerCase();
        return haystack.includes(mouldSearch.toLowerCase());
      })
      .sort((a: any, b: any) => Number(b.percentage || 0) - Number(a.percentage || 0));
  }, [data, mouldSearch, riskFilter]);

  const exportAnalytics = () => {
    if (!data) return;

    if (activeTab === 'moulds') {
      downloadCsv(`mould-lifecycle-${new Date().toISOString().split('T')[0]}.csv`, (data.items || []).map((mould: any) => ({
        code: mould.code,
        name: mould.name,
        lifecycleState: mould.lifecycleState,
        vendor: mould.vendor?.name || 'Unassigned',
        accumulated: mould.accumulated,
        limit: mould.limit,
        remainingShots: mould.remainingShots,
        percentage: Math.round(mould.percentage || 0),
        riskLevel: mould.riskLevel,
      })));
      return;
    }

    if (activeTab === 'downtime') {
      downloadCsv(`downtime-analysis-${new Date().toISOString().split('T')[0]}.csv`, [
        ...(data.byReason || []).map((row: any) => ({ section: 'reason', name: row.label, minutes: row.minutes, count: row.count, percentage: row.percentage })),
        ...(data.byVendor || []).map((row: any) => ({ section: 'vendor', name: row.name, minutes: row.minutes, count: row.count, percentage: '' })),
        ...(data.byMould || []).map((row: any) => ({ section: 'mould', name: `${row.code} ${row.name}`, minutes: row.minutes, count: row.count, percentage: '' })),
      ]);
      return;
    }

    downloadCsv(`${activeTab}-analytics-${new Date().toISOString().split('T')[0]}.csv`, Array.isArray(data) ? data : [data]);
  };

  if (user?.role !== 'company') {
    return <div className="p-margin font-body-md text-danger">Access Denied. Company admins only.</div>;
  }

  return (
    <div className="flex-1 p-margin flex flex-col gap-margin h-full overflow-y-auto">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b-4 border-on-background pb-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-background uppercase tracking-tight leading-none">Analytics Studio</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl">
            Deep-dive operational metrics, vendor performance tracking, and historical trends.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} disabled={loading} className="bg-surface border-2 border-on-background p-3 neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex gap-2 items-center uppercase font-label-sm text-label-sm disabled:opacity-50">
            <span className="material-symbols-outlined text-[20px]">refresh</span> Refresh
          </button>
          <button onClick={exportAnalytics} disabled={!data || loading} className="bg-surface border-2 border-on-background p-3 neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex gap-2 items-center uppercase font-label-sm text-label-sm disabled:opacity-50">
            <span className="material-symbols-outlined text-[20px]">download</span> Export
          </button>
        </div>
      </header>

      <div className="flex border-b-2 border-on-background overflow-x-auto hide-scrollbar">
        {tabConfig.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setData(null);
              setError('');
            }}
            className={`px-6 py-4 font-headline-md text-[18px] uppercase border-b-4 flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-surface-container-low'
                : 'border-transparent text-on-surface-variant hover:bg-surface-container-highest hover:text-on-background'
            }`}
          >
            <span className={`material-symbols-outlined ${activeTab === tab.id ? 'fill-icon' : ''}`}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-surface border-2 border-on-background neo-shadow p-6 flex flex-col min-h-[400px]">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center font-body-md">Loading {activeConfig.label}...</div>
        ) : error ? (
          <div className="flex flex-col gap-4">
            <div className="bg-error-container border-2 border-on-background p-4">
              <h3 className="font-headline-md text-danger">Analytics Fetch Failed</h3>
              <p className="font-body-md mt-2">{error}</p>
            </div>
            <button onClick={fetchData} className="w-fit neo-btn-primary px-6 py-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Retry
            </button>
          </div>
        ) : activeTab === 'production' && Array.isArray(data) ? (
          <ProductionTable rows={data} />
        ) : activeTab === 'materials' && Array.isArray(data) ? (
          <MaterialsTable rows={data} />
        ) : activeTab === 'moulds' && data ? (
          <MouldLifecycle
            data={data}
            items={mouldItems}
            search={mouldSearch}
            riskFilter={riskFilter}
            onSearch={setMouldSearch}
            onRiskFilter={setRiskFilter}
            onOpenMoulds={() => navigate('/moulds')}
          />
        ) : activeTab === 'downtime' && data ? (
          <DowntimeAnalysis data={data} />
        ) : (
          <EmptyState label={activeConfig.label} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center w-full h-full flex flex-col items-center justify-center opacity-60">
      <span className="material-symbols-outlined text-[48px] text-secondary mb-4">analytics</span>
      <p className="font-body-md text-secondary">No {label.toLowerCase()} data available.</p>
    </div>
  );
}

function ProductionTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <EmptyState label="production" />;

  return (
    <div>
      <h3 className="font-headline-lg mb-4">Production Logs</h3>
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-variant border-b-2 border-on-background">
          <tr>
            <th className="p-3 font-label-sm uppercase">Date</th>
            <th className="p-3 font-label-sm uppercase">Vendor</th>
            <th className="p-3 font-label-sm uppercase">Mould</th>
            <th className="p-3 font-label-sm uppercase">Accepted</th>
            <th className="p-3 font-label-sm uppercase">Rejected</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, index: number) => (
            <tr key={index} className="border-b border-on-background/20">
              <td className="p-3">{row.date}</td>
              <td className="p-3 font-bold">{row.vendor}</td>
              <td className="p-3">{row.mould}</td>
              <td className="p-3 text-success font-bold">{Number(row.accepted || 0).toLocaleString()}</td>
              <td className="p-3 text-danger font-bold">{Number(row.rejected || 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaterialsTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <EmptyState label="material" />;

  return (
    <div>
      <h3 className="font-headline-lg mb-4">Material Assignments</h3>
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-variant border-b-2 border-on-background">
          <tr>
            <th className="p-3 font-label-sm uppercase">Vendor</th>
            <th className="p-3 font-label-sm uppercase">Material</th>
            <th className="p-3 font-label-sm uppercase">Assigned Qty</th>
            <th className="p-3 font-label-sm uppercase">Consumed Qty</th>
            <th className="p-3 font-label-sm uppercase">Remaining Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, index: number) => (
            <tr key={index} className="border-b border-on-background/20">
              <td className="p-3 font-bold">{row.vendor}</td>
              <td className="p-3">{row.material}</td>
              <td className="p-3 font-data-md">{Number(row.assigned || 0).toLocaleString()} kg</td>
              <td className="p-3 font-data-md text-warning">{Number(row.consumed || 0).toLocaleString()} kg</td>
              <td className="p-3 font-data-md font-bold">{Number(row.remaining || 0).toLocaleString()} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MouldLifecycle({
  data,
  items,
  search,
  riskFilter,
  onSearch,
  onRiskFilter,
  onOpenMoulds,
}: {
  data: any;
  items: any[];
  search: string;
  riskFilter: RiskFilter;
  onSearch: (value: string) => void;
  onRiskFilter: (value: RiskFilter) => void;
  onOpenMoulds: () => void;
}) {
  const summary = data.summary || {};

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Total Moulds" value={summary.total || 0} />
        <MetricCard label="Healthy" value={summary.healthy || 0} tone="success" />
        <MetricCard label="Watch" value={summary.watch || 0} tone="warning" />
        <MetricCard label="Critical" value={summary.critical || 0} tone="danger" />
        <MetricCard label="Expired" value={summary.expired || 0} tone="danger" />
      </div>

      <div className="flex flex-col lg:flex-row gap-3 justify-between">
        <input
          value={search}
          onChange={event => onSearch(event.target.value)}
          placeholder="Search mould, part, or vendor"
          className="w-full lg:max-w-md bg-surface-container-low border-2 border-on-background px-4 py-3 font-body-md focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(riskLabels) as RiskFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => onRiskFilter(filter)}
              className={`border-2 border-on-background px-3 py-2 font-label-sm text-label-sm uppercase ${
                riskFilter === filter ? 'bg-primary-container text-on-primary-container neo-shadow-sm' : 'bg-surface'
              }`}
            >
              {riskLabels[filter]}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState label="mould lifecycle" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-variant border-b-2 border-on-background">
              <tr>
                <th className="p-3 font-label-sm uppercase">Mould</th>
                <th className="p-3 font-label-sm uppercase">Vendor</th>
                <th className="p-3 font-label-sm uppercase">State</th>
                <th className="p-3 font-label-sm uppercase">Life Used</th>
                <th className="p-3 font-label-sm uppercase">Remaining</th>
                <th className="p-3 font-label-sm uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((mould: any) => (
                <tr key={mould.id} className="border-b border-on-background/20">
                  <td className="p-3">
                    <div className="font-bold">{mould.code}</div>
                    <div className="text-sm text-on-surface-variant">{mould.name}</div>
                  </td>
                  <td className="p-3">{mould.vendor?.name || 'Unassigned'}</td>
                  <td className="p-3 uppercase font-label-sm text-label-sm">{mould.lifecycleState}</td>
                  <td className="p-3 min-w-56">
                    <div className="flex justify-between mb-1">
                      <span className={`font-bold ${mould.riskLevel === 'critical' || mould.riskLevel === 'expired' ? 'text-danger' : mould.riskLevel === 'watch' ? 'text-warning' : 'text-success'}`}>
                        {Math.round(mould.percentage || 0)}%
                      </span>
                      <span className="text-sm text-on-surface-variant">{Number(mould.accumulated || 0).toLocaleString()} / {Number(mould.limit || 0).toLocaleString()}</span>
                    </div>
                    <div className="w-full h-3 bg-surface border-2 border-on-background">
                      <div className={`h-full ${mould.riskLevel === 'critical' || mould.riskLevel === 'expired' ? 'bg-danger' : mould.riskLevel === 'watch' ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(100, Math.max(0, mould.percentage || 0))}%` }} />
                    </div>
                  </td>
                  <td className="p-3 font-data-md">{Number(mould.remainingShots || 0).toLocaleString()} shots</td>
                  <td className="p-3">
                    <button onClick={onOpenMoulds} className="border-2 border-on-background bg-surface px-3 py-2 font-label-sm text-label-sm uppercase neo-shadow-sm">
                      Open Mould Master
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DowntimeAnalysis({ data }: { data: any }) {
  const summary = data.summary || {};
  const maxDailyMinutes = Math.max(...(data.daily || []).map((row: any) => Number(row.minutes || 0)), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Hours" value={summary.totalHours || 0} tone="danger" />
        <MetricCard label="Incidents" value={summary.incidentCount || 0} />
        <MetricCard label="Avg Minutes" value={summary.averageMinutes || 0} tone="warning" />
        <MetricCard label="Total Minutes" value={summary.totalMinutes || 0} />
      </div>

      {(data.byReason || []).length === 0 ? (
        <EmptyState label="downtime" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="border-2 border-on-background p-4">
            <h3 className="font-headline-md text-headline-md mb-4">Reason Breakdown</h3>
            <div className="flex flex-col gap-4">
              {data.byReason.map((row: any) => (
                <div key={row.reason}>
                  <div className="flex justify-between font-label-sm text-label-sm uppercase mb-1">
                    <span>{row.label}</span>
                    <span>{minutesLabel(row.minutes)} / {row.percentage}%</span>
                  </div>
                  <div className="h-4 border-2 border-on-background bg-surface">
                    <div className="h-full bg-danger" style={{ width: `${row.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-2 border-on-background p-4">
            <h3 className="font-headline-md text-headline-md mb-4">Daily Trend</h3>
            <div className="h-64 flex items-end gap-2 border-2 border-on-background bg-surface-container-low p-4">
              {data.daily.map((row: any) => (
                <div key={row.date} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
                  <div className="w-full bg-warning border-2 border-on-background" style={{ height: `${Math.max(4, (Number(row.minutes || 0) / maxDailyMinutes) * 100)}%` }} />
                  <span className="text-[10px] font-label-sm text-on-surface-variant">{row.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>

          <RankedList title="Vendor Downtime" rows={data.byVendor || []} name={(row: any) => `${row.code} - ${row.name}`} />
          <RankedList title="Mould Downtime" rows={data.byMould || []} name={(row: any) => `${row.code} - ${row.name}`} />
        </div>
      )}
    </div>
  );
}

function RankedList({ title, rows, name }: { title: string; rows: any[]; name: (row: any) => string }) {
  return (
    <section className="border-2 border-on-background p-4">
      <h3 className="font-headline-md text-headline-md mb-4">{title}</h3>
      <div className="flex flex-col gap-3">
        {rows.slice(0, 8).map((row: any) => (
          <div key={row.id} className="flex justify-between border-b border-dashed border-on-background pb-2">
            <span className="font-bold">{name(row)}</span>
            <span className="font-data-md">{minutesLabel(row.minutes)} ({row.count})</span>
          </div>
        ))}
        {rows.length === 0 && <p className="font-body-md text-on-surface-variant">No downtime records.</p>}
      </div>
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone?: 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-on-background';

  return (
    <div className="border-2 border-on-background bg-surface-container-low p-4">
      <div className="font-label-sm text-label-sm uppercase text-on-surface-variant">{label}</div>
      <div className={`font-data-lg text-[32px] font-bold mt-2 ${toneClass}`}>{value}</div>
    </div>
  );
}
