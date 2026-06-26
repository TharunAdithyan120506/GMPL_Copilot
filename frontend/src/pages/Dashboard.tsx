import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role !== 'company') {
      setLoading(false);
      return;
    }

    const fetchMetrics = async () => {
      try {
        const res = await api.get('/analytics/dashboard');
        if (res.data && res.data.data) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [user]);

  if (user?.role !== 'company') {
    return (
      <div className="p-margin font-body-lg text-center flex flex-col justify-center items-center h-[50vh]">
        <span className="material-symbols-outlined text-[64px] text-secondary mb-4">factory</span>
        <h2 className="font-headline-lg">Welcome to Vendor Portal</h2>
        <p className="text-secondary mt-2">Check 'My Assignments' to log today's production.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-margin font-body-md">Loading Company Overview...</div>;
  }

  const kpis = data?.kpis || { activeMoulds: 0, pendingEdits: 0, lowRmStock: 0, nearLimitMoulds: 0 };
  const vendorScores = data?.vendorScores || [];
  const downtime = data?.downtime || { totalHours: 0, machine: 0, mould: 0, manpower: 0, other: 0 };

  return (
    <div className="p-margin flex flex-col gap-margin relative overflow-y-auto">
      {/* Header Area */}
      <header className="hidden md:flex justify-between items-end mb-4 border-b-4 border-on-background pb-4">
        <div>
          <h2 className="font-display-lg text-[48px] font-bold leading-[1.1] text-on-background mb-2 tracking-[-0.02em]">Company Overview</h2>
          <p className="font-body-lg text-[18px] text-on-surface-variant">GMPL Copilot / Real-time Enterprise Metrics</p>
        </div>
        <div className="flex gap-4">
          <button className="border-2 border-on-background p-3 flex items-center justify-center bg-surface-container-low neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all">
            <span className="material-symbols-outlined">search</span>
          </button>
          <button className="border-2 border-on-background p-3 flex items-center justify-center bg-surface-container-low neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-3 h-3 bg-danger border-2 border-on-background rounded-full"></span>
          </button>
        </div>
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
          <div className="mt-4 flex items-center gap-2 text-success font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            <span>+4 this week</span>
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
              <div className="h-full bg-warning border-r-2 border-on-background" style={{ width: '92%' }}></div>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">&gt; 90% Shot Life</span>
          </div>
        </div>

        {/* Large Line Chart Area (Row 2, spanning 8 cols) */}
        <div className="md:col-span-8 bg-surface border-2 border-on-background neo-shadow min-h-[400px] flex flex-col p-6">
          <div className="flex justify-between items-center mb-6 border-b-2 border-on-background pb-4">
            <div>
              <h3 className="font-headline-md text-headline-md">Production Across All Vendors</h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-1">Last 30 Days (Units in 1000s)</p>
            </div>
            <button className="border-2 border-on-background p-2 py-1 text-label-sm font-label-sm flex items-center gap-2 neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-surface-variant">
              Export <span className="material-symbols-outlined text-[16px]">download</span>
            </button>
          </div>
          
          {/* SVG Chart Mockup for Industrial Vibe */}
          <div className="flex-1 w-full relative bg-[#f8f3e9] border-2 border-on-background p-4 flex items-end">
            <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
              <div className="border-b-2 border-on-background w-full h-0"></div>
              <div className="border-b-2 border-on-background w-full h-0"></div>
              <div className="border-b-2 border-on-background w-full h-0"></div>
              <div className="border-b-2 border-on-background w-full h-0"></div>
            </div>
            <div className="w-full h-[80%] flex items-end justify-between gap-1 relative z-10 px-4">
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[30%] relative group"></div>
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[45%] relative group"></div>
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[40%] relative group"></div>
              <div className="w-8 bg-primary-container border-2 border-on-background h-[60%] relative group shadow-[4px_0px_0px_#1A1A1A]"></div>
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[55%] relative group"></div>
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[70%] relative group"></div>
              <div className="w-8 bg-primary-container border-2 border-on-background h-[85%] relative group shadow-[4px_0px_0px_#1A1A1A]"></div>
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[65%] relative group"></div>
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[50%] relative group"></div>
              <div className="w-8 bg-danger border-2 border-on-background h-[20%] relative group">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface border-2 border-on-background rounded-full z-20 flex items-center justify-center">
                  <div className="w-1 h-1 bg-danger rounded-full"></div>
                </div>
              </div>
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[40%] relative group"></div>
              <div className="w-8 bg-surface-dim border-2 border-on-background h-[75%] relative group"></div>
              <div className="w-8 bg-primary-container border-2 border-on-background h-[90%] relative group shadow-[4px_0px_0px_#1A1A1A]">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-background text-surface font-data-md text-data-md px-2 hidden group-hover:block whitespace-nowrap z-20">90k</div>
              </div>
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
