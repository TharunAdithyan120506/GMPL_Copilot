import { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { EditRequestRepository } from '../repositories/editRequest.repository';
import { db } from '../lib/db';
import { SkeletonTable, FreshnessLabel } from '../components/Skeleton';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface EditRequest {
  id: string; vendorId: string; dailyProductionLogId: string;
  requestedChanges: any; reason: string; status: string;
  vendor: { name: string; code: string | null; };
  dailyProductionLog: { id: string; logDate: string; acceptedQty: number; rejectedQty: number; };
}

export function EditRequests() {
  const { user } = useAuth();
  const isCompany = user?.role === 'company';
  const { isOnline } = useSyncStatus();
  const { toast } = useToast();

  const { data: requests, isFirstLoad, lastSyncedAt } = useLiveQuery(
    () => EditRequestRepository.getAll() as any,
    (force) => EditRequestRepository.refresh(force),
    db.editRequests as any,
    'editRequests',
  );

  const [filter, setFilter] = useState<'pending' | 'history'>('pending');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; reqId: string; decision: 'approved' | 'rejected'; note: string;
  }>({ open: false, reqId: '', decision: 'approved', note: '' });

  const displayed = (requests as EditRequest[]).filter(r =>
    filter === 'pending' ? r.status === 'pending' : r.status !== 'pending'
  );

  const openConfirm = (req: EditRequest, decision: 'approved' | 'rejected') => {
    setConfirmDialog({ open: true, reqId: req.id, decision, note: '' });
  };

  const handleDecide = async () => {
    const { reqId, decision, note } = confirmDialog;
    if (!isCompany) return;
    setConfirmDialog(d => ({ ...d, open: false }));
    setActioningId(reqId);
    try {
      await EditRequestRepository.decide(reqId, decision, note || undefined);
      toast.success(decision === 'approved' ? 'Edit request approved — log has been corrected.' : 'Edit request rejected.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update request.');
    } finally { setActioningId(null); }
  };

  const pendingCount = (requests as EditRequest[]).filter(r => r.status === 'pending').length;

  return (
    <div className="flex-1 w-full p-4 md:p-6 flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-background mb-2">
            {isCompany ? 'Approval Queue' : 'My Edit Requests'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {isCompany ? 'Review vendor edit requests for production logs.' : 'Track the status of your requested log adjustments.'}
          </p>
          <FreshnessLabel lastSyncedAt={lastSyncedAt} isOnline={isOnline} className="mt-1" />
        </div>
        {/* Filter tabs */}
        <div className="flex items-center bg-surface border-2 border-on-background neo-shadow-sm overflow-hidden shrink-0">
          <button onClick={() => setFilter('pending')}
            className={`px-5 py-2 font-label-sm text-label-sm uppercase transition-colors ${filter === 'pending' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
            Pending {pendingCount > 0 && <span className="ml-1 bg-warning text-on-background text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pendingCount}</span>}
          </button>
          <button onClick={() => setFilter('history')}
            className={`px-5 py-2 font-label-sm text-label-sm uppercase border-l-2 border-on-background transition-colors ${filter === 'history' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
            History
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4">
        {isFirstLoad ? (
          <SkeletonTable cols={3} rows={4} />
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant bg-surface border-2 border-on-background">
            <span className="material-symbols-outlined text-[56px]">
              {filter === 'pending' ? 'check_circle' : 'history'}
            </span>
            <p className="font-body-md text-body-md">
              {filter === 'pending' ? 'No pending requests — all caught up!' : 'No historical requests.'}
            </p>
          </div>
        ) : (
          (displayed as EditRequest[]).map(req => {
            const isPending = req.status === 'pending';
            const isActioning = actioningId === req.id;
            return (
              <div key={req.id} className={`bg-surface border-2 border-on-background neo-shadow-sm ${!isPending ? 'opacity-70' : ''}`}>
                {/* Card header */}
                <div className={`flex flex-wrap items-center gap-3 px-5 py-3 border-b-2 border-on-background ${isPending ? 'bg-warning/10' : req.status === 'approved' ? 'bg-success/10' : 'bg-error-container/20'}`}>
                  <span className={`border-2 border-on-background px-2 py-0.5 font-label-sm text-label-sm flex items-center gap-1.5 ${isPending ? 'bg-warning/20 text-on-background' : req.status === 'approved' ? 'bg-success text-on-primary' : 'bg-danger text-on-error'}`}>
                    <span className="material-symbols-outlined fill-icon text-[14px]">
                      {isPending ? 'pending_actions' : req.status === 'approved' ? 'check_circle' : 'cancel'}
                    </span>
                    {req.status.toUpperCase()}
                  </span>
                  <span className="font-data-md text-data-md text-secondary">Req #{req.id.substring(0, 8).toUpperCase()}</span>
                  <span className="ml-auto font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">factory</span>
                    {req.vendor?.code} — {req.vendor?.name}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5 flex flex-col lg:flex-row gap-6">
                  {/* Left: Reason */}
                  <div className="flex-1">
                    <h3 className="font-headline-md text-headline-md mb-3">Production Log Adjustment</h3>
                    <div className="bg-surface-container-low border border-outline-variant p-4">
                      <span className="font-label-sm text-label-sm text-secondary uppercase block mb-1">Vendor's Reason</span>
                      <p className="font-body-md text-body-md text-on-background">{req.reason}</p>
                    </div>
                  </div>

                  {/* Right: Comparison + actions */}
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-error-container/20 border-2 border-on-background p-4 text-center">
                        <span className="font-label-sm text-label-sm text-danger uppercase block mb-2">Current</span>
                        <div className="font-data-md text-data-md line-through text-on-surface-variant">Acc: {req.dailyProductionLog?.acceptedQty || 0}</div>
                        <div className="font-data-md text-data-md line-through text-on-surface-variant">Rej: {req.dailyProductionLog?.rejectedQty || 0}</div>
                      </div>
                      <div className="bg-success/10 border-2 border-on-background p-4 text-center relative">
                        <span className="font-label-sm text-label-sm text-success uppercase block mb-2">Proposed</span>
                        <div className="font-data-lg text-data-lg font-bold text-on-background">{req.requestedChanges?.acceptedQty ?? req.dailyProductionLog?.acceptedQty}</div>
                        <div className="font-data-md text-data-md text-on-surface-variant">Rej: {req.requestedChanges?.rejectedQty ?? req.dailyProductionLog?.rejectedQty}</div>
                      </div>
                    </div>

                    {/* Company actions */}
                    {isCompany && isPending && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => openConfirm(req, 'approved')}
                          disabled={isActioning}
                          className="flex-1 bg-success text-on-primary border-2 border-on-background p-3 font-label-sm text-label-sm uppercase neo-shadow-sm hover:neo-active disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isActioning ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined fill-icon text-[18px]">check_circle</span>}
                          Approve
                        </button>
                        <button
                          onClick={() => openConfirm(req, 'rejected')}
                          disabled={isActioning}
                          className="flex-1 bg-surface text-danger border-2 border-on-background p-3 font-label-sm text-label-sm uppercase neo-shadow-sm hover:bg-error-container/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined fill-icon text-[18px]">cancel</span>
                          Reject
                        </button>
                      </div>
                    )}
                    {!isCompany && (
                      <div className="text-right">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                          {isPending ? 'Awaiting admin review...' : `Final status: ${req.status}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Approve/Reject confirmation */}
      <ConfirmDialog
        open={confirmDialog.open}
        severity={confirmDialog.decision === 'approved' ? 'info' : 'danger'}
        title={confirmDialog.decision === 'approved' ? 'Approve This Edit?' : 'Reject This Edit?'}
        description={
          confirmDialog.decision === 'approved'
            ? 'Approving will immediately correct the production log, update the raw material balance, and adjust the mould shot count. This cannot be undone.'
            : 'Rejecting will close this request. The original log values will remain unchanged.'
        }
        confirmLabel={confirmDialog.decision === 'approved' ? 'Approve & Apply' : 'Reject Request'}
        cancelLabel="Go Back"
        noteField={{
          label: 'Decision Note (optional)',
          placeholder: 'Add a note for the vendor...',
          value: confirmDialog.note,
          onChange: (v) => setConfirmDialog(d => ({ ...d, note: v })),
        }}
        onConfirm={handleDecide}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
