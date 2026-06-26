import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export function Analytics() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'production' | 'materials' | 'moulds' | 'downtime'>('production');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'company') return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let endpoint = '/analytics/production';
        if (activeTab === 'materials') endpoint = '/analytics/raw-material';
        else if (activeTab === 'moulds') endpoint = '/analytics/mould-life';
        else if (activeTab === 'downtime') endpoint = '/analytics/dashboard'; // dashboard has downtime stats
        
        const res = await api.get(endpoint);
        setData(res.data?.data || null);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab, user]);

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
        <div className="flex gap-4">
          <button className="bg-surface border-2 border-on-background p-3 neo-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex gap-2 items-center uppercase font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[20px]">download</span> Export Report
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b-2 border-on-background overflow-x-auto hide-scrollbar">
        {[
          { id: 'production', label: 'Production Volume', icon: 'precision_manufacturing' },
          { id: 'materials', label: 'Material Usage', icon: 'inventory_2' },
          { id: 'moulds', label: 'Mould Lifecycle', icon: 'timer' },
          { id: 'downtime', label: 'Downtime Analysis', icon: 'warning' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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

      {/* Content Area */}
      <div className="flex-1 bg-surface border-2 border-on-background neo-shadow p-6 flex flex-col min-h-[400px]">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center font-body-md">Loading...</div>
        ) : activeTab === 'production' && data ? (
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
                {data.map((d: any, i: number) => (
                  <tr key={i} className="border-b border-on-background/20">
                    <td className="p-3">{d.date}</td>
                    <td className="p-3 font-bold">{d.vendor}</td>
                    <td className="p-3">{d.mould}</td>
                    <td className="p-3 text-success font-bold">{d.accepted}</td>
                    <td className="p-3 text-danger font-bold">{d.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'materials' && data ? (
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
                {data.map((d: any, i: number) => (
                  <tr key={i} className="border-b border-on-background/20">
                    <td className="p-3 font-bold">{d.vendor}</td>
                    <td className="p-3">{d.material}</td>
                    <td className="p-3 font-data-md">{d.assigned.toLocaleString()} kg</td>
                    <td className="p-3 font-data-md text-warning">{d.consumed.toLocaleString()} kg</td>
                    <td className="p-3 font-data-md font-bold">{d.remaining.toLocaleString()} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'moulds' && data ? (
          <div>
            <h3 className="font-headline-lg mb-4">Mould Shot Life Tracking</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.map((m: any, i: number) => (
                <div key={i} className="p-4 border-2 border-on-background bg-surface-container-low">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">{m.name}</span>
                    <span className="font-data-md">{Math.round(m.percentage)}%</span>
                  </div>
                  <div className="w-full h-3 bg-surface border-2 border-on-background overflow-hidden">
                    <div className={`h-full ${m.percentage > 90 ? 'bg-danger' : m.percentage > 70 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(100, m.percentage)}%` }}></div>
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-on-surface-variant">
                    <span>{m.accumulated.toLocaleString()} shots</span>
                    <span>{m.limit.toLocaleString()} max</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'downtime' && data ? (
          <div>
            <h3 className="font-headline-lg mb-4">Downtime Breakdown (Total: {data.downtime.totalHours} hrs)</h3>
            <div className="flex flex-col gap-4 max-w-md">
              <div className="flex justify-between items-center border-b-2 border-dashed border-on-background pb-2">
                <span className="font-bold text-danger">Machine Issue</span>
                <span className="font-data-md">{data.downtime.machine}%</span>
              </div>
              <div className="flex justify-between items-center border-b-2 border-dashed border-on-background pb-2">
                <span className="font-bold text-warning">Mould Issue</span>
                <span className="font-data-md">{data.downtime.mould}%</span>
              </div>
              <div className="flex justify-between items-center border-b-2 border-dashed border-on-background pb-2">
                <span className="font-bold text-info">Manpower Shortage</span>
                <span className="font-data-md">{data.downtime.manpower}%</span>
              </div>
              <div className="flex justify-between items-center border-b-2 border-dashed border-on-background pb-2">
                <span className="font-bold">Other</span>
                <span className="font-data-md">{data.downtime.other}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center w-full h-full flex flex-col items-center justify-center opacity-60">
            <span className="material-symbols-outlined text-[48px] text-secondary mb-4">analytics</span>
            <p className="font-body-md text-secondary">No data available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
