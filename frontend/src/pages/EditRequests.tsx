import { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { EditRequestRepository } from '../repositories/editRequest.repository';
import { db } from '../lib/db';
import { SkeletonTable, FreshnessLabel } from '../components/Skeleton';
import { useSyncStatus } from '../hooks/useSyncStatus';

interface EditRequest {
  id: string;
  vendorId: string;
  dailyProductionLogId: string;
  requestedChanges: any;
  reason: string;
  status: string;
  vendor: {
    name: string;
    code: string | null;
  };
  dailyProductionLog: {
    id: string;
    logDate: string;
    acceptedQty: number;
    rejectedQty: number;
  };
}

export function EditRequests() {
  const { user } = useAuth();
  const isCompany = user?.role === 'company';
  const { isOnline } = useSyncStatus();

  // ── Cache-first: reads IndexedDB instantly, background-refreshes from server ──
  const { data: requests, isFirstLoad, lastSyncedAt } = useLiveQuery(
    () => EditRequestRepository.getAll() as any,
    (force) => EditRequestRepository.refresh(force),
    db.editRequests as any,
    'editRequests',
  );

  const [actioningId, setActioningId] = useState<string | null>(null);

  const handleDecide = async (id: string, status: 'approved' | 'rejected') => {
    if (!isCompany) return;
    
    setActioningId(id);
    try {
      await EditRequestRepository.decide(id, status);
    } catch (error) {
      console.error('Failed to update request:', error);
      alert('Failed to update request.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="flex-1 w-full p-margin flex flex-col gap-gutter overflow-y-auto">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-margin gap-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-background mb-2">
            {isCompany ? 'Approval Queue' : 'My Edit Requests'}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {isCompany 
              ? 'Review vendor edit requests for production logs and material usage.'
              : 'Track the status of your requested log adjustments.'}
          </p>
          <FreshnessLabel lastSyncedAt={lastSyncedAt} isOnline={isOnline} className="mt-1" />
        </div>
        <div className="flex items-center gap-4 bg-surface border-2 border-on-background p-1 neo-shadow-sm">
          <button className="bg-primary-container text-on-primary-container font-label-sm text-label-sm px-6 py-2 border-2 border-transparent">
            Pending ({requests.filter((r: any) => r.status === 'pending').length})
          </button>
          <button className="text-on-surface-variant hover:bg-surface-container-low font-label-sm text-label-sm px-6 py-2 transition-colors">
            History
          </button>
        </div>
      </div>

      {/* Approval Queue List */}
      <div className="flex flex-col gap-bento-gap">
        {isFirstLoad ? (
          <SkeletonTable cols={3} rows={4} />
        ) : requests.length === 0 ? (
          <div className="p-4 font-body-md bg-surface border-2 border-on-background">No edit requests found.</div>
        ) : (
          (requests as EditRequest[]).map(req => {
            const isPending = req.status === 'pending';
            return (
              <div key={req.id} className={`bg-surface border-2 border-on-background p-6 neo-shadow ${!isPending ? 'opacity-70' : ''}`}>
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  {/* Left Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      {isPending ? (
                        <span className="bg-warning/20 border-2 border-on-background px-3 py-1 font-label-sm text-label-sm text-on-background flex items-center gap-2 w-fit">
                          <span className="material-symbols-outlined fill-icon text-[16px]">pending_actions</span>
                          Pending Review
                        </span>
                      ) : (
                        <span className={`border-2 border-on-background px-3 py-1 font-label-sm text-label-sm flex items-center gap-2 w-fit ${req.status === 'approved' ? 'bg-success text-on-primary' : 'bg-danger text-on-error'}`}>
                          <span className="material-symbols-outlined fill-icon text-[16px]">
                            {req.status === 'approved' ? 'check_circle' : 'cancel'}
                          </span>
                          {req.status.toUpperCase()}
                        </span>
                      )}
                      <span className="font-data-md text-data-md text-secondary">Req #{req.id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    
                    <h3 className="font-headline-md text-headline-md mb-2">Production Log Adjustment</h3>
                    <div className="flex items-center gap-2 mb-6 font-body-md text-body-md text-on-surface-variant">
                      <span className="material-symbols-outlined text-[20px]">factory</span>
                      Vendor: <strong>{req.vendor?.code} ({req.vendor?.name})</strong>
                    </div>

                    {/* Reason */}
                    <div className="bg-surface-container-low border border-outline-variant p-4 rounded-sm">
                      <span className="font-label-sm text-label-sm text-secondary uppercase block mb-1">Reason for Change</span>
                      <p className="font-body-md text-body-md text-on-background">{req.reason}</p>
                    </div>
                  </div>

                  {/* Right Comparison & Actions */}
                  <div className="flex-1 flex flex-col justify-between">
                    {/* Comparison */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-error-container/30 border-2 border-on-background p-4 text-center">
                        <span className="font-label-sm text-label-sm text-error uppercase block mb-2">Original Value</span>
                        <div className="font-data-lg text-data-lg line-through text-on-surface-variant mb-1">
                          Acc: {req.dailyProductionLog?.acceptedQty || 0}
                        </div>
                        <div className="font-data-lg text-data-lg line-through text-on-surface-variant">
                          Rej: {req.dailyProductionLog?.rejectedQty || 0}
                        </div>
                      </div>
                      <div className="bg-success/10 border-2 border-on-background p-4 text-center relative">
                        <span className="absolute -top-3 -right-3 bg-surface border-2 border-on-background rounded-full w-8 h-8 flex items-center justify-center text-success">
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </span>
                        <span className="font-label-sm text-label-sm text-success uppercase block mb-2">Proposed Value</span>
                        <div className="font-data-lg text-data-lg font-bold text-on-background mb-1">
                          Acc: {req.requestedChanges?.acceptedQty ?? req.dailyProductionLog?.acceptedQty}
                        </div>
                        <div className="font-data-lg text-data-lg font-bold text-on-background">
                          Rej: {req.requestedChanges?.rejectedQty ?? req.dailyProductionLog?.rejectedQty}
                        </div>
                      </div>
                    </div>

                    {/* Actions (Only Company sees Approve/Reject) */}
                    {isCompany && isPending && (
                      <div className="flex gap-4">
                        <button 
                          onClick={() => handleDecide(req.id, 'approved')}
                          disabled={actioningId === req.id}
                          className="flex-1 bg-success text-on-primary border-2 border-on-background p-4 font-label-sm text-label-sm uppercase tracking-wider neo-shadow-sm hover:neo-active hover:shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined fill-icon">check_circle</span>
                          Approve Change
                        </button>
                        <button 
                          onClick={() => handleDecide(req.id, 'rejected')}
                          disabled={actioningId === req.id}
                          className="flex-1 bg-surface text-danger border-2 border-on-background p-4 font-label-sm text-label-sm uppercase tracking-wider neo-shadow-sm hover:neo-active hover:shadow-[2px_2px_0px_#1A1A1A] flex items-center justify-center gap-2 hover:bg-error-container/20 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined fill-icon">cancel</span>
                          Reject
                        </button>
                      </div>
                    )}
                    
                    {!isCompany && (
                      <div className="text-right">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                          {isPending ? 'Waiting for admin approval...' : `Status: ${req.status}`}
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
    </div>
  );
}
