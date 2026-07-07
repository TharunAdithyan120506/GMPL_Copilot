import { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { LogRepository } from '../repositories/log.repository';
import { db } from '../lib/db';
import { SkeletonTable, FreshnessLabel } from '../components/Skeleton';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ProductionLog {
  id: string;
  logDate: string;
  acceptedQty: number;
  rejectedQty: number;
  dispatchedQty: number;
  status: string;
  mould: { name: string; code: string | null };
}

export function Logs() {
  const { user } = useAuth();
  const { isOnline } = useSyncStatus();
  const { toast } = useToast();
  const isCompany = user?.role === 'company';

  // ── Cache-first: reads IndexedDB instantly, background-refreshes from server ──
  const { data: logs, isFirstLoad, lastSyncedAt } = useLiveQuery(
    () => LogRepository.getAll() as any,
    (force) => LogRepository.refresh(force),
    db.logs as any,
    'logs',
  );

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ProductionLog | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Edit form state
  const [newAcc, setNewAcc] = useState<number | ''>('');
  const [newRej, setNewRej] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openEditModal = (log: ProductionLog) => {
    setSelectedLog(log);
    setNewAcc(log.acceptedQty);
    setNewRej(log.rejectedQty);
    setReason('');
    setEditModalOpen(true);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLog || reason.trim() === '' || newAcc === '' || newRej === '') {
      toast.warning('Please fill in all required fields.');
      return;
    }
    setConfirmSubmit(true);
  };

  const handleRequestEdit = async () => {
    if (!selectedLog || reason.trim() === '' || newAcc === '' || newRej === '') return;

    setSubmitting(true);
    setConfirmSubmit(false);
    try {
      await LogRepository.requestEdit({
        dailyProductionLogId: selectedLog.id,
        requestedChanges: {
          acceptedQty: Number(newAcc),
          rejectedQty: Number(newRej),
        },
        reason: reason.trim(),
      });
      setEditModalOpen(false);
      setSelectedLog(null);
      toast.success('Edit request submitted to approval queue.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit edit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 w-full p-4 md:p-6 flex flex-col gap-6 relative min-w-0">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b-4 border-on-background border-dashed">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-background leading-none">
            {isCompany ? 'Global Production Logs' : 'My Logs'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            History of submitted production logs across assigned moulds.
          </p>
          <FreshnessLabel lastSyncedAt={lastSyncedAt} isOnline={isOnline} className="mt-1" />
        </div>
      </header>

      {isFirstLoad ? (
        <SkeletonTable cols={5} rows={6} />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant bg-surface border-2 border-on-background">
          <span className="material-symbols-outlined text-[56px]">history</span>
          <p className="font-body-md text-body-md">No production logs found.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="flex flex-col gap-3 md:hidden">
            {(logs as ProductionLog[]).map(log => (
              <div key={log.id} className="bg-surface border-2 border-on-background neo-shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2 border-b-2 border-on-background pb-2">
                  <div>
                    <div className="font-data-md text-data-md font-bold text-on-background">{log.mould?.code || '—'}</div>
                    <div className="font-body-md text-body-md text-on-surface-variant truncate">{log.mould?.name}</div>
                  </div>
                  <span className="bg-surface-variant border-2 border-on-background px-2 py-0.5 font-label-sm text-[11px] uppercase shrink-0">
                    {log.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase">Date</span>
                    <span className="font-data-md text-data-md">{new Date(log.logDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase">Yield (Acc / Rej)</span>
                    <span className="font-data-md text-data-md"><span className="text-success font-bold">{log.acceptedQty}</span> / <span className="text-danger font-bold">{log.rejectedQty}</span></span>
                  </div>
                </div>

                {!isCompany && ['submitted', 'corrected'].includes(log.status) && (
                  <button
                    onClick={() => openEditModal(log)}
                    className="w-full mt-1 bg-primary-container text-on-primary-container border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm py-2 uppercase hover:neo-active flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined fill-icon text-[16px]">edit_document</span>
                    Request Edit
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block bg-surface border-2 border-on-background neo-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-surface-variant border-b-2 border-on-background">
                  <tr>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-40">Date</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Mould</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Yield (Acc / Rej)</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Status</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest text-center w-36">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-on-background">
                  {(logs as ProductionLog[]).map(log => (
                    <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-4 font-data-md text-data-md">
                        {new Date(log.logDate).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-body-md text-body-md text-on-background font-medium">
                        {log.mould?.code} ({log.mould?.name})
                      </td>
                      <td className="p-4 font-data-md text-data-md text-secondary">
                        <span className="text-success font-bold">{log.acceptedQty}</span> / <span className="text-danger font-bold">{log.rejectedQty}</span>
                      </td>
                      <td className="p-4">
                        <span className="bg-surface-variant border-2 border-on-background px-2.5 py-1 font-label-sm text-label-sm uppercase">
                          {log.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {!isCompany && ['submitted', 'corrected'].includes(log.status) && (
                          <button
                            onClick={() => openEditModal(log)}
                            className="bg-primary-container text-on-primary-container border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm px-3 py-1.5 uppercase hover:neo-active flex items-center justify-center gap-1 mx-auto"
                          >
                            <span className="material-symbols-outlined fill-icon text-[16px]">edit_document</span>
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Edit Request Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-on-background/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface border-4 border-on-background neo-shadow max-w-lg w-full flex flex-col max-h-[95vh] overflow-hidden">
            <div className="border-b-4 border-on-background p-4 flex justify-between items-center bg-warning/20">
              <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2">
                <span className="material-symbols-outlined fill-icon text-warning">edit_document</span>
                Request Log Correction
              </h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center border-2 border-on-background bg-error-container text-danger hover:bg-danger hover:text-on-error transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handlePreSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-primary-container/20 border-2 border-primary-container p-3 font-body-md text-body-md text-on-background flex items-start gap-2">
                <span className="material-symbols-outlined fill-icon text-primary text-[20px] shrink-0">info</span>
                <span>Submitting this request will queue an adjustment for company review. The log will remain as "{selectedLog?.status}" until approved.</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm uppercase text-secondary">
                    Proposed Acc Qty <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newAcc}
                    onChange={e => { const v = parseInt(e.target.value); setNewAcc(Number.isNaN(v) ? '' : v); }}
                    className="border-2 border-on-background neo-shadow-sm p-3 font-data-md text-data-md bg-surface-container-low focus:outline-none focus:shadow-[2px_2px_0px_#1A1A1A]"
                  />
                  <span className="font-label-sm text-[11px] text-on-surface-variant">Current: {selectedLog?.acceptedQty}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm uppercase text-secondary">
                    Proposed Rej Qty <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newRej}
                    onChange={e => { const v = parseInt(e.target.value); setNewRej(Number.isNaN(v) ? '' : v); }}
                    className="border-2 border-on-background neo-shadow-sm p-3 font-data-md text-data-md bg-surface-container-low focus:outline-none focus:shadow-[2px_2px_0px_#1A1A1A]"
                  />
                  <span className="font-label-sm text-[11px] text-on-surface-variant">Current: {selectedLog?.rejectedQty}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm uppercase text-secondary">
                  Reason for Correction <span className="text-danger">*</span>
                </label>
                <textarea
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="border-2 border-on-background neo-shadow-sm p-3 font-body-md text-body-md h-24 bg-surface-container-low focus:outline-none focus:shadow-[2px_2px_0px_#1A1A1A] resize-none"
                  placeholder="Explain why the production numbers need adjustment..."
                />
              </div>

              <button
                disabled={submitting}
                type="submit"
                className="mt-2 bg-primary text-on-primary border-2 border-on-background neo-shadow font-label-sm text-label-sm uppercase py-3.5 hover:neo-active disabled:opacity-50 flex justify-center items-center gap-2"
              >
                <span className="material-symbols-outlined fill-icon text-[18px]">send</span>
                {submitting ? 'Submitting...' : 'Review & Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmSubmit}
        severity="info"
        title="Confirm Log Correction Request"
        description={`You are requesting to change Accepted yield from ${selectedLog?.acceptedQty} → ${newAcc} and Rejected from ${selectedLog?.rejectedQty} → ${newRej}. This request will be sent to the company administrator for approval.`}
        confirmLabel="Submit Request"
        cancelLabel="Go Back"
        loading={submitting}
        onConfirm={handleRequestEdit}
        onCancel={() => setConfirmSubmit(false)}
      />
    </div>
  );
}
