import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Removed api import
import { useAuth } from '../contexts/useAuth';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { MouldRepository } from '../repositories/mould.repository';
import { VendorRepository } from '../repositories/vendor.repository';
import { db } from '../lib/db';
import { SkeletonTable, FreshnessLabel } from '../components/Skeleton';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Vendor {
  id: string;
  code: string | null;
  name: string;
}

interface Assignment {
  id: string;
  vendorId: string;
  mouldId: string;
  status: string;
  rmAssignedQty: number;
  rmConsumedQty: number;
  rmRemainingQty: number;
  assignedAt: string;
  vendor?: Vendor;
  rawMaterial?: {
    code: string;
    name: string;
    unit: string;
  };
}

interface Mould {
  id: string;
  code: string | null;
  name: string;
  cavityCount: number;
  partWeightG?: number;
  runnerWeightG?: number;
  shotWeightG?: number;
  shotLifeLimit: number;
  shotCountAccumulated: number;
  lifecycleState: string;
  assignments?: Assignment[];
}

type StatusFilter = 'all' | 'active' | 'flagged_for_replacement' | 'in_repair' | 'retired' | 'unassigned';

export function Moulds() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCompany = user?.role === 'company';
  const { isOnline } = useSyncStatus();
  const { toast } = useToast();

  // ── Cache-first: reads IndexedDB instantly, background-refreshes from server ──
  const { data: moulds, isFirstLoad, lastSyncedAt } = useLiveQuery<Mould>(
    () => MouldRepository.getAll() as any,
    (force) => MouldRepository.refresh(force),
    db.moulds as any,
    'moulds',
  );

  const { data: vendors } = useLiveQuery<any>(
    () => VendorRepository.getAll() as any,
    (force) => VendorRepository.refresh(force),
    db.vendors as any,
  );

  const [savingAction, setSavingAction] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('all');
  const [selectedMould, setSelectedMould] = useState<Mould | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '', name: '', cavityCount: 1, partWeightG: '', runnerWeightG: '', shotLifeLimit: ''
  });

  // assignments come embedded in the mould objects from the API/repo
  const assignments: Assignment[] = (moulds as any[]).flatMap((m: any) => m.assignments || []);

  const vendorById = new Map(vendors.map(vendor => [vendor.id, vendor]));
  const assignmentCandidates = [
    ...assignments,
    ...moulds.flatMap(mould => mould.assignments || []),
  ];
  const activeAssignments = Array.from(
    assignmentCandidates
      .filter(a => a.status === 'active')
      .reduce((map, assignment) => {
        map.set(assignment.id, {
          ...assignment,
          vendor: assignment.vendor || vendorById.get(assignment.vendorId),
        });
        return map;
      }, new Map<string, Assignment>())
      .values()
  );
  const assignmentByMould = new Map(activeAssignments.map(a => [a.mouldId, a]));

  // ESC key: close detail drawer and create modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showModal) { setShowModal(false); return; }
      if (selectedMould) { setSelectedMould(null); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showModal, selectedMould]);

  const vendorSummaries = vendors.map(vendor => {
    const vendorAssignments = activeAssignments.filter(a => a.vendorId === vendor.id);
    const vendorMoulds = vendorAssignments
      .map(a => moulds.find(m => m.id === a.mouldId))
      .filter(Boolean) as Mould[];
    const atRisk = vendorMoulds.filter(m => getHealth(m).level !== 'healthy').length;
    return {
      ...vendor,
      total: vendorAssignments.length,
      atRisk,
    };
  });

  const filteredMoulds = moulds.filter(mould => {
    const assignment = assignmentByMould.get(mould.id);
    const matchesSearch =
      (mould.code?.toLowerCase().includes(search.toLowerCase()) || false) ||
      mould.name.toLowerCase().includes(search.toLowerCase()) ||
      (getVendorLabel(assignment).toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'unassigned'
        ? !assignment
        : mould.lifecycleState === statusFilter;
    const matchesVendor = selectedVendorId === 'all' ? true : assignment?.vendorId === selectedVendorId;
    return matchesSearch && matchesStatus && matchesVendor;
  });

  const selectedAssignment = selectedMould ? assignmentByMould.get(selectedMould.id) : undefined;

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
      await MouldRepository.create(payload);
      setShowModal(false);
      setFormData({ code: '', name: '', cavityCount: 1, partWeightG: '', runnerWeightG: '', shotLifeLimit: '' });
      toast.success(`Mould "${payload.code}" created successfully.`);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error creating mould.');
    }
  };

  // Confirm state for retire (irreversible) and move-to-repair
  const [lifecycleConfirm, setLifecycleConfirm] = useState<{
    open: boolean;
    mould: Mould | null;
    action: 'move-to-repair' | 'return-to-rotation' | 'retire';
  }>({ open: false, mould: null, action: 'retire' });

  // Confirm state for revoking assignment
  const [revokeConfirm, setRevokeConfirm] = useState<{
    open: boolean;
    assignmentId: string;
    mouldName: string;
    vendorName: string;
  }>({ open: false, assignmentId: '', mouldName: '', vendorName: '' });

  const promptLifecycle = (mould: Mould, action: 'move-to-repair' | 'return-to-rotation' | 'retire') => {
    if (action === 'return-to-rotation') {
      // No confirmation needed — easily reversible
      runLifecycleAction(mould, action);
      return;
    }
    setLifecycleConfirm({ open: true, mould, action });
  };

  const runLifecycleAction = async (mould: Mould, action: 'move-to-repair' | 'return-to-rotation' | 'retire') => {
    setSavingAction(true);
    setLifecycleConfirm({ open: false, mould: null, action: 'retire' });
    try {
      await MouldRepository.transition(mould.id, action);
      setSelectedMould(null);
      const label = action === 'retire' ? 'retired permanently' : action === 'move-to-repair' ? 'moved to repair' : 'returned to rotation';
      toast.success(`Mould ${mould.code || mould.name} ${label}.`);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to queue lifecycle transition.');
    } finally {
      setSavingAction(false);
    }
  };

  const runRevokeAssignment = async (assignmentId: string, mouldName: string) => {
    setRevokeConfirm({ open: false, assignmentId: '', mouldName: '', vendorName: '' });
    setSavingAction(true);
    try {
      await MouldRepository.revokeAssignment(assignmentId);
      setSelectedMould(null);
      toast.success(`Assignment for ${mouldName} revoked — queued for sync.`, {
        action: {
          label: 'Undo',
          onClick: () => toast.info('Undo is not yet available for synced operations. Contact admin if needed.'),
        },
      });
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to revoke assignment.');
    } finally {
      setSavingAction(false);
    }
  };

  const clearVendor = () => setSelectedVendorId('all');

  return (
    <div className="flex-1 w-full p-margin flex flex-col gap-gutter">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-4 border-b-4 border-on-background border-dashed">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-background leading-none">
            {isCompany ? 'Mould Master' : 'Assigned Mould Health'}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            {isCompany
              ? 'View mould health by vendor, inspect assignment context, and control lifecycle decisions.'
              : 'Monitor mould condition, material balance, and production logging for your assigned tools.'}
          </p>
          <FreshnessLabel lastSyncedAt={lastSyncedAt} isOnline={isOnline} className="mt-1" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-stretch">
          <div className="relative flex-1 sm:w-80 group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-on-background">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input
              className="w-full bg-surface py-3 pl-10 pr-4 font-body-md text-body-md placeholder:text-on-surface-variant border-2 border-on-background neo-shadow-sm focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-[2px_2px_0px_#1A1A1A] transition-all rounded-none"
              placeholder={isCompany ? 'Search mould or vendor...' : 'Search assigned mould...'}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {isCompany && (
            <button onClick={() => setShowModal(true)} className="bg-primary-container text-on-primary-container border-2 border-on-background neo-shadow px-6 py-3 font-label-sm text-label-sm uppercase tracking-wider hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all flex items-center justify-center gap-2 whitespace-nowrap">
              <span className="material-symbols-outlined fill-icon text-[18px]">add_box</span>
              Add New Mould
            </button>
          )}
        </div>
      </header>

      {isCompany && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-bento-gap">
          <button
            onClick={clearVendor}
            className={`text-left border-2 border-on-background p-4 neo-shadow-sm ${selectedVendorId === 'all' ? 'bg-primary-container text-on-primary-container' : 'bg-surface hover:bg-surface-container-low'}`}
          >
            <span className="font-label-sm text-label-sm uppercase">All Vendors</span>
            <div className="font-data-lg text-[32px] font-bold mt-2">{activeAssignments.length}</div>
            <p className="font-body-md text-body-md mt-1">Assigned moulds in rotation</p>
          </button>
          {vendorSummaries.map(vendor => (
            <button
              key={vendor.id}
              onClick={() => setSelectedVendorId(vendor.id)}
              className={`text-left border-2 border-on-background p-4 neo-shadow-sm transition-colors ${selectedVendorId === vendor.id ? 'bg-primary-container text-on-primary-container' : 'bg-surface hover:bg-surface-container-low'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-label-sm text-label-sm uppercase">{vendor.code || 'Vendor'}</span>
                  <h3 className="font-headline-md text-headline-md mt-1">{vendor.name}</h3>
                </div>
                {vendor.atRisk > 0 && (
                  <span className="bg-warning border-2 border-on-background px-2 py-1 font-label-sm text-label-sm">{vendor.atRisk} Risk</span>
                )}
              </div>
              <div className="font-data-lg text-[32px] font-bold mt-3">{vendor.total}</div>
              <p className="font-body-md text-body-md text-on-surface-variant">Click to inspect assigned moulds</p>
            </button>
          ))}
        </section>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
        {[
          { id: 'all', label: `All (${moulds.length})` },
          { id: 'active', label: 'Active' },
          { id: 'flagged_for_replacement', label: 'Near Limit' },
          { id: 'in_repair', label: 'Repair' },
          { id: 'retired', label: 'Retired' },
          ...(isCompany ? [{ id: 'unassigned', label: 'Unassigned' }] : []),
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id as StatusFilter)}
            className={`shrink-0 border-2 border-on-background px-4 py-2 font-label-sm text-label-sm uppercase neo-shadow-sm ${statusFilter === filter.id ? 'bg-on-background text-surface' : 'bg-surface text-on-background hover:bg-surface-variant'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="bg-surface border-2 border-on-background neo-shadow flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="bg-surface-variant border-b-2 border-on-background">
              <tr>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-56">Mould</th>
                {isCompany && <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Vendor</th>}
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Lifecycle</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-72">Health</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Assignment</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-24 text-center">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-on-background">
              {isFirstLoad ? (
                <tr><td colSpan={isCompany ? 6 : 5} className="p-4"><SkeletonTable cols={isCompany ? 6 : 5} rows={4} /></td></tr>
              ) : filteredMoulds.length === 0 ? (
                <tr><td colSpan={isCompany ? 6 : 5} className="p-4 text-center font-body-md">No moulds found.</td></tr>
              ) : (
                filteredMoulds.map(mould => {
                  const assignment = assignmentByMould.get(mould.id);
                  const health = getHealth(mould);
                  const lifecycle = getLifecycleStyle(mould.lifecycleState);

                  return (
                    <tr key={mould.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="p-4">
                        <div className="font-data-md text-data-md text-on-background">{mould.code || mould.id.substring(0, 8)}</div>
                        <div className="font-body-md text-body-md text-on-surface-variant truncate w-48" title={mould.name}>{mould.name}</div>
                        <div className="font-label-sm text-label-sm text-on-surface-variant mt-1">{mould.cavityCount} cavities</div>
                      </td>
                      {isCompany && (
                        <td className="p-4">
                          {assignment ? (
                            <button onClick={() => setSelectedVendorId(assignment.vendorId)} className="text-left hover:underline">
                              <div className="font-bold">{getVendorLabel(assignment)}</div>
                              <div className="text-secondary text-sm">{assignment.vendor?.code || 'Vendor record unavailable'}</div>
                            </button>
                          ) : (
                            <span className="border-2 border-on-background px-2 py-1 font-label-sm text-label-sm uppercase bg-surface-container-low">Unassigned</span>
                          )}
                        </td>
                      )}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 ${lifecycle.className} border-2 border-on-background px-2 py-1 font-label-sm text-label-sm uppercase`}>
                          <span className="material-symbols-outlined text-[14px]">{lifecycle.icon}</span>
                          {mould.lifecycleState?.replace(/_/g, ' ') || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between font-data-md text-data-md text-sm">
                            <span className={health.level === 'critical' ? 'text-danger font-bold' : ''}>{mould.shotCountAccumulated.toLocaleString()}</span>
                            <span className="text-on-surface-variant">{mould.shotLifeLimit.toLocaleString()}</span>
                          </div>
                          <div className="h-3 w-full border-2 border-on-background bg-surface-variant overflow-hidden">
                            <div className={`h-full ${health.barClass} border-r-2 border-on-background`} style={{ width: `${health.percentage}%` }}></div>
                          </div>
                          <div className="flex justify-between text-xs uppercase">
                            <span className={health.textClass}>{health.label}</span>
                            <span>{health.percentage}% used</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {assignment ? (
                          <div className="font-body-md text-body-md">
                            <div>{assignment.rawMaterial?.code || 'RM'} - {assignment.rawMaterial?.name || 'Material'}</div>
                            <div className="text-secondary text-sm">{Number(assignment.rmRemainingQty || 0).toLocaleString()} kg remaining</div>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant">No active assignment</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setSelectedMould(mould)}
                          className="p-2 border-2 border-on-background shadow-[2px_2px_0px_#1A1A1A] bg-surface hover:bg-primary-container transition-all"
                          aria-label={`Open actions for ${mould.code || mould.name}`}
                        >
                          <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-surface-variant border-t-2 border-on-background p-4 flex justify-between items-center">
          <span className="font-body-md text-body-md text-on-surface-variant">
            Showing {filteredMoulds.length} of {moulds.length} moulds
          </span>
          {selectedVendorId !== 'all' && (
            <button onClick={clearVendor} className="px-3 py-1 border-2 border-on-background bg-surface neo-shadow-sm font-label-sm text-label-sm uppercase">
              Clear Vendor
            </button>
          )}
        </div>
      </div>

      {selectedMould && (
        <div className="fixed inset-0 z-50 flex justify-end bg-on-background/40">
          <aside className="w-full max-w-xl h-full bg-surface border-l-4 border-on-background shadow-[-8px_0_0_#1A1A1A] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b-4 border-on-background p-5 flex items-start justify-between gap-4">
              <div>
                <div className="font-label-sm text-label-sm uppercase text-secondary">Mould Action Center</div>
                <h3 className="font-headline-lg text-headline-lg">{selectedMould.code || selectedMould.id.substring(0, 8)}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{selectedMould.name}</p>
              </div>
              <button onClick={() => setSelectedMould(null)} className="w-9 h-9 border-2 border-on-background bg-error-container text-danger flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <MouldHealthPanel mould={selectedMould} assignment={selectedAssignment} />

              {isCompany ? (
                <section className="border-2 border-on-background p-4 bg-surface-container-low">
                  <h4 className="font-headline-md text-headline-md mb-3">Company Decisions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedMould.lifecycleState !== 'in_repair' && selectedMould.lifecycleState !== 'retired' && (
                      <button disabled={savingAction} onClick={() => promptLifecycle(selectedMould, 'move-to-repair')} className="border-2 border-on-background bg-warning px-4 py-3 font-label-sm text-label-sm uppercase neo-shadow-sm disabled:opacity-50">
                        Move to Repair
                      </button>
                    )}
                    {selectedMould.lifecycleState === 'in_repair' && (
                      <button disabled={savingAction} onClick={() => promptLifecycle(selectedMould, 'return-to-rotation')} className="border-2 border-on-background bg-success text-on-primary px-4 py-3 font-label-sm text-label-sm uppercase neo-shadow-sm disabled:opacity-50">
                        Return Active
                      </button>
                    )}
                    {selectedMould.lifecycleState !== 'retired' && (
                      <button disabled={savingAction} onClick={() => promptLifecycle(selectedMould, 'retire')} className="border-2 border-on-background bg-danger text-on-error px-4 py-3 font-label-sm text-label-sm uppercase neo-shadow-sm disabled:opacity-50 flex items-center gap-2">
                        <span className="material-symbols-outlined fill-icon text-[16px]">warning</span>
                        Retire Mould
                      </button>
                    )}
                    {selectedAssignment && (
                      <button
                        onClick={() => setRevokeConfirm({
                          open: true,
                          assignmentId: selectedAssignment.id,
                          mouldName: selectedMould.code || selectedMould.name,
                          vendorName: getVendorLabel(selectedAssignment),
                        })}
                        disabled={savingAction}
                        className="border-2 border-on-background bg-surface text-danger px-4 py-3 font-label-sm text-label-sm uppercase neo-shadow-sm disabled:opacity-50 hover:bg-error-container/20 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined fill-icon text-[16px]">link_off</span>
                        Revoke Assignment
                      </button>
                    )}
                    {selectedAssignment && (
                      <button onClick={() => navigate('/vendors')} className="border-2 border-on-background bg-surface px-4 py-3 font-label-sm text-label-sm uppercase neo-shadow-sm">
                        Manage Assignment
                      </button>
                    )}
                  </div>
                </section>
              ) : (
                <section className="border-2 border-on-background p-4 bg-surface-container-low">
                  <h4 className="font-headline-md text-headline-md mb-3">Vendor Actions</h4>
                  <button
                    disabled={!selectedAssignment || selectedMould.lifecycleState !== 'active'}
                    onClick={() => selectedAssignment && navigate(`/logs/new?assignmentId=${selectedAssignment.id}`)}
                    className="w-full border-2 border-on-background bg-deep-orange text-surface px-4 py-3 font-label-sm text-label-sm uppercase neo-shadow-sm disabled:opacity-50"
                  >
                    Log Production
                  </button>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}

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

      <ConfirmDialog
        open={lifecycleConfirm.open}
        severity={lifecycleConfirm.action === 'retire' ? 'danger' : 'warning'}
        title={lifecycleConfirm.action === 'retire' ? 'Retire This Mould Permanently?' : 'Move Mould to Repair?'}
        description={
          lifecycleConfirm.action === 'retire'
            ? `Are you sure you want to retire "${lifecycleConfirm.mould?.code || lifecycleConfirm.mould?.name}"? A retired mould can no longer be assigned to vendors or used in production logs. This is irreversible.`
            : `Are you sure you want to move "${lifecycleConfirm.mould?.code || lifecycleConfirm.mould?.name}" to repair? This will flag it as undergoing maintenance.`
        }
        confirmLabel={lifecycleConfirm.action === 'retire' ? 'Yes, Retire Mould' : 'Move to Repair'}
        cancelLabel="Cancel"
        loading={savingAction}
        onConfirm={() => lifecycleConfirm.mould && runLifecycleAction(lifecycleConfirm.mould, lifecycleConfirm.action)}
        onCancel={() => setLifecycleConfirm({ open: false, mould: null, action: 'retire' })}
      />

      <ConfirmDialog
        open={revokeConfirm.open}
        severity="warning"
        title="Revoke Vendor Assignment?"
        description={`Removing the assignment of "${revokeConfirm.mouldName}" from "${revokeConfirm.vendorName}" will stop material tracking for this mould at that vendor. The vendor will no longer be able to log production for this mould.`}
        confirmLabel="Revoke Assignment"
        cancelLabel="Cancel"
        loading={savingAction}
        onConfirm={() => runRevokeAssignment(revokeConfirm.assignmentId, revokeConfirm.mouldName)}
        onCancel={() => setRevokeConfirm({ open: false, assignmentId: '', mouldName: '', vendorName: '' })}
      />
    </div>
  );
}

function MouldHealthPanel({ mould, assignment }: { mould: Mould; assignment?: Assignment }) {
  const health = getHealth(mould);
  return (
    <section className="border-2 border-on-background p-4 bg-surface">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h4 className="font-headline-md text-headline-md">Health Snapshot</h4>
          <p className={`font-label-sm text-label-sm uppercase mt-1 ${health.textClass}`}>{health.label}</p>
        </div>
        <div className="font-data-lg text-[32px] font-bold">{health.percentage}%</div>
      </div>
      <div className="h-5 w-full border-2 border-on-background bg-surface-variant overflow-hidden mb-4">
        <div className={`h-full ${health.barClass} border-r-2 border-on-background`} style={{ width: `${health.percentage}%` }}></div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Shots Run" value={mould.shotCountAccumulated.toLocaleString()} />
        <Metric label="Life Limit" value={mould.shotLifeLimit.toLocaleString()} />
        <Metric label="Cavities" value={mould.cavityCount.toLocaleString()} />
        <Metric label="Shot Weight" value={`${Number(mould.shotWeightG || 0).toLocaleString()} g`} />
        <Metric label="Vendor" value={assignment ? getVendorLabel(assignment) : 'Unassigned'} />
        <Metric label="RM Balance" value={assignment ? `${Number(assignment.rmRemainingQty || 0).toLocaleString()} kg` : 'Not assigned'} />
      </dl>
    </section>
  );
}

function getVendorLabel(assignment?: Assignment) {
  if (!assignment) return '';
  return assignment.vendor?.name || `Vendor ID ${assignment.vendorId.slice(0, 8)}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-outline-variant bg-surface-container-low p-3">
      <dt className="font-label-sm text-label-sm uppercase text-secondary">{label}</dt>
      <dd className="font-data-md text-data-md font-bold mt-1">{value}</dd>
    </div>
  );
}

function getHealth(mould: Mould) {
  const percentage = mould.shotLifeLimit > 0
    ? Math.min(100, Math.round((mould.shotCountAccumulated / mould.shotLifeLimit) * 100))
    : 0;

  if (mould.lifecycleState === 'retired') {
    return { percentage, level: 'retired', label: 'Retired', barClass: 'bg-secondary', textClass: 'text-secondary' };
  }
  if (mould.lifecycleState === 'in_repair') {
    return { percentage, level: 'critical', label: 'In repair', barClass: 'bg-danger', textClass: 'text-danger' };
  }
  if (percentage >= 90 || mould.lifecycleState === 'flagged_for_replacement') {
    return { percentage, level: 'critical', label: 'Critical attention', barClass: 'bg-danger', textClass: 'text-danger' };
  }
  if (percentage >= 75) {
    return { percentage, level: 'watch', label: 'Watch closely', barClass: 'bg-warning', textClass: 'text-warning' };
  }
  return { percentage, level: 'healthy', label: 'Healthy', barClass: 'bg-success', textClass: 'text-success' };
}

function getLifecycleStyle(state: string) {
  if (state === 'active') return { className: 'bg-success text-on-primary', icon: 'check_circle' };
  if (state === 'in_repair') return { className: 'bg-warning text-on-background', icon: 'build' };
  if (state === 'flagged_for_replacement') return { className: 'bg-danger text-on-error', icon: 'warning' };
  if (state === 'retired') return { className: 'bg-surface-container-highest text-secondary', icon: 'block' };
  return { className: 'bg-surface-variant text-on-background', icon: 'help' };
}
