import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/useAuth';
import { useToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function Repairs() {
  const [repairs, setRepairs] = useState<any[]>([]);
  const [moulds, setMoulds] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ mouldId: '', issueDescription: '' });
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<'transit' | 'repair' | 'ready' | 'scrapped'>('transit');
  const [confirmScrap, setConfirmScrap] = useState<{ open: boolean; id: string; mouldCode: string }>({ open: false, id: '', mouldCode: '' });

  const { user } = useAuth();
  const isCompany = user?.role === 'company';
  const { toast } = useToast();

  const fetchRepairs = async () => {
    try {
      const res = await api.get('/repairs');
      if (res.data?.data) {
        setRepairs(res.data.data.map((r: any) => ({
          ...r,
          mouldCode: r.mould?.code || r.mouldId.substring(0, 8),
          vendorName: r.vendor?.name || 'Repair Center',
          days: Math.floor((new Date().getTime() - new Date(r.openedAt).getTime()) / (1000 * 3600 * 24)),
          issue: r.issueDescription
        })));
      }
    } catch (err) {
      console.error('Failed to fetch repairs', err);
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

  // ESC key: close the Move to Repair modal
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showModal]);

  const getStatusColumn = (status: string) => repairs.filter(r => r.status === status);

  const handleCreateRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/repairs', formData);
      setShowModal(false);
      setFormData({ mouldId: '', issueDescription: '' });
      await fetchRepairs();
      toast.success('Repair record created successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create repair record.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/repairs/${id}/status`, { status });
      await fetchRepairs();
      const labels: Record<string, string> = {
        repair: 'moved to Under Repair',
        ready: 'marked as Repaired & Ready',
        scrapped: 'scrapped permanently',
        transit: 'reopened to Transit'
      };
      toast.success(`Mould repair ${labels[status] || status}.`);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update repair status.');
    }
  };

  const promptScrap = (id: string, mouldCode: string) => {
    setConfirmScrap({ open: true, id, mouldCode });
  };

  const executeScrap = async () => {
    const { id } = confirmScrap;
    setConfirmScrap({ open: false, id: '', mouldCode: '' });
    await updateStatus(id, 'scrapped');
  };

  const renderCard = (r: any, column: string) => (
    <article key={r.id} className={`bg-surface border-2 border-on-background neo-shadow-sm p-4 transition-all ${column === 'scrapped' ? 'opacity-60 grayscale border-dashed' : 'hover:-translate-y-0.5'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">Mould Code</span>
          <p className="font-data-lg text-data-lg font-bold text-on-background">{r.mouldCode}</p>
        </div>
        {column === 'repair' && r.critical && (
          <span className="bg-danger text-on-error border border-on-background px-2 py-0.5 font-label-sm text-[11px] uppercase rounded-sm">Critical</span>
        )}
        {column === 'ready' && <span className="material-symbols-outlined fill-icon text-success">verified</span>}
      </div>

      <div className="space-y-2 border-t-2 border-on-background pt-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[16px]">location_on</span>
          <span className="font-body-md text-body-md truncate">Center: {r.vendorName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-warning text-[16px]">schedule</span>
          <span className={`font-body-md text-body-md font-bold ${column === 'repair' ? 'text-danger' : column === 'ready' ? 'text-success' : 'text-warning'}`}>
            {r.days} {r.days === 1 ? 'Day' : 'Days'} {column === 'transit' ? 'in Transit' : column === 'repair' ? 'in Repair' : column === 'ready' ? 'Ready' : 'Scrapped'}
          </span>
        </div>
        {r.issue && (
          <div className="mt-2 pt-2 border-t border-dashed border-on-background">
            <span className="font-label-sm text-label-sm text-secondary uppercase block mb-0.5">Issue:</span>
            <p className="font-body-md text-body-md text-on-background line-clamp-2">{r.issue}</p>
          </div>
        )}

        {isCompany && column === 'transit' && (
          <button onClick={() => updateStatus(r.id, 'repair')} className="w-full mt-3 bg-info text-on-primary border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-2 hover:neo-active">
            Start Repair
          </button>
        )}

        {isCompany && column === 'repair' && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => updateStatus(r.id, 'ready')} className="bg-success text-on-primary border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-2 hover:neo-active">
              Mark Ready
            </button>
            <button onClick={() => promptScrap(r.id, r.mouldCode)} className="bg-surface text-danger border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-2 hover:bg-error-container/20">
              Scrap
            </button>
          </div>
        )}

        {isCompany && column === 'ready' && (
          <button onClick={() => updateStatus(r.id, 'repair')} className="w-full mt-3 bg-surface text-on-background border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-2 hover:bg-surface-variant transition-colors">
            Reopen Repair
          </button>
        )}
      </div>
    </article>
  );

  return (
    <div className="flex-1 w-full p-4 md:p-6 flex flex-col gap-6 min-w-0">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-4 border-on-background border-dashed pb-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-background leading-none">Repair & Rework Board</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Manage mould maintenance lifecycle and vendor repairs.</p>
        </div>
        {isCompany && (
          <button onClick={() => setShowModal(true)} className="bg-deep-orange text-white border-2 border-on-background neo-shadow font-label-sm text-label-sm uppercase py-3 px-5 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined font-bold text-[20px]">build_circle</span>
            Move to Repair
          </button>
        )}
      </header>

      {/* Mobile Tabs */}
      <div className="flex md:hidden border-2 border-on-background neo-shadow-sm bg-surface overflow-hidden">
        {[
          { id: 'transit', label: 'Transit', count: getStatusColumn('transit').length, color: 'text-warning' },
          { id: 'repair', label: 'Repair', count: getStatusColumn('repair').length, color: 'text-info' },
          { id: 'ready', label: 'Ready', count: getStatusColumn('ready').length, color: 'text-success' },
          { id: 'scrapped', label: 'Scrapped', count: getStatusColumn('scrapped').length, color: 'text-secondary' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id as any)}
            className={`flex-1 py-2.5 px-2 text-center font-label-sm text-[11px] uppercase tracking-wider flex flex-col items-center justify-center transition-colors border-r border-on-background last:border-r-0 ${mobileTab === tab.id ? 'bg-primary-container font-bold text-on-primary-container' : 'text-on-surface-variant bg-surface'}`}
          >
            <span>{tab.label}</span>
            <span className={`text-[12px] font-bold ${tab.color}`}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Mobile Column View */}
      <div className="flex flex-col gap-3 md:hidden">
        {getStatusColumn(mobileTab).length === 0 ? (
          <div className="bg-surface border-2 border-on-background p-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] mb-2 block">build_circle</span>
            <p className="font-body-md">No moulds currently in {mobileTab}.</p>
          </div>
        ) : (
          getStatusColumn(mobileTab).map(r => renderCard(r, mobileTab))
        )}
      </div>

      {/* Desktop Kanban Columns */}
      <div className="hidden md:flex flex-1 gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
        {/* Column 1: Transit */}
        <section className="min-w-[300px] flex-1 max-w-[380px] flex flex-col gap-3 snap-center shrink-0">
          <header className="bg-surface border-2 border-on-background p-3.5 flex items-center justify-between bg-surface-container-low border-b-4 border-b-warning">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-warning">local_shipping</span>
              <h3 className="font-headline-md text-headline-md uppercase">Sent for Repair</h3>
            </div>
            <span className="bg-surface border-2 border-on-background font-data-md text-data-md px-2.5 py-0.5 rounded-full">{getStatusColumn('transit').length}</span>
          </header>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            {getStatusColumn('transit').map(r => renderCard(r, 'transit'))}
            {getStatusColumn('transit').length === 0 && (
              <div className="border-2 border-dashed border-on-background/30 p-8 text-center text-on-surface-variant font-body-md text-sm">No items in transit</div>
            )}
          </div>
        </section>

        {/* Column 2: Repair */}
        <section className="min-w-[300px] flex-1 max-w-[380px] flex flex-col gap-3 snap-center shrink-0">
          <header className="bg-surface border-2 border-on-background p-3.5 flex items-center justify-between bg-surface-container-low border-b-4 border-b-info">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-info">build</span>
              <h3 className="font-headline-md text-headline-md uppercase">Under Repair</h3>
            </div>
            <span className="bg-surface border-2 border-on-background font-data-md text-data-md px-2.5 py-0.5 rounded-full">{getStatusColumn('repair').length}</span>
          </header>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            {getStatusColumn('repair').map(r => renderCard(r, 'repair'))}
            {getStatusColumn('repair').length === 0 && (
              <div className="border-2 border-dashed border-on-background/30 p-8 text-center text-on-surface-variant font-body-md text-sm">No items under repair</div>
            )}
          </div>
        </section>

        {/* Column 3: Ready */}
        <section className="min-w-[300px] flex-1 max-w-[380px] flex flex-col gap-3 snap-center shrink-0">
          <header className="bg-surface border-2 border-on-background p-3.5 flex items-center justify-between bg-surface-container-low border-b-4 border-b-success">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-success">check_circle</span>
              <h3 className="font-headline-md text-headline-md uppercase">Repaired</h3>
            </div>
            <span className="bg-surface border-2 border-on-background font-data-md text-data-md px-2.5 py-0.5 rounded-full">{getStatusColumn('ready').length}</span>
          </header>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            {getStatusColumn('ready').map(r => renderCard(r, 'ready'))}
            {getStatusColumn('ready').length === 0 && (
              <div className="border-2 border-dashed border-on-background/30 p-8 text-center text-on-surface-variant font-body-md text-sm">No items ready</div>
            )}
          </div>
        </section>

        {/* Column 4: Scrapped */}
        <section className="min-w-[300px] flex-1 max-w-[380px] flex flex-col gap-3 snap-center shrink-0">
          <header className="bg-surface border-2 border-on-background p-3.5 flex items-center justify-between bg-surface-container-lowest border-b-4 border-b-secondary opacity-80">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-secondary">delete_forever</span>
              <h3 className="font-headline-md text-headline-md uppercase text-secondary">Scrapped</h3>
            </div>
            <span className="bg-surface border-2 border-on-background font-data-md text-data-md px-2.5 py-0.5 rounded-full text-secondary">{getStatusColumn('scrapped').length}</span>
          </header>
          <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
            {getStatusColumn('scrapped').map(r => renderCard(r, 'scrapped'))}
            {getStatusColumn('scrapped').length === 0 && (
              <div className="border-2 border-dashed border-on-background/30 p-8 text-center text-on-surface-variant font-body-md text-sm">No items scrapped</div>
            )}
          </div>
        </section>
      </div>

      {/* Move to repair modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-on-background/60 backdrop-blur-sm">
          <div className="bg-surface border-4 border-on-background shadow-[8px_8px_0px_#1A1A1A] w-full sm:max-w-xl p-6 relative max-h-[95vh] overflow-y-auto">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-on-background bg-error-container text-danger hover:bg-danger hover:text-on-error transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <h2 className="font-display-lg text-[24px] uppercase border-b-2 border-on-background pb-2 mb-6">Move Mould to Repair</h2>
            <form onSubmit={handleCreateRepair} className="flex flex-col gap-4">
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Mould <span className="text-danger">*</span></label>
                <select
                  required
                  value={formData.mouldId}
                  onChange={e => setFormData(p => ({ ...p, mouldId: e.target.value }))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none"
                >
                  <option value="">Select a mould...</option>
                  {moulds.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Issue Description <span className="text-danger">*</span></label>
                <textarea
                  required
                  value={formData.issueDescription}
                  onChange={e => setFormData(p => ({ ...p, issueDescription: e.target.value }))}
                  placeholder="Describe the defect or required maintenance..."
                  className="w-full min-h-28 bg-surface-container-low border-2 border-on-background p-3 focus:outline-none resize-none"
                />
              </div>
              <button disabled={saving} type="submit" className="mt-4 bg-primary text-on-primary border-2 border-on-background p-3 uppercase font-bold neo-shadow-sm hover:neo-active disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Creating...' : 'Create Repair Record'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Scrap confirmation */}
      <ConfirmDialog
        open={confirmScrap.open}
        severity="danger"
        title="Scrap This Mould Permanently?"
        description={`Are you sure you want to mark mould "${confirmScrap.mouldCode}" as Scrapped? This indicates the mould is damaged beyond repair and permanently removes it from production service.`}
        confirmLabel="Yes, Scrap Mould"
        cancelLabel="Cancel"
        onConfirm={executeScrap}
        onCancel={() => setConfirmScrap({ open: false, id: '', mouldCode: '' })}
      />
    </div>
  );
}
