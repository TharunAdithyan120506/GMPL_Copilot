import { useState, useEffect } from 'react';
import api from '../utils/api';

interface Mould {
  id: string;
  code: string | null;
  name: string;
  cavityCount: number;
  shotLifeLimit: number;
  shotCountAccumulated: number;
  lifecycleState: string;
}

export function Moulds() {
  const [moulds, setMoulds] = useState<Mould[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '', name: '', cavityCount: 1, partWeightG: '', runnerWeightG: '', shotLifeLimit: ''
  });

  const fetchMoulds = async () => {
    try {
      const res = await api.get('/moulds');
      if (res.data && res.data.data) {
        setMoulds(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch moulds:', error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchMoulds();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        cavityCount: Number(formData.cavityCount),
        partWeightG: Number(formData.partWeightG),
        runnerWeightG: Number(formData.runnerWeightG),
        shotLifeLimit: Number(formData.shotLifeLimit)
      };
      await api.post('/moulds', payload);
      setShowModal(false);
      setFormData({ code: '', name: '', cavityCount: 1, partWeightG: '', runnerWeightG: '', shotLifeLimit: '' });
      fetchMoulds();
    } catch (err) {
      console.error('Failed to create mould:', err);
      alert('Error creating mould.');
    }
  };

  const filteredMoulds = moulds.filter(m => 
    (m.code?.toLowerCase().includes(search.toLowerCase()) || '') || 
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 w-full p-margin flex flex-col gap-gutter">
      {/* Header Actions */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-4 border-b-4 border-on-background border-dashed">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-background leading-none">Mould Master</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Manage production assets and lifecycle tracking.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch">
          {/* Search */}
          <div className="relative flex-1 sm:w-80 group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-on-background">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input 
              className="w-full bg-surface py-3 pl-10 pr-4 font-body-md text-body-md placeholder:text-on-surface-variant border-2 border-on-background neo-shadow-sm focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[2px_2px_0px_#1A1A1A] transition-all rounded-none" 
              placeholder="Search ID, Name..." 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Primary CTA */}
          <button onClick={() => setShowModal(true)} className="bg-primary-container text-on-primary-container border-2 border-on-background neo-shadow px-6 py-3 font-label-sm text-label-sm uppercase tracking-wider hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all flex items-center justify-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined fill-icon text-[18px]">add_box</span>
            Add New Mould
          </button>
        </div>
      </header>

      {/* Filter Chips (Neobrutalist styling) */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-margin px-margin md:mx-0 md:px-0 hide-scrollbar">
        <button className="shrink-0 bg-on-background text-surface border-2 border-on-background px-4 py-2 font-label-sm text-label-sm uppercase neo-shadow-sm translate-x-[-2px] translate-y-[-2px]">
          All Moulds ({moulds.length})
        </button>
        <button className="shrink-0 bg-surface text-on-background border-2 border-on-background px-4 py-2 font-label-sm text-label-sm uppercase hover:bg-surface-variant hover:shadow-[4px_4px_0px_#1A1A1A] hover:-translate-y-1 transition-all">
          Active
        </button>
        <button className="shrink-0 bg-surface text-on-background border-2 border-on-background px-4 py-2 font-label-sm text-label-sm uppercase hover:bg-surface-variant hover:shadow-[4px_4px_0px_#1A1A1A] hover:-translate-y-1 transition-all">
          Idle
        </button>
        <button className="shrink-0 bg-surface text-on-background border-2 border-on-background px-4 py-2 font-label-sm text-label-sm uppercase hover:bg-danger hover:text-on-error hover:shadow-[4px_4px_0px_#1A1A1A] hover:-translate-y-1 transition-all flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-danger border border-on-background block group-hover:bg-on-error"></span>
          Repair
        </button>
      </div>

      {/* Bento Grid Table Container */}
      <div className="bg-surface border-2 border-on-background neo-shadow flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-surface-variant border-b-2 border-on-background">
              <tr>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-48">Mould ID / Name</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Status</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-64">Shot Count Progress</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-16 text-center">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-on-background">
              {loading ? (
                <tr><td colSpan={4} className="p-4 text-center font-body-md">Loading moulds...</td></tr>
              ) : filteredMoulds.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center font-body-md">No moulds found.</td></tr>
              ) : (
                filteredMoulds.map(mould => {
                  const progressPct = mould.shotLifeLimit > 0 
                    ? Math.min(100, Math.round((mould.shotCountAccumulated / mould.shotLifeLimit) * 100))
                    : 0;
                  
                  const isWarning = progressPct > 90;
                  
                  let statusBg = 'bg-surface-variant';
                  let statusIcon = 'pause_circle';
                  if (mould.lifecycleState === 'active') {
                    statusBg = 'bg-success';
                    statusIcon = 'check_circle';
                  } else if (mould.lifecycleState === 'in_repair' || mould.lifecycleState === 'flagged_for_replacement') {
                    statusBg = 'bg-danger text-on-error';
                    statusIcon = 'build';
                  }

                  return (
                    <tr key={mould.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="p-4">
                        <div className="font-data-md text-data-md text-on-background">{mould.code || mould.id.substring(0, 8)}</div>
                        <div className="font-body-md text-body-md text-on-surface-variant truncate w-40" title={mould.name}>{mould.name}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 ${statusBg} ${statusBg.includes('text-') ? '' : 'text-on-background'} border-2 border-on-background px-2 py-1 font-label-sm text-label-sm uppercase`}>
                          <span className="material-symbols-outlined text-[14px]">{statusIcon}</span>
                          {mould.lifecycleState?.replace(/_/g, ' ') || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className={`flex justify-between font-data-md text-data-md text-sm ${isWarning ? 'text-danger font-bold' : ''}`}>
                            <span>{mould.shotCountAccumulated.toLocaleString()}</span>
                            <span className="text-on-surface-variant font-normal">{mould.shotLifeLimit.toLocaleString()}</span>
                          </div>
                          <div className="h-3 w-full border-2 border-on-background bg-surface-variant overflow-hidden">
                            <div className={`h-full ${isWarning ? 'bg-warning' : 'bg-success'} border-r-2 border-on-background`} style={{ width: `${progressPct}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button className="p-2 border-2 border-transparent group-hover:border-on-background group-hover:shadow-[2px_2px_0px_#1A1A1A] group-hover:bg-surface transition-all">
                          <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Table Footer */}
        <div className="bg-surface-variant border-t-2 border-on-background p-4 flex justify-between items-center">
          <span className="font-body-md text-body-md text-on-surface-variant">Showing {moulds.length} entries</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border-2 border-on-background bg-surface neo-shadow-sm font-label-sm text-label-sm opacity-50 cursor-not-allowed">PREV</button>
            <button className="px-3 py-1 border-2 border-on-background bg-surface neo-shadow-sm font-label-sm text-label-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#1A1A1A] transition-all">NEXT</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border-4 border-on-background shadow-[8px_8px_0px_#1A1A1A] w-full max-w-2xl p-6 relative my-auto">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-on-background bg-error-container text-danger hover:bg-danger hover:text-on-error transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <h2 className="font-display-lg text-[24px] uppercase border-b-2 border-on-background pb-2 mb-6">New Mould Master</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="font-label-sm uppercase text-secondary block mb-1">Mould Code</label>
                <input required type="text" value={formData.code} onChange={e => setFormData(p => ({...p, code: e.target.value}))} className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="font-label-sm uppercase text-secondary block mb-1">Mould Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="font-label-sm uppercase text-secondary block mb-1">Cavity Count</label>
                <input required type="number" min="1" value={formData.cavityCount} onChange={e => setFormData(p => ({...p, cavityCount: Number(e.target.value)}))} className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="font-label-sm uppercase text-secondary block mb-1">Shot Life Limit</label>
                <input required type="number" min="1" value={formData.shotLifeLimit} onChange={e => setFormData(p => ({...p, shotLifeLimit: e.target.value}))} className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="font-label-sm uppercase text-secondary block mb-1">Part Weight (g)</label>
                <input required type="number" step="0.01" value={formData.partWeightG} onChange={e => setFormData(p => ({...p, partWeightG: e.target.value}))} className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="font-label-sm uppercase text-secondary block mb-1">Runner Weight (g)</label>
                <input required type="number" step="0.01" value={formData.runnerWeightG} onChange={e => setFormData(p => ({...p, runnerWeightG: e.target.value}))} className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none" />
              </div>
              <div className="col-span-2 mt-4 border-t-2 border-on-background pt-4 flex justify-end">
                <button type="submit" className="bg-primary text-on-primary border-2 border-on-background px-8 py-3 uppercase font-bold neo-shadow-sm hover:neo-active">
                  Create Mould
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
