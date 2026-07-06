import { useState } from 'react';
import { VendorRepository } from '../repositories/vendor.repository';
import { MouldRepository } from '../repositories/mould.repository';
import { MaterialRepository } from '../repositories/material.repository';
import { db } from '../lib/db';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { SkeletonTable, FreshnessLabel } from '../components/Skeleton';
import { useSyncStatus } from '../hooks/useSyncStatus';

interface Vendor {
  id: string;
  name: string;
  code: string | null;
  sharedLoginId: string | null;
}

export function Vendors() {
  const { isOnline } = useSyncStatus();

  // ── Cache-first: reads IndexedDB instantly, background-refreshes from server ──
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
  const [formData, setFormData] = useState({ name: '', code: '', sharedLoginId: '', initialPassword: '' });
  const [assignData, setAssignData] = useState({ vendorId: '', mouldId: '', rawMaterialId: '', rmAssignedQty: '' });
  
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await VendorRepository.create(formData);
      setShowModal(false);
      setFormData({ name: '', code: '', sharedLoginId: '', initialPassword: '' });
    } catch (err) {
      console.error('Failed to create vendor:', err);
      alert('Error creating vendor.');
    }
  };

  const filteredVendors = (vendors as Vendor[]).filter(v => 
    (v.code?.toLowerCase().includes(search.toLowerCase()) || '') || 
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...assignData,
        rmAssignedQty: Number(assignData.rmAssignedQty)
      };
      await VendorRepository.assign(payload);
      setShowAssignModal(false);
      setAssignData({ vendorId: '', mouldId: '', rawMaterialId: '', rmAssignedQty: '' });
      // Optimistic update alert since it handles via queue
      alert('Assignment queued successfully!');
    } catch (err) {
      console.error('Failed to assign:', err);
      alert('Error creating assignment.');
    }
  };

  return (
    <div className="flex-1 w-full p-margin flex flex-col gap-gutter">
      {/* Header Actions */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-4 border-b-4 border-on-background border-dashed">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-background leading-none">Vendor Master</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Manage vendor profiles and system access credentials.</p>
          <FreshnessLabel lastSyncedAt={lastSyncedAt} isOnline={isOnline} className="mt-1" />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch">
          <div className="relative flex-1 sm:w-80 group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-on-background">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input 
              className="w-full bg-surface py-3 pl-10 pr-4 font-body-md text-body-md placeholder:text-on-surface-variant border-2 border-on-background neo-shadow-sm focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[2px_2px_0px_#1A1A1A] transition-all rounded-none" 
              placeholder="Search Vendor Name or Code..." 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setShowModal(true)} className="bg-primary-container text-on-primary-container border-2 border-on-background neo-shadow px-6 py-3 font-label-sm text-label-sm uppercase tracking-wider hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all flex items-center justify-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined fill-icon text-[18px]">add_box</span>
            Add New Vendor
          </button>
        </div>
      </header>

      {/* Bento Grid Table Container */}
      <div className="bg-surface border-2 border-on-background neo-shadow flex flex-col overflow-hidden">
        {isFirstLoad ? (
          <SkeletonTable cols={4} rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-surface-variant border-b-2 border-on-background">
                <tr>
                  <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-48">Vendor ID / Code</th>
                  <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Company Name</th>
                  <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">System Login ID</th>
                  <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-16 text-center">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-on-background">
                {filteredVendors.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center font-body-md">No vendors found.</td></tr>
                ) : (
                  filteredVendors.map(vendor => (
                    <tr key={vendor.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="p-4">
                        <div className="font-data-md text-data-md text-on-background">{vendor.code || vendor.id.substring(0, 8)}</div>
                      </td>
                      <td className="p-4 font-body-md text-body-md text-on-background font-medium">
                        {vendor.name}
                      </td>
                      <td className="p-4 font-data-md text-data-md text-secondary">
                        {vendor.sharedLoginId || 'Unassigned'}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => {
                            setAssignData(p => ({...p, vendorId: vendor.id}));
                            setShowAssignModal(true);
                          }}
                          className="bg-surface-variant text-on-background border-2 border-on-background px-3 py-1 neo-shadow-sm font-label-sm text-label-sm uppercase hover:neo-active whitespace-nowrap"
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {/* Table Footer */}
        <div className="bg-surface-variant border-t-2 border-on-background p-4 flex justify-between items-center">
          <span className="font-body-md text-body-md text-on-surface-variant">Showing {vendors.length} entries</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border-2 border-on-background bg-surface neo-shadow-sm font-label-sm text-label-sm opacity-50 cursor-not-allowed">PREV</button>
            <button className="px-3 py-1 border-2 border-on-background bg-surface neo-shadow-sm font-label-sm text-label-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#1A1A1A] transition-all">NEXT</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border-4 border-on-background shadow-[8px_8px_0px_#1A1A1A] w-full max-w-md p-6 relative">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-on-background bg-error-container text-danger hover:bg-danger hover:text-on-error transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <h2 className="font-display-lg text-[24px] uppercase border-b-2 border-on-background pb-2 mb-6">New Vendor</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Company Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]" 
                />
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Vendor Code</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={e => setFormData(p => ({...p, code: e.target.value}))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]" 
                />
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">System Login ID</label>
                <input 
                  type="text" 
                  value={formData.sharedLoginId}
                  onChange={e => setFormData(p => ({...p, sharedLoginId: e.target.value}))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]" 
                />
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Initial Password</label>
                <input 
                  type="password" 
                  value={formData.initialPassword}
                  onChange={e => setFormData(p => ({...p, initialPassword: e.target.value}))}
                  placeholder="Defaults to password"
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]" 
                />
              </div>
              <button type="submit" className="mt-4 bg-primary text-on-primary border-2 border-on-background p-3 uppercase font-bold neo-shadow-sm hover:neo-active">
                Create Vendor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border-4 border-on-background shadow-[8px_8px_0px_#1A1A1A] w-full max-w-xl p-6 relative">
            <button 
              onClick={() => setShowAssignModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-on-background bg-error-container text-danger hover:bg-danger hover:text-on-error transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <h2 className="font-display-lg text-[24px] uppercase border-b-2 border-on-background pb-2 mb-6">Assign Mould to Vendor</h2>
            <form onSubmit={handleAssign} className="flex flex-col gap-4">
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Mould</label>
                <select 
                  required
                  value={assignData.mouldId}
                  onChange={e => setAssignData(p => ({...p, mouldId: e.target.value}))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none"
                >
                  <option value="">Select a Mould...</option>
                  {(moulds as any[])
                    .filter(m => {
                      // Exclude moulds that already have an active assignment
                      const hasActiveAssignment = (m.assignments || []).some(
                        (a: any) => a.status === 'active'
                      );
                      return !hasActiveAssignment;
                    })
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.name}
                      </option>
                    ))
                  }
                </select>
                {/* Hint when all moulds are assigned */}
                {(moulds as any[]).every(m => (m.assignments || []).some((a: any) => a.status === 'active')) && (
                  <p className="mt-1 font-label-sm text-[11px] text-warning">
                    All moulds are currently assigned. End an existing assignment first.
                  </p>
                )}
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Raw Material</label>
                <select 
                  required
                  value={assignData.rawMaterialId}
                  onChange={e => setAssignData(p => ({...p, rawMaterialId: e.target.value}))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none"
                >
                  <option value="">Select Raw Material...</option>
                  {(materials as any[]).map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Assigned Quantity (kg)</label>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  value={assignData.rmAssignedQty}
                  onChange={e => setAssignData(p => ({...p, rmAssignedQty: e.target.value}))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none"
                />
              </div>
              <button type="submit" className="mt-4 bg-primary text-on-primary border-2 border-on-background p-3 uppercase font-bold neo-shadow-sm hover:neo-active">
                Confirm Assignment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
