import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/useAuth';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { MouldRepository } from '../repositories/mould.repository';
import { LogRepository } from '../repositories/log.repository';
import { db } from '../lib/db';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { SkeletonCard, FreshnessLabel } from '../components/Skeleton';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useNavigate, useLocation } from 'react-router-dom';

export function Dashboard() {
  const { user } = useAuth();
  const { isOnline } = useSyncStatus();
  const navigate = useNavigate();

  const { data: dashboardList, isFirstLoad, lastSyncedAt, refresh } = useLiveQuery(
    () => DashboardRepository.get().then(d => d ? [{ id: 'singleton', ...d }] : []),
    (force) => DashboardRepository.refresh(force),
    db.dashboard as any,
    'dashboard',
  );

  const data = dashboardList.length > 0 ? dashboardList[0] : null;

  // Vendor-side data
  const { data: moulds } = useLiveQuery<any>(
    () => MouldRepository.getAll() as any,
    (force) => MouldRepository.refresh(force),
    db.moulds as any,
    'moulds',
  );
  const { data: logs } = useLiveQuery<any>(
    () => LogRepository.getAll() as any,
    (force) => LogRepository.refresh(force),
    db.logs as any,
    'logs',
  );

  if (user?.role !== 'company') {
    return <VendorDashboard user={user} moulds={moulds as any[]} logs={logs as any[]} navigate={navigate} isOnline={isOnline} />;
  }

  // Only show full loading state on very first visit (no cache yet)
  if (isFirstLoad) {
    return (
      <div className="p-4 md:p-margin flex flex-col gap-margin relative overflow-y-auto">
        <header className="flex justify-between items-end mb-4 border-b-4 border-on-background pb-4">
          <div>
            <h2 className="font-display-lg text-[28px] md:text-[48px] font-bold leading-[1.1] text-on-background mb-2 tracking-[-0.02em]">Company Overview</h2>
            <p className="font-body-lg text-[16px] md:text-[18px] text-on-surface-variant">GMPL Copilot / Real-time Enterprise Metrics</p>
          </div>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-12 gap-bento-gap">
          <SkeletonCard className="col-span-1 md:col-span-3 h-40" />
          <SkeletonCard className="col-span-1 md:col-span-3 h-40" />
          <SkeletonCard className="col-span-1 md:col-span-3 h-40" />
          <SkeletonCard className="col-span-1 md:col-span-3 h-40" />
          <SkeletonCard className="col-span-2 md:col-span-8 h-[400px]" />
          <SkeletonCard className="col-span-2 md:col-span-4 h-[400px]" />
        </div>
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
    <div className="p-4 md:p-margin flex flex-col gap-margin relative overflow-y-auto">
      {/* Header Area */}
      <header className="flex justify-between items-end mb-4 border-b-4 border-on-background pb-4">
        <div>
          <h2 className="font-display-lg text-[28px] md:text-[48px] font-bold leading-[1.1] text-on-background mb-2 tracking-[-0.02em]">Company Overview</h2>
          <p className="font-body-lg text-[14px] md:text-[18px] text-on-surface-variant flex items-center gap-4 flex-wrap">
            GMPL Copilot / Real-time Enterprise Metrics
            <FreshnessLabel lastSyncedAt={lastSyncedAt} isOnline={isOnline} />
          </p>
        </div>
        <button onClick={() => refresh()} className="hidden md:flex border-2 border-on-background px-4 py-3 items-center justify-center gap-2 bg-surface-container-low neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all font-label-sm text-label-sm uppercase">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-2 md:grid-cols-12 gap-bento-gap">
        
        {/* KPI Tiles (Row 1) */}
        <div className="col-span-1 md:col-span-3 bg-surface-bright border-2 border-on-background neo-shadow p-4 md:p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Active Moulds</span>
            <span className="material-symbols-outlined text-primary fill-icon">precision_manufacturing</span>
          </div>
          <div className="font-data-lg text-[36px] md:text-[48px] leading-none text-on-background font-bold">{kpis.activeMoulds}</div>
          <div className={`mt-3 md:mt-4 flex items-center gap-2 font-label-sm text-label-sm ${productionDelta >= 0 ? 'text-success' : 'text-danger'}`}>
            <span className="material-symbols-outlined text-[16px]">{productionDelta >= 0 ? 'trending_up' : 'trending_down'}</span>
            <span className="text-[11px]">{productionDelta >= 0 ? '+' : ''}{productionDelta.toLocaleString()} vs prior week</span>
          </div>
        </div>
        
        <div className="col-span-1 md:col-span-3 bg-error-container border-2 border-on-background neo-shadow p-4 md:p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <span className="font-label-sm text-label-sm uppercase text-danger">Low RM Stock</span>
            <span className="material-symbols-outlined text-danger fill-icon">warning</span>
          </div>
          <div className="font-data-lg text-[36px] md:text-[48px] leading-none text-danger font-bold">{kpis.lowRmStock}</div>
          <div className="mt-3 md:mt-4">
            <span className="bg-danger text-on-error px-2 py-1 font-label-sm text-[11px] uppercase border border-on-background inline-block">Requires Action</span>
          </div>
        </div>
        
        {/* KPI 3 — Today's Output (company-meaningful: how much was produced today across all vendors) */}
        <div className="col-span-1 md:col-span-3 bg-surface-bright border-2 border-on-background neo-shadow p-4 md:p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Today's Output</span>
            <span className="material-symbols-outlined text-info fill-icon">today</span>
          </div>
          <div className="font-data-lg text-[36px] md:text-[48px] leading-none text-on-background font-bold">
            {productionSeries.length > 0 ? Number(productionSeries[productionSeries.length - 1]?.total || 0).toLocaleString() : '—'}
          </div>
          <div className={`mt-3 md:mt-4 flex items-center gap-2 font-label-sm text-label-sm ${productionDelta >= 0 ? 'text-success' : 'text-danger'}`}>
            <span className="material-symbols-outlined text-[16px]">{productionDelta >= 0 ? 'trending_up' : 'trending_down'}</span>
            <span className="text-[11px]">parts produced today</span>
          </div>
        </div>

        {/* KPI 4 — Top Vendor Score */}
        <div className="col-span-1 md:col-span-3 bg-surface-container-low border-2 border-on-background neo-shadow p-4 md:p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Top Vendor</span>
            <span className="material-symbols-outlined text-success fill-icon">workspace_premium</span>
          </div>
          {vendorScores.length > 0 ? (
            <>
              <div className="font-data-lg text-[36px] md:text-[48px] leading-none text-success font-bold">{vendorScores[0]?.score ?? '—'}</div>
              <div className="mt-3 md:mt-4 font-label-sm text-[11px] text-on-surface-variant truncate">{vendorScores[0]?.name || 'N/A'}</div>
            </>
          ) : (
            <div className="font-data-lg text-[36px] md:text-[48px] leading-none text-on-surface-variant font-bold">—</div>
          )}
        </div>

        {/* Large Line Chart Area (Row 2, spanning 8 cols) */}
        <div className="col-span-2 md:col-span-8 bg-surface border-2 border-on-background neo-shadow min-h-[300px] md:min-h-[400px] flex flex-col p-4 md:p-6">
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
        <div className="col-span-2 md:col-span-4 flex flex-col gap-bento-gap">
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
                  <div className={`w-10 h-10 ${v.status === 'top' ? 'bg-success' : v.status === 'steady' ? 'bg-info' : 'bg-danger'} border-2 border-on-background flex items-center justify-center text-surface font-bold uppercase`}>
                    {v.name.charAt(v.name.indexOf(' ') + 1) || v.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-data-md text-data-md font-bold">{v.name}</div>
                    <div className={`font-label-sm text-[10px] uppercase ${v.status === 'top' ? 'text-success' : v.status === 'steady' ? 'text-info' : 'text-danger'}`}>
                      {v.status === 'top' ? 'Top Performer' : v.status === 'steady' ? 'Steady' : 'Needs Attention'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-data-lg text-[24px] font-bold ${v.status === 'top' ? 'text-success' : v.status === 'steady' ? 'text-info' : 'text-danger'}`}>{v.score}</div>
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

// ─── Vendor Dashboard ────────────────────────────────────────────────

function VendorDashboard({
  user, moulds, logs, navigate, isOnline,
}: {
  user: any; moulds: any[]; logs: any[];
  navigate: (path: string, options?: any) => void; isOnline: boolean;
}) {
  const location = useLocation();
  const today = new Date().toISOString().split('T')[0];
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasInitializedTab = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');

  const myAssignments = useMemo(() => {
    return moulds.flatMap(m =>
      (m.assignments || [])
        .filter((a: any) => a.status === 'active' && (!user?.vendorId || a.vendorId === user.vendorId))
        .map((a: any) => ({ ...a, mould: m }))
    );
  }, [moulds, user]);

  const todayLogs = useMemo(() => logs.filter(l => (typeof l.logDate === 'string' ? l.logDate.split('T')[0] : String(l.logDate || '').split('T')[0]) === today), [logs, today]);
  const assignmentIdsLoggedToday = useMemo(() => new Set(todayLogs.map((l: any) => l.assignmentId)), [todayLogs]);
  
  const pendingToday = useMemo(() => myAssignments.filter(a => !assignmentIdsLoggedToday.has(a.id)), [myAssignments, assignmentIdsLoggedToday]);
  const completedToday = useMemo(() => myAssignments.filter(a => assignmentIdsLoggedToday.has(a.id)), [myAssignments, assignmentIdsLoggedToday]);
  const recentLogs = useMemo(() => [...logs].sort((a, b) => String(b.logDate || '').localeCompare(String(a.logDate || ''))).slice(0, 5), [logs]);

  // Set default tab once on mount or return
  useEffect(() => {
    if (hasInitializedTab.current) return;
    hasInitializedTab.current = true;

    if (location.state?.justLogged) {
      setActiveTab('completed');
    } else if (pendingToday.length > 0 && activeTab === 'all' && !searchQuery) {
      setActiveTab('pending');
    }
  }, [pendingToday.length, location.state, activeTab, searchQuery]);

  // Keyboard shortcut '/' or Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return myAssignments.filter(a => {
      const code = (a.mould?.code || '').toLowerCase();
      const name = (a.mould?.name || '').toLowerCase();
      const matchSearch = !q || code.includes(q) || name.includes(q);
      if (!matchSearch) return false;
      
      const isLoggedToday = assignmentIdsLoggedToday.has(a.id);
      if (activeTab === 'pending') return !isLoggedToday;
      if (activeTab === 'completed') return isLoggedToday;
      return true;
    });
  }, [myAssignments, searchQuery, activeTab, assignmentIdsLoggedToday]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const allDoneToday = myAssignments.length > 0 && pendingToday.length === 0;

  return (
    <div className="min-h-full bg-background pb-16">
      {/* Centered Hero Header */}
      <div className={`border-b-2 border-on-background ${allDoneToday ? 'bg-success/10' : 'bg-surface/60'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant mb-2">{greeting}</p>
            <h1 className="font-display-lg text-[32px] md:text-[42px] font-black text-on-background leading-tight tracking-[-0.02em]">
              {allDoneToday ? 'All Logged Today \u2714' : "Today's Work Overview"}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-surface px-3 py-1.5 border-2 border-on-background neo-shadow-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-success' : 'bg-warning'}`} />
              <span className="font-label-sm text-xs uppercase font-bold text-on-background">
                {isOnline ? 'Connected' : 'Offline Mode'}
              </span>
            </div>
            <div className="bg-surface px-3 py-1.5 border-2 border-on-background neo-shadow-sm">
              <span className="font-body-md text-xs font-bold text-on-surface-variant">
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Centered Grid Layout */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Search, Filters & Mould Cards */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Search Bar & Filter Pills Container */}
            <div className="bg-surface border-2 border-on-background neo-shadow p-5 flex flex-col gap-4">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[22px] pointer-events-none">
                  search
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search assigned moulds by code or name to log... (Press '/' to search)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-background border-2 border-on-background pl-11 pr-24 py-3 font-body-md text-sm text-on-background placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 bg-surface-container hover:bg-surface-dim px-2.5 py-1 text-xs font-bold uppercase border border-on-background text-on-background"
                  >
                    Clear
                  </button>
                ) : (
                  <span className="absolute right-3 hidden sm:inline-block bg-surface-container px-2 py-0.5 text-[10px] font-mono font-bold uppercase border border-on-background/40 text-on-surface-variant">
                    / key
                  </span>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-on-background/15">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 font-label-sm text-xs uppercase transition-all border-2 flex items-center gap-2 ${
                      activeTab === 'pending'
                        ? 'bg-warning text-on-background border-on-background font-black neo-shadow-sm'
                        : 'bg-background text-on-surface-variant border-transparent hover:border-on-background/40 font-bold'
                    }`}
                  >
                    <span>Need Logging</span>
                    <span className="bg-on-background text-surface text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                      {pendingToday.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-4 py-2 font-label-sm text-xs uppercase transition-all border-2 flex items-center gap-2 ${
                      activeTab === 'completed'
                        ? 'bg-success text-on-background border-on-background font-black neo-shadow-sm'
                        : 'bg-background text-on-surface-variant border-transparent hover:border-on-background/40 font-bold'
                    }`}
                  >
                    <span>Logged Today</span>
                    <span className="bg-on-background text-surface text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                      {completedToday.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 font-label-sm text-xs uppercase transition-all border-2 flex items-center gap-2 ${
                      activeTab === 'all'
                        ? 'bg-primary text-on-primary border-on-background font-black neo-shadow-sm'
                        : 'bg-background text-on-surface-variant border-transparent hover:border-on-background/40 font-bold'
                    }`}
                  >
                    <span>All Assigned</span>
                    <span className="bg-on-background/20 text-inherit text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                      {myAssignments.length}
                    </span>
                  </button>
                </div>
                {searchQuery && (
                  <span className="font-label-sm text-xs text-on-surface-variant italic">
                    Found {filteredAssignments.length} match{filteredAssignments.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Mould Assignment Cards List */}
            {filteredAssignments.length === 0 ? (
              <div className="bg-surface border-2 border-on-background neo-shadow p-12 flex flex-col items-center justify-center text-center gap-4">
                <span className="material-symbols-outlined text-[56px] text-on-surface-variant">search_off</span>
                <div>
                  <h3 className="font-headline-md font-bold text-on-background">
                    {searchQuery ? `No moulds match "${searchQuery}"` : 'No Moulds in this Tab'}
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant mt-1.5 max-w-sm">
                    {searchQuery
                      ? 'Check your spelling or search by part name or mould code.'
                      : activeTab === 'pending'
                      ? 'Awesome work! You have logged production for all assigned moulds today.'
                      : 'You do not have any moulds in this category yet.'}
                  </p>
                </div>
                {(searchQuery || activeTab !== 'all') && (
                  <button
                    onClick={() => { setSearchQuery(''); setActiveTab('all'); }}
                    className="mt-2 bg-on-background text-surface border-2 border-on-background px-5 py-2.5 font-label-sm text-xs uppercase font-bold neo-shadow hover:bg-on-background/90 transition-colors"
                  >
                    View All Assigned Moulds
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredAssignments.map(a => {
                  const health = getMouldHealth(a.mould);
                  const pct = a.mould?.shotLifeLimit > 0 ? Math.round((a.mould.shotCountAccumulated / a.mould.shotLifeLimit) * 100) : 0;
                  const isLoggedToday = assignmentIdsLoggedToday.has(a.id);
                  const logToday = todayLogs.find((l: any) => l.assignmentId === a.id);

                  return (
                    <div
                      key={a.id}
                      className={`bg-surface border-2 border-on-background neo-shadow overflow-hidden transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#1A1A1A] ${
                        isLoggedToday ? 'border-l-8 border-l-success' : 'border-l-8 border-l-warning'
                      }`}
                    >
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                        
                        {/* Mould Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                            <h3 className="font-data-md text-[18px] font-black text-on-background tracking-tight">
                              {a.mould?.code || a.mould?.name || 'Unknown Mould'}
                            </h3>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${
                              health.dotClass === 'bg-danger' ? 'border-danger text-danger bg-danger/10' :
                              health.dotClass === 'bg-warning' ? 'border-warning text-warning bg-warning/10' :
                              'border-success text-success bg-success/10'
                            }`}>
                              {health.dotClass === 'bg-danger' ? 'Critical Life' : health.dotClass === 'bg-warning' ? 'Watch Life' : 'Healthy'}
                            </span>
                            {isLoggedToday ? (
                              <span className="bg-success/15 text-success border border-success text-[10px] font-bold uppercase px-2 py-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">check_circle</span> Logged Today
                              </span>
                            ) : (
                              <span className="bg-warning/15 text-on-background border border-warning text-[10px] font-bold uppercase px-2 py-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">pending</span> Need Entry
                              </span>
                            )}
                          </div>

                          <p className="font-body-md text-sm text-on-surface-variant flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-on-background">{a.mould?.name || 'Mould'}</span>
                            <span>·</span>
                            <span>{a.mould?.cavityCount || 1} Cavities</span>
                            <span>·</span>
                            <span>{pct}% shot life run ({Number(a.mould?.shotCountAccumulated || 0).toLocaleString()} shots)</span>
                          </p>

                          {/* Life progress bar */}
                          <div className="mt-2.5 h-1.5 w-full max-w-[240px] bg-surface-dim border border-on-background/20 rounded-full overflow-hidden">
                            <div className={`h-full ${health.dotClass}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>

                          {logToday && (
                            <div className="mt-3 inline-flex items-center gap-3 bg-background px-3 py-1.5 border border-on-background/20 text-xs">
                              <span className="text-success font-bold">✓ {logToday.acceptedQty} Accepted</span>
                              <span className="text-on-surface-variant">·</span>
                              <span className="text-danger font-bold">✗ {logToday.rejectedQty} Rejected</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="shrink-0 flex sm:flex-col gap-2">
                          {isLoggedToday ? (
                            <div className="flex sm:flex-col items-stretch gap-2">
                              <div className="w-full sm:w-auto px-5 py-2.5 font-label-sm text-xs uppercase font-black bg-success/15 text-success border-2 border-success flex items-center justify-center gap-2 neo-shadow-sm select-none">
                                <span className="material-symbols-outlined text-[18px]">task_alt</span>
                                <span>Completed Today</span>
                              </div>
                              <button
                                onClick={() => navigate('/logs')}
                                className="w-full sm:w-auto px-4 py-2 font-label-sm text-[11px] uppercase font-bold bg-surface hover:bg-surface-container text-on-background border-2 border-on-background flex items-center justify-center gap-1.5 transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                                <span>View / Request Edit</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => navigate(`/logs/new?assignmentId=${a.id}`, { state: { from: '/', fromLabel: 'Home' } })}
                              className="w-full sm:w-auto px-6 py-3 font-label-sm text-xs uppercase font-black bg-primary text-on-primary border-2 border-on-background neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_#1A1A1A] transition-all flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit_note</span>
                              <span>Log Production Now</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Stats, Quick Actions & Recent Activity Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Stats Overview */}
            <div className="bg-surface border-2 border-on-background neo-shadow p-5 flex flex-col gap-4">
              <h2 className="font-headline-md text-base font-black text-on-background uppercase tracking-wider border-b border-on-background/15 pb-2.5">
                Today's Summary
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-background border border-on-background/30 p-3 flex flex-col justify-center">
                  <span className="font-label-sm text-[10px] uppercase text-on-surface-variant font-bold">Assigned</span>
                  <span className="font-data-lg text-2xl font-black text-on-background mt-1">{myAssignments.length}</span>
                </div>
                <div className="bg-success/10 border border-success/40 p-3 flex flex-col justify-center">
                  <span className="font-label-sm text-[10px] uppercase text-success font-bold">Logged</span>
                  <span className="font-data-lg text-2xl font-black text-success mt-1">{completedToday.length}</span>
                </div>
                <div className={`border p-3 flex flex-col justify-center ${pendingToday.length > 0 ? 'bg-warning/10 border-warning/40' : 'bg-background border-on-background/30'}`}>
                  <span className={`font-label-sm text-[10px] uppercase font-bold ${pendingToday.length > 0 ? 'text-on-background' : 'text-on-surface-variant'}`}>Pending</span>
                  <span className={`font-data-lg text-2xl font-black mt-1 ${pendingToday.length > 0 ? 'text-warning' : 'text-on-background'}`}>{pendingToday.length}</span>
                </div>
              </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/moulds')}
                className="bg-surface border-2 border-on-background neo-shadow p-4 flex flex-col items-start gap-2.5 hover:bg-surface-container-low transition-all text-left group"
              >
                <div className="w-10 h-10 bg-primary/15 border border-primary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[24px]">precision_manufacturing</span>
                </div>
                <div>
                  <p className="font-label-sm text-xs uppercase font-black text-on-background">My Moulds</p>
                  <p className="font-body-md text-[11px] text-on-surface-variant mt-0.5 leading-tight">Check health &amp; specs</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/edit-requests')}
                className="bg-surface border-2 border-on-background neo-shadow p-4 flex flex-col items-start gap-2.5 hover:bg-surface-container-low transition-all text-left group"
              >
                <div className="w-10 h-10 bg-secondary/15 border border-secondary flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[24px]">edit_document</span>
                </div>
                <div>
                  <p className="font-label-sm text-xs uppercase font-black text-on-background">My Requests</p>
                  <p className="font-body-md text-[11px] text-on-surface-variant mt-0.5 leading-tight">Correction status</p>
                </div>
              </button>
            </div>

            {/* Recent Logs Sidebar Widget */}
            <div className="bg-surface border-2 border-on-background neo-shadow p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-on-background/15 pb-2.5">
                <h2 className="font-headline-md text-base font-black text-on-background uppercase tracking-wider">
                  Recent Activity
                </h2>
                <button
                  onClick={() => navigate('/logs')}
                  className="font-label-sm text-xs uppercase text-primary hover:underline font-bold flex items-center gap-0.5"
                >
                  <span>All</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>

              {recentLogs.length === 0 ? (
                <p className="font-body-md text-xs text-on-surface-variant text-center py-6 italic">
                  No logs recorded yet.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-on-background/15">
                  {recentLogs.map((log: any) => (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-data-md text-xs font-bold text-on-background truncate">
                          {log.mould?.code || 'Mould'}
                        </p>
                        <p className="font-body-md text-[11px] text-on-surface-variant">
                          {new Date(log.logDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {log.acceptedQty} accepted
                        </p>
                      </div>
                      <span className={`shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 border ${
                        log.status === 'submitted' ? 'border-success text-success bg-success/10' :
                        log.status === 'corrected' ? 'border-info text-info bg-info/10' :
                        'border-on-background text-on-surface-variant'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

function getMouldHealth(mould: any) {
  if (!mould) return { dotClass: 'bg-secondary' };
  const pct = mould.shotLifeLimit > 0
    ? Math.round((mould.shotCountAccumulated / mould.shotLifeLimit) * 100)
    : 0;
  if (pct >= 90 || mould.lifecycleState === 'flagged_for_replacement') return { dotClass: 'bg-danger' };
  if (pct >= 75) return { dotClass: 'bg-warning' };
  return { dotClass: 'bg-success' };
}
