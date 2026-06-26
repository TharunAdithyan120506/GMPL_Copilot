import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/useAuth';

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
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  
  // Edit form state
  const [newAcc, setNewAcc] = useState<number | ''>('');
  const [newRej, setNewRej] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { user } = useAuth();

  const fetchLogs = async () => {
    try {
      const res = await api.get('/logs'); // Both roles can use this, backend scopes automatically
      if (res.data && res.data.data) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const openEditModal = (log: ProductionLog) => {
    setSelectedLogId(log.id);
    setNewAcc(log.acceptedQty);
    setNewRej(log.rejectedQty);
    setReason('');
    setEditModalOpen(true);
  };

  const handleRequestEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogId || reason.trim() === '') return;
    
    setSubmitting(true);
    try {
      await api.post('/edit-requests', {
        dailyProductionLogId: selectedLogId,
        requestedChanges: {
          acceptedQty: newAcc,
          rejectedQty: newRej
        },
        reason
      });
      alert('Edit request submitted successfully. Waiting for company approval.');
      setEditModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to submit edit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 w-full p-margin flex flex-col gap-gutter relative">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-4 border-b-4 border-on-background border-dashed">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-background leading-none">
            {user?.role === 'company' ? 'Global Production Logs' : 'My Logs'}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            History of submitted production logs.
          </p>
        </div>
      </header>

      <div className="bg-surface border-2 border-on-background neo-shadow flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-surface-variant border-b-2 border-on-background">
              <tr>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest w-48">Date</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Mould</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Yield (Acc/Rej)</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Status</th>
                <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-on-background">
              {loading ? (
                <tr><td colSpan={5} className="p-4 text-center font-body-md">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center font-body-md">No logs found.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-4 font-data-md text-data-md">
                      {new Date(log.logDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-body-md text-body-md text-on-background font-medium">
                      {log.mould?.code} ({log.mould?.name})
                    </td>
                    <td className="p-4 font-data-md text-data-md text-secondary">
                      <span className="text-success">{log.acceptedQty}</span> / <span className="text-danger">{log.rejectedQty}</span>
                    </td>
                    <td className="p-4">
                      <span className="bg-surface-variant border-2 border-on-background px-2 py-1 font-label-sm text-label-sm uppercase">
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {user?.role === 'vendor' && ['submitted', 'corrected'].includes(log.status) && (
                        <button 
                          onClick={() => openEditModal(log)}
                          className="bg-primary-container text-on-primary-container border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm px-3 py-1 uppercase hover:neo-active"
                        >
                          Request Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Request Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-on-background/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-background neo-shadow max-w-lg w-full flex flex-col">
            <div className="border-b-4 border-on-background p-4 flex justify-between items-center bg-error-container">
              <h2 className="font-headline-md text-headline-md text-on-background flex items-center gap-2">
                <span className="material-symbols-outlined fill-icon text-danger">warning</span>
                Request Log Edit
              </h2>
              <button onClick={() => setEditModalOpen(false)} className="hover:bg-surface-variant p-1 rounded-full flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleRequestEdit} className="p-6 flex flex-col gap-4">
              <p className="font-body-md text-body-md">You are requesting an edit to a submitted log. This requires company approval.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-label-sm uppercase">Proposed Acc Qty</label>
                  <input type="number" required value={newAcc} onChange={e => setNewAcc(parseInt(e.target.value) || '')} className="border-2 border-on-background neo-shadow-sm p-2 font-data-md text-data-md focus:outline-none" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-label-sm uppercase">Proposed Rej Qty</label>
                  <input type="number" required value={newRej} onChange={e => setNewRej(parseInt(e.target.value) || '')} className="border-2 border-on-background neo-shadow-sm p-2 font-data-md text-data-md focus:outline-none" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-sm text-label-sm uppercase">Reason for Edit</label>
                <textarea required value={reason} onChange={e => setReason(e.target.value)} className="border-2 border-on-background neo-shadow-sm p-2 font-body-md text-body-md h-24 focus:outline-none resize-none" placeholder="Provide a detailed reason..."></textarea>
              </div>

              <button disabled={submitting} type="submit" className="mt-4 bg-primary text-on-primary border-2 border-on-background neo-shadow font-headline-md text-headline-md uppercase py-3 hover:bg-surface-tint disabled:opacity-50 flex justify-center items-center gap-2">
                <span className="material-symbols-outlined">send</span> {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
