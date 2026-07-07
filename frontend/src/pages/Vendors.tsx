import { useState } from 'react';
import { VendorRepository } from '../repositories/vendor.repository';
import { MouldRepository } from '../repositories/mould.repository';
import { MaterialRepository } from '../repositories/material.repository';
import { db } from '../lib/db';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { SkeletonTable, FreshnessLabel } from '../components/Skeleton';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Vendor { id: string; name: string; code: string | null; sharedLoginId: string | null; }

// Generic Modal wrapper
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-on-background/60 backdrop-blur-sm">
      <div className="bg-surface border-4 border-on-background shadow-[8px_8px_0px_#1A1A1A] w-full sm:max-w-xl flex flex-col max-h-[95vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b-4 border-on-background bg-surface-variant">
          <h2 className="font-headline-md text-headline-md uppercase">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border-2 border-on-background bg-error-container text-danger hover:bg-danger hover:text-on-error transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Vendors() {
  const { isOnline } = useSyncStatus();
  const { toast } = useToast();

  const { data: vendors, isFirstLoad, lastSyncedAt } = useLiveQuery(
    () => VendorRepository.getAll() as any,
    (force) => VendorRepository.refresh(force),
    db.vendors as any,
    'vendors',
  );
  const { data: moulds } = useLiveQuery(
    () => MouldRepository.getAll() as any,
    (force) => MouldRepository.refresh(force),
    db.moulds as any,
  );
  const { data: materials } = useLiveQuery(
    () => MaterialRepository.getAll() as any,
    (force) => MaterialRepository.refresh(force),
    db.materials as any,
  );

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', sharedLoginId: '', initialPassword: '' });
  const [assignData, setAssignData] = useState({ vendorId: '', mouldId: '', rawMaterialId: '', rmAssignedQty: '' });

  const filteredVendors = (vendors as Vendor[]).filter(v =>
    (v.code?.toLowerCase().includes(search.toLowerCase()) || '') ||
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedVendor = (vendors as Vendor[]).find(v => v.id === assignData.vendorId);
  const selectedMould = (moulds as any[]).find(m => m.id === assignData.mouldId);
  const selectedMaterial = (materials as any[]).find(m => m.id === assignData.rawMaterialId);
  const availableMoulds = (moulds as any[]).filter(m => !(m.assignments || []).some((a: any) => a.status === 'active'));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await VendorRepository.create(formData);
      setShowModal(false);
      setFormData({ name: '', code: '', sharedLoginId: '', initialPassword: '' });
      toast.success(`Vendor "${formData.name}" created successfully.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create vendor. The login ID may already be taken.');
    } finally { setSaving(false); }
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowAssignConfirm(true);
  };

  const confirmAssign = async () => {
    setSaving(true);
    setShowAssignConfirm(false);
    try {
      const payload = { ...assignData, rmAssignedQty: Number(assignData.rmAssignedQty) };
      await VendorRepository.assign(payload);
      setShowAssignModal(false);
      setAssignData({ vendorId: '', mouldId: '', rawMaterialId: '', rmAssignedQty: '' });
      toast.success(`Mould assigned to ${selectedVendor?.name || 'vendor'} — queued for sync.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create assignment.');
    } finally { setSaving(false); }
  };

  return (
    <div className="flex-1 w-full p-4 md:p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b-4 border-on-background border-dashed">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-background leading-none">Vendor Master</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Manage vendor profiles and system access credentials.</p>
          <FreshnessLabel lastSyncedAt={lastSyncedAt} isOnline={isOnline} className="mt-1" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-background pointer-events-none">search</span>
            <input
              className="w-full bg-surface py-3 pl-10 pr-4 font-body-md text-body-md placeholder:text-on-surface-variant border-2 border-on-background neo-shadow-sm focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all rounded-none"
              placeholder="Search vendor name or code..."
              type="text" value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setShowModal(true)} className="bg-primary-container text-on-primary-container border-2 border-on-background neo-shadow px-5 py-3 font-label-sm text-label-sm uppercase tracking-wider hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all flex items-center justify-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined fill-icon text-[18px]">add_box</span>
            Add Vendor
          </button>
        </div>
      </header>

      {/* Desktop Table / Mobile Cards */}
      {isFirstLoad ? (
        <SkeletonTable cols={4} rows={6} />
      ) : filteredVendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-[56px]">factory</span>
          <p className="font-body-md text-body-md">No vendors found.</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredVendors.map(vendor => (
              <div key={vendor.id} className="bg-surface border-2 border-on-background neo-shadow-sm p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-data-md text-data-md text-on-background font-bold truncate">{vendor.name}</div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{vendor.code || '—'} · Login: {vendor.sharedLoginId || 'None'}</div>
                </div>
                <button
                  onClick={() => { setAssignData(p => ({ ...p, vendorId: vendor.id })); setShowAssignModal(true); }}
                  className="shrink-0 bg-surface-variant text-on-background border-2 border-on-background px-3 py-1.5 neo-shadow-sm font-label-sm text-label-sm uppercase hover:neo-active"
                >
                  Assign
                </button>
              </div>
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden md:block bg-surface border-2 border-on-background neo-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-surface-variant border-b-2 border-on-background">
                  <tr>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-40">Code</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Company Name</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">System Login</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-24 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-on-background">
                  {filteredVendors.map(vendor => (
                    <tr key={vendor.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-4 font-data-md text-data-md text-on-background">{vendor.code || vendor.id.substring(0, 8)}</td>
                      <td className="p-4 font-body-md text-body-md text-on-background font-medium">{vendor.name}</td>
                      <td className="p-4 font-data-md text-data-md text-secondary">{vendor.sharedLoginId || '—'}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => { setAssignData(p => ({ ...p, vendorId: vendor.id })); setShowAssignModal(true); }}
                          className="bg-surface-variant text-on-background border-2 border-on-background px-3 py-1 neo-shadow-sm font-label-sm text-label-sm uppercase hover:neo-active whitespace-nowrap"
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-surface-variant border-t-2 border-on-background p-4">
              <span className="font-body-md text-body-md text-on-surface-variant">Showing {filteredVendors.length} of {vendors.length} vendors</span>
            </div>
          </div>
        </>
      )}

      {/* Create Vendor Modal */}
      {showModal && (
        <Modal title="New Vendor" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">Company Name <span className="text-danger">*</span></label>
              <input required type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]" />
            </div>
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">Vendor Code</label>
              <input type="text" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]" />
            </div>
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">System Login ID</label>
              <input type="text" value={formData.sharedLoginId} onChange={e => setFormData(p => ({ ...p, sharedLoginId: e.target.value }))}
                className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]"
                placeholder="e.g. vendor_raj" />
              <p className="mt-1 font-label-sm text-[11px] text-on-surface-variant">If provided, a password is required below.</p>
            </div>
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">
                Initial Password {formData.sharedLoginId && <span className="text-danger">*</span>}
              </label>
              <input type="password" value={formData.initialPassword} onChange={e => setFormData(p => ({ ...p, initialPassword: e.target.value }))}
                required={!!formData.sharedLoginId}
                className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]"
                placeholder="Min 8 characters recommended" />
            </div>
            <button disabled={saving} type="submit" className="mt-2 bg-primary text-on-primary border-2 border-on-background p-3 uppercase font-bold neo-shadow-sm hover:neo-active disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Creating...' : 'Create Vendor'}
            </button>
          </form>
        </Modal>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <Modal title={`Assign Mould — ${selectedVendor?.name || '...'}`} onClose={() => setShowAssignModal(false)}>
          <form onSubmit={handleAssignSubmit} className="p-6 flex flex-col gap-4">
            <div className="bg-primary-container/20 border-2 border-primary-container p-3 font-body-md text-body-md text-on-background flex items-start gap-2">
              <span className="material-symbols-outlined fill-icon text-primary text-[20px] shrink-0">info</span>
              <span>Assigning a mould commits raw material to this vendor. This cannot be undone without ending the assignment.</span>
            </div>
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">Mould <span className="text-danger">*</span></label>
              <select required value={assignData.mouldId} onChange={e => setAssignData(p => ({ ...p, mouldId: e.target.value }))}
                className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none">
                <option value="">Select a Mould...</option>
                {availableMoulds.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
              </select>
              {availableMoulds.length === 0 && <p className="mt-1 font-label-sm text-[11px] text-warning">All moulds are currently assigned.</p>}
            </div>
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">Raw Material <span className="text-danger">*</span></label>
              <select required value={assignData.rawMaterialId} onChange={e => setAssignData(p => ({ ...p, rawMaterialId: e.target.value }))}
                className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none">
                <option value="">Select Raw Material...</option>
                {(materials as any[]).map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-label-sm uppercase text-secondary block mb-1">Assigned Quantity (kg) <span className="text-danger">*</span></label>
              <input required type="number" step="0.01" min="0.01" value={assignData.rmAssignedQty} onChange={e => setAssignData(p => ({ ...p, rmAssignedQty: e.target.value }))}
                className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none"
                placeholder="e.g. 500" />
            </div>
            <button disabled={saving || availableMoulds.length === 0} type="submit"
              className="mt-2 bg-primary text-on-primary border-2 border-on-background p-3 uppercase font-bold neo-shadow-sm hover:neo-active disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              Review & Confirm Assignment
            </button>
          </form>
        </Modal>
      )}

      {/* Assignment confirmation */}
      <ConfirmDialog
        open={showAssignConfirm}
        severity="warning"
        title="Confirm Mould Assignment"
        description={`You are assigning mould "${selectedMould?.code || '—'} (${selectedMould?.name || '—'})" to vendor "${selectedVendor?.name || '—'}" with ${assignData.rmAssignedQty} kg of ${selectedMaterial?.name || 'material'}. This operation commits real material stock.`}
        confirmLabel="Yes, Assign"
        cancelLabel="Go Back"
        loading={saving}
        onConfirm={confirmAssign}
        onCancel={() => setShowAssignConfirm(false)}
      />
    </div>
  );
}
