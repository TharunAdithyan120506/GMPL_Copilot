import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/useAuth';

export function Repairs() {
  const [repairs, setRepairs] = useState<any[]>([]);
  const [moulds, setMoulds] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ mouldId: '', issueDescription: '' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const isCompany = user?.role === 'company';

  const fetchRepairs = async () => {
    try {
      const res = await api.get('/repairs');
      if (res.data?.data) {
        setRepairs(res.data.data.map((r: any) => ({
          ...r,
          mouldCode: r.mould?.code || r.mouldId.substring(0,8),
          vendorName: 'Repair Center',
          days: Math.floor((new Date().getTime() - new Date(r.openedAt).getTime()) / (1000 * 3600 * 24)),
          issue: r.issueDescription
        })));
      }
    } catch (err) {
      console.error('Failed to fetch repairs', err);
    } finally {
    }
  };

  useEffect(() => {
    fetchRepairs();
    const fetchMoulds = async () => {
      try {
        const res = await api.get('/moulds');
        if (res.data?.data) setMoulds(res.data.data);
      } catch (err) {
        console.error('Failed to fetch moulds', err);
      }
    };
    fetchMoulds();
  }, []);

  const getStatusColumn = (status: string) => repairs.filter(r => r.status === status);

  const handleCreateRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/repairs', formData);
      setShowModal(false);
      setFormData({ mouldId: '', issueDescription: '' });
      await fetchRepairs();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create repair record.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/repairs/${id}/status`, { status });
      await fetchRepairs();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update repair status.');
    }
  };

  return (
    <div className="flex-grow p-margin flex flex-col gap-gutter min-w-0">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-gutter border-b-4 border-on-background border-dashed pb-4">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-background">Repair & Rework Board</h2>
          <p className="font-body-md text-body-md text-secondary mt-2">Manage mould maintenance lifecycle and vendor repairs.</p>
        </div>
        {isCompany && (
          <button onClick={() => setShowModal(true)} className="bg-deep-orange text-white border-2 border-on-background neo-shadow font-headline-md text-headline-md uppercase py-4 px-6 hover:bg-primary transition-colors flex items-center gap-3">
            <span className="material-symbols-outlined font-bold text-[28px]">build_circle</span>
            Move to Repair
          </button>
        )}
      </header>

      <div className="flex-grow flex gap-bento-gap overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
        
        {/* Column 1: Transit */}
        <section className="min-w-[320px] w-full max-w-[400px] flex flex-col gap-4 snap-center shrink-0">
          <header className="bg-surface border-2 border-on-background p-4 flex items-center justify-between bg-surface-container-low border-b-4 border-b-warning">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-warning">local_shipping</span>
              <h3 className="font-headline-md text-headline-md uppercase">Sent for Repair</h3>
            </div>
            <span className="bg-surface border-2 border-on-background font-data-md text-data-md px-2 py-1 rounded-full">{getStatusColumn('transit').length}</span>
          </header>
          <div className="flex flex-col gap-4 h-full overflow-y-auto">
            {getStatusColumn('transit').map(r => (
              <article key={r.id} className="bg-surface border-2 border-on-background neo-shadow p-gutter cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">Mould ID</span>
                    <p className="font-data-lg text-data-lg text-on-background">{r.mouldCode}</p>
                  </div>
                  <span className="material-symbols-outlined text-secondary">drag_indicator</span>
                </div>
                <div className="space-y-3 border-t-2 border-on-background pt-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]">location_on</span>
                    <span className="font-body-md text-body-md">Vendor: {r.vendorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-warning text-[18px]">schedule</span>
                    <span className="font-body-md text-body-md font-bold text-warning">{r.days} Days in Transit</span>
                  </div>
                  {isCompany && (
                    <button onClick={() => updateStatus(r.id, 'repair')} className="w-full mt-4 bg-info text-white border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-2 hover:neo-active">
                      Start Repair
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Column 2: Repair */}
        <section className="min-w-[320px] w-full max-w-[400px] flex flex-col gap-4 snap-center shrink-0">
          <header className="bg-surface border-2 border-on-background p-4 flex items-center justify-between bg-surface-container-low border-b-4 border-b-info">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-info">build</span>
              <h3 className="font-headline-md text-headline-md uppercase">Under Repair</h3>
            </div>
            <span className="bg-surface border-2 border-on-background font-data-md text-data-md px-2 py-1 rounded-full">{getStatusColumn('repair').length}</span>
          </header>
          <div className="flex flex-col gap-4 h-full overflow-y-auto">
            {getStatusColumn('repair').map(r => (
              <article key={r.id} className="bg-surface border-2 border-on-background neo-shadow p-gutter border-info cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">Mould ID</span>
                    <p className="font-data-lg text-data-lg text-on-background">{r.mouldCode}</p>
                  </div>
                  {r.critical && <span className="bg-info text-white border-2 border-on-background px-2 py-1 font-label-sm text-label-sm uppercase rounded-sm">Critical</span>}
                </div>
                <div className="space-y-3 border-t-2 border-on-background pt-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]">location_on</span>
                    <span className="font-body-md text-body-md">Vendor: {r.vendorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-danger text-[18px]">schedule</span>
                    <span className="font-body-md text-body-md font-bold text-danger">{r.days} Days in Repair</span>
                  </div>
                  <div className="mt-4 pt-2 border-t border-dashed border-on-background">
                    <span className="font-label-sm text-label-sm text-secondary uppercase block mb-1">Issue:</span>
                    <p className="font-data-md text-data-md text-on-background line-clamp-2">{r.issue}</p>
                  </div>
                  {isCompany && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button onClick={() => updateStatus(r.id, 'ready')} className="bg-success text-on-primary border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-2 hover:neo-active">
                        Mark Ready
                      </button>
                      <button onClick={() => updateStatus(r.id, 'scrapped')} className="bg-surface text-danger border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-2 hover:neo-active">
                        Scrap
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Column 3: Ready */}
        <section className="min-w-[320px] w-full max-w-[400px] flex flex-col gap-4 snap-center shrink-0">
          <header className="bg-surface border-2 border-on-background p-4 flex items-center justify-between bg-surface-container-low border-b-4 border-b-success">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-success">check_circle</span>
              <h3 className="font-headline-md text-headline-md uppercase">Repaired</h3>
            </div>
            <span className="bg-surface border-2 border-on-background font-data-md text-data-md px-2 py-1 rounded-full">{getStatusColumn('ready').length}</span>
          </header>
          <div className="flex flex-col gap-4 h-full overflow-y-auto">
            {getStatusColumn('ready').map(r => (
              <article key={r.id} className="bg-surface border-2 border-on-background neo-shadow p-gutter border-success cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">Mould ID</span>
                    <p className="font-data-lg text-data-lg text-on-background">{r.mouldCode}</p>
                  </div>
                  <span className="material-symbols-outlined fill-icon text-success">verified</span>
                </div>
                <div className="space-y-3 border-t-2 border-on-background pt-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px]">location_on</span>
                    <span className="font-body-md text-body-md">Vendor: {r.vendorName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-success text-[18px]">task_alt</span>
                    <span className="font-body-md text-body-md font-bold text-success">Ready for Pickup</span>
                  </div>
                  {isCompany && (
                    <button onClick={() => updateStatus(r.id, 'repair')} className="w-full mt-4 bg-surface text-on-background border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-2 hover:bg-surface-variant transition-colors">
                      Reopen Repair
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Column 4: Scrapped */}
        <section className="min-w-[320px] w-full max-w-[400px] flex flex-col gap-4 snap-center shrink-0">
          <header className="bg-surface border-2 border-on-background p-4 flex items-center justify-between bg-surface-container-lowest border-b-4 border-b-secondary opacity-80">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-secondary">delete_forever</span>
              <h3 className="font-headline-md text-headline-md uppercase text-secondary">Scrapped</h3>
            </div>
            <span className="bg-surface border-2 border-on-background font-data-md text-data-md px-2 py-1 rounded-full text-secondary">{getStatusColumn('scrapped').length}</span>
          </header>
          <div className="flex flex-col gap-4 h-full overflow-y-auto">
            {getStatusColumn('scrapped').map(r => (
              <article key={r.id} className="bg-surface border-2 border-on-background p-gutter opacity-60 grayscale cursor-not-allowed border-dashed">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">Mould ID</span>
                    <p className="font-data-lg text-data-lg text-secondary line-through">{r.mouldCode}</p>
                  </div>
                </div>
                <div className="space-y-3 border-t-2 border-secondary pt-4">
                  <div className="flex items-center gap-2">
                    <span className="font-label-sm text-label-sm text-secondary uppercase">Status:</span>
                    <span className="font-body-md text-body-md font-bold text-secondary">{r.issue}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border-4 border-on-background shadow-[8px_8px_0px_#1A1A1A] w-full max-w-xl p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-on-background bg-error-container text-danger hover:bg-danger hover:text-on-error transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <h2 className="font-display-lg text-[24px] uppercase border-b-2 border-on-background pb-2 mb-6">Move Mould to Repair</h2>
            <form onSubmit={handleCreateRepair} className="flex flex-col gap-4">
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Mould</label>
                <select
                  required
                  value={formData.mouldId}
                  onChange={e => setFormData(p => ({ ...p, mouldId: e.target.value }))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none"
                >
                  <option value="">Select a mould...</option>
                  {moulds.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Issue Description</label>
                <textarea
                  required
                  value={formData.issueDescription}
                  onChange={e => setFormData(p => ({ ...p, issueDescription: e.target.value }))}
                  className="w-full min-h-28 bg-surface-container-low border-2 border-on-background p-3 focus:outline-none"
                />
              </div>
              <button disabled={saving} type="submit" className="mt-4 bg-primary text-on-primary border-2 border-on-background p-3 uppercase font-bold neo-shadow-sm hover:neo-active disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Repair Record'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
