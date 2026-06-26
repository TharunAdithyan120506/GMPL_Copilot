import { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/useAuth';

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const fetchMetrics = useCallback(async () => {
    if (user?.role !== 'company') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.get('/analytics/dashboard');
      setData(res.data?.data || null);
    } catch (err: any) {
      setData(null);
      const status = err.response?.status;
      const message = err.response?.data?.error?.message || 'Failed to fetch dashboard metrics.';
      setError(status === 401 ? 'Session expired. Please log in again to fetch dashboard metrics.' : message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (user?.role !== 'company') {
    return (
      <div className="p-margin font-body-lg text-center flex flex-col justify-center items-center h-[50vh]">
        <span className="material-symbols-outlined text-[64px] text-secondary mb-4">factory</span>
        <h2 className="font-headline-lg">Welcome to Vendor Portal</h2>
        <p className="text-secondary mt-2">Open My Moulds to inspect assigned moulds and log today's production.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-margin font-body-md">Loading Company Overview...</div>;
  }

  if (error) {
    return (
      <div className="p-margin flex flex-col gap-4">
        <div className="bg-error-container border-2 border-on-background neo-shadow p-6 max-w-2xl">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-danger">cloud_off</span>
            <div>
              <h2 className="font-headline-md text-headline-md text-danger">Dashboard Fetch Failed</h2>
              <p className="font-body-md text-body-md mt-2">{error}</p>
            </div>
          </div>
        </div>
        <button onClick={fetchMetrics} className="w-fit neo-btn-primary px-6 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Retry Fetch
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || { activeMoulds: 0, pendingEdits: 0, lowRmStock: 0, nearLimitMoulds: 0 };
  const vendorScores = data?.vendorScores || [];
  const downtime = data?.downtime || { totalHours: 0, machine: 0, mould: 0, manpower: 0, other: 0 };
  const productionSeries = data?.productionSeries || [];
  const previousWeekTotal = productionSeries.slice(0, 7).reduce((sum: number, point: any) => sum + Number(point.total || 0), 0);
  const currentWeekTotal = productionSeries.slice(7).reduce((sum: number, point: any) => sum + Number(point.total || 0), 0);
  const productionSeriesTotal = previousWeekTotal + currentWeekTotal;
  const productionDelta = currentWeekTotal - previousWeekTotal;
  const maxProduction = Math.max(...productionSeries.map((point: any) => Number(point.total || 0)), 1);
  const nearLimitPercent = kpis.activeMoulds > 0 ? Math.min(100, Math.round((kpis.nearLimitMoulds / kpis.activeMoulds) * 100)) : 0;
  const exportDashboard = () => {
    const rows = [
      ['date', 'accepted', 'rejected', 'total'],
      ...productionSeries.map((point: any) => [
        point.date,
        Number(point.accepted || 0),
        Number(point.rejected || 0),
        Number(point.total || 0),
      ]),
    ];
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-production-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-margin flex flex-col gap-margin relative overflow-y-auto">
      {/* Header Area */}
      <header className="hidden md:flex justify-between items-end mb-4 border-b-4 border-on-background pb-4">
        <div>
          <h2 className="font-display-lg text-[48px] font-bold leading-[1.1] text-on-background mb-2 tracking-[-0.02em]">Company Overview</h2>
          <p className="font-body-lg text-[18px] text-on-surface-variant">GMPL Copilot / Real-time Enterprise Metrics</p>
        </div>
        <button onClick={fetchMetrics} className="border-2 border-on-background px-4 py-3 flex items-center justify-center gap-2 bg-surface-container-low neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all font-label-sm text-label-sm uppercase">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-bento-gap">
        
        {/* KPI Tiles (Row 1) */}
        <div className="md:col-span-3 bg-surface-bright border-2 border-on-background neo-shadow p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Active Moulds</span>
            <span className="material-symbols-outlined text-primary fill-icon">precision_manufacturing</span>
          </div>
          <div className="font-data-lg text-[48px] leading-none text-on-background font-bold">{kpis.activeMoulds}</div>
          <div className={`mt-4 flex items-center gap-2 font-label-sm text-label-sm ${productionDelta >= 0 ? 'text-success' : 'text-danger'}`}>
            <span className="material-symbols-outlined text-[16px]">{productionDelta >= 0 ? 'trending_up' : 'trending_down'}</span>
            <span>{productionDelta >= 0 ? '+' : ''}{productionDelta.toLocaleString()} units vs prior week</span>
          </div>
        </div>
        
        <div className="md:col-span-3 bg-error-container border-2 border-on-background neo-shadow p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-sm text-label-sm uppercase text-danger">Low RM Stock Alerts</span>
            <span className="material-symbols-outlined text-danger fill-icon">warning</span>
          </div>
          <div className="font-data-lg text-[48px] leading-none text-danger font-bold">{kpis.lowRmStock}</div>
          <div className="mt-4">
            <span className="bg-danger text-on-error px-2 py-1 font-label-sm text-label-sm uppercase border border-on-background inline-block">Requires Action</span>
          </div>
        </div>
        
        <div className="md:col-span-3 bg-tertiary-fixed border-2 border-on-background neo-shadow p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-sm text-label-sm uppercase text-on-tertiary-container">Pending Edit Requests</span>
            <span className="material-symbols-outlined text-tertiary fill-icon">edit_document</span>
          </div>
          <div className="font-data-lg text-[48px] leading-none text-on-tertiary-container font-bold">{kpis.pendingEdits}</div>
          <div className="mt-4">
            <span className="bg-tertiary text-on-tertiary px-2 py-1 font-label-sm text-label-sm uppercase border border-on-background inline-block">Needs Review</span>
          </div>
        </div>
        
        <div className="md:col-span-3 bg-surface-container-low border-2 border-on-background neo-shadow p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Moulds Near Life Limit</span>
            <span className="material-symbols-outlined text-warning fill-icon">timer</span>
          </div>
          <div className="font-data-lg text-[48px] leading-none text-on-background font-bold">{kpis.nearLimitMoulds}</div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="w-full h-4 border-2 border-on-background bg-surface">
              <div className="h-full bg-warning border-r-2 border-on-background" style={{ width: `${nearLimitPercent}%` }}></div>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{nearLimitPercent}% of active moulds over 90% shot life</span>
          </div>
        </div>

        {/* Large Line Chart Area (Row 2, spanning 8 cols) */}
        <div className="md:col-span-8 bg-surface border-2 border-on-background neo-shadow min-h-[400px] flex flex-col p-6">
          <div className="flex justify-between items-center mb-6 border-b-2 border-on-background pb-4">
            <div>
              <h3 className="font-headline-md text-headline-md">Production Across All Vendors</h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-1">Last 14 days from submitted logs</p>
            </div>
            <button onClick={exportDashboard} className="border-2 border-on-background p-2 py-1 text-label-sm font-label-sm flex items-center gap-2 neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-surface-variant">
              Export <span className="material-symbols-outlined text-[16px]">download</span>
            </button>
          </div>
          
          <div className="flex-1 w-full relative bg-[#f8f3e9] border-2 border-on-background p-4 flex items-end">
            {productionSeriesTotal === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="bg-surface border-2 border-on-background px-4 py-3 font-label-sm text-label-sm uppercase neo-shadow-sm">
                  No submitted production logs in the last 14 days
                </div>
              </div>
            )}
            <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
              <div className="border-b-2 border-on-background w-full h-0"></div>
              <div className="border-b-2 border-on-background w-full h-0"></div>
              <div className="border-b-2 border-on-background w-full h-0"></div>
              <div className="border-b-2 border-on-background w-full h-0"></div>
            </div>
            <div className="w-full h-[80%] flex items-end justify-between gap-2 relative z-10 px-4">
              {productionSeries.map((point: any) => {
                const total = Number(point.total || 0);
                const rejected = Number(point.rejected || 0);
                const height = Math.max(4, Math.round((total / maxProduction) * 100));
                const rejectedRate = total > 0 ? rejected / total : 0;

                return (
                  <div key={point.date} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-2 group">
                    <div
                      className={`w-full max-w-10 border-2 border-on-background relative ${rejectedRate > 0.1 ? 'bg-danger' : total > 0 ? 'bg-primary-container' : 'bg-surface-dim'}`}
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-background text-surface font-data-md text-data-md px-2 hidden group-hover:block whitespace-nowrap z-20">
                        {total.toLocaleString()}
                      </div>
                    </div>
                    <span className="font-label-sm text-[10px] text-on-surface-variant">{point.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Downtime Mini-Chart & Vendor Snapshot (Row 2, spanning 4 cols) */}
        <div className="md:col-span-4 flex flex-col gap-bento-gap">
          {/* Downtime Breakdown (Text-based since radial SVG is complex) */}
          <div className="bg-surface border-2 border-on-background neo-shadow flex-1 flex flex-col p-6">
            <h3 className="font-headline-md text-[20px] mb-4 border-b-2 border-on-background pb-2">Downtime Breakdown</h3>
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="flex items-center justify-between font-body-md border-b border-dashed border-on-background pb-2">
                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-danger border border-on-background"></div> Machine</span>
                <span className="font-data-md font-bold text-danger">{downtime.machine}%</span>
              </div>
              <div className="flex items-center justify-between font-body-md border-b border-dashed border-on-background pb-2">
                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-warning border border-on-background"></div> Mould</span>
                <span className="font-data-md font-bold text-warning">{downtime.mould}%</span>
              </div>
              <div className="flex items-center justify-between font-body-md border-b border-dashed border-on-background pb-2">
                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-info border border-on-background"></div> Manpower</span>
                <span className="font-data-md font-bold text-info">{downtime.manpower}%</span>
              </div>
              <div className="flex items-center justify-between font-body-md">
                <span className="flex items-center gap-2"><div className="w-3 h-3 bg-secondary-fixed-dim border border-on-background"></div> Other</span>
                <span className="font-data-md font-bold">{downtime.other}%</span>
              </div>
            </div>
          </div>

          {/* Vendor Snapshot Strip */}
          <div className="bg-surface border-2 border-on-background neo-shadow flex flex-col p-0 overflow-hidden">
            <div className="p-4 border-b-2 border-on-background bg-surface-container-low">
              <h3 className="font-headline-md text-[18px]">Vendor Performance</h3>
            </div>
            
            {vendorScores.map((v: any, idx: number) => (
              <div key={idx} className={`p-4 ${idx === 0 ? 'border-b-2 border-on-background' : ''} flex justify-between items-center bg-surface hover:bg-surface-bright transition-colors cursor-pointer`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${v.status === 'top' ? 'bg-success' : 'bg-danger'} border-2 border-on-background flex items-center justify-center text-surface font-bold uppercase`}>
                    {v.name.charAt(v.name.indexOf(' ') + 1) || v.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-data-md text-data-md font-bold">{v.name}</div>
                    <div className={`font-label-sm text-[10px] uppercase ${v.status === 'top' ? 'text-on-surface-variant' : 'text-danger'}`}>
                      {v.status === 'top' ? 'Top Performer' : 'Needs Attention'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-data-lg text-[24px] font-bold ${v.status === 'top' ? 'text-success' : 'text-danger'}`}>{v.score}</div>
                  <div className="font-label-sm text-[10px] uppercase">Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
