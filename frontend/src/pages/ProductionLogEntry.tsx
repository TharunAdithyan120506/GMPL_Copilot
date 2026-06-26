import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export function ProductionLogEntry() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const assignmentId = searchParams.get('assignmentId');

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [acceptedQty, setAcceptedQty] = useState(0);
  const [rejectedQty, setRejectedQty] = useState(0);
  const [dispatchedQty, setDispatchedQty] = useState<number | ''>('');
  
  const [downtime, setDowntime] = useState(false);
  const [downtimeMinutes, setDowntimeMinutes] = useState<number | ''>('');
  const [downtimeReason, setDowntimeReason] = useState('');

  useEffect(() => {
    if (!assignmentId) {
      setError('No mould selected. Please open My Moulds and choose Log Production for an assigned mould.');
      setLoading(false);
      return;
    }

    const fetchAssignment = async () => {
      try {
        const res = await api.get('/vendors/assignments');
        if (res.data && res.data.data) {
          const match = res.data.data.find((a: any) => a.id === assignmentId);
          if (match) {
            setAssignment(match);
          } else {
            setError('Assignment not found or unauthorized.');
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load assignment details.');
      } finally {
        setLoading(false);
      }
    };
    fetchAssignment();
  }, [assignmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;
    
    setSubmitting(true);
    setError('');

    try {
      // 1. Create Draft
      const draftPayload = {
        assignmentId: assignment.id,
        mouldId: assignment.mouldId,
        logDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        acceptedQty,
        rejectedQty,
        dispatchedQty: dispatchedQty || 0,
        downtimeMinutes: downtime ? (downtimeMinutes || 0) : 0,
        downtimeReason: downtime ? downtimeReason : null
      };

      const draftRes = await api.post('/logs', draftPayload);
      const logId = draftRes.data.data.id;

      // 2. Submit Draft (Atomic processing)
      // For idempotency key, we can generate a random UUID
      const idempotencyKey = crypto.randomUUID(); 
      await api.post(`/logs/${logId}/submit`, {}, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });

      alert('Production log submitted successfully!');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to submit log. Please check validations.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-margin font-body-md">Loading...</div>;

  return (
    <div className="flex-grow flex justify-center py-margin px-4 md:px-margin overflow-y-auto">
      <div className="w-full max-w-3xl flex flex-col gap-gutter">
        
        {/* Page Header */}
        <div className="flex flex-col gap-2 mb-4">
          <h1 className="font-headline-lg text-headline-lg text-on-background">
            Daily Log for <span className="text-deep-orange">{assignment?.mould?.code || 'Unknown Mould'}</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant">calendar_today</span>
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </p>
        </div>

        {error && (
          <div className="bg-error-container border-2 border-on-background p-4 flex items-start gap-3 rounded-DEFAULT mb-2">
            <span className="material-symbols-outlined fill-icon text-danger mt-0.5">error</span>
            <p className="font-body-md text-danger font-bold">{error}</p>
          </div>
        )}

        {/* Warning Badge */}
        <div className="bg-warning border-2 border-on-background neo-shadow p-4 flex items-start gap-3 rounded-DEFAULT mb-2">
          <span className="material-symbols-outlined fill-icon text-on-background mt-0.5">lock</span>
          <div>
            <h3 className="font-headline-md text-body-lg font-bold text-on-background mb-1">Final Submission Warning</h3>
            <p className="font-body-md text-body-md text-on-background">This entry will lock permanently after submission. Please verify all quantities before finalizing.</p>
          </div>
        </div>

        {/* The Form (Bento Layout) */}
        <form className="grid grid-cols-1 md:grid-cols-2 gap-bento-gap" onSubmit={handleSubmit}>
          
          {/* Accepted Qty */}
          <div className="bg-surface border-2 border-on-background neo-shadow p-6 rounded-DEFAULT flex flex-col gap-4">
            <label className="font-label-sm text-label-sm uppercase text-on-background">Accepted Quantity</label>
            <div className="flex items-center justify-between bg-surface-container-low border-2 border-on-background p-2 neo-shadow-sm h-[72px]">
              <button type="button" onClick={() => setAcceptedQty(Math.max(0, acceptedQty - 1))} className="w-12 h-12 flex items-center justify-center bg-surface border-2 border-on-background neo-shadow active:neo-active rounded-DEFAULT text-on-background">
                <span className="material-symbols-outlined">remove</span>
              </button>
              <input type="number" value={acceptedQty} onChange={(e) => setAcceptedQty(parseInt(e.target.value) || 0)} className="w-full text-center font-data-lg text-[48px] bg-transparent border-none focus:ring-0 text-success p-0 font-bold" min="0" />
              <button type="button" onClick={() => setAcceptedQty(acceptedQty + 1)} className="w-12 h-12 flex items-center justify-center bg-surface border-2 border-on-background neo-shadow active:neo-active rounded-DEFAULT text-on-background">
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>

          {/* Rejected Qty */}
          <div className="bg-surface border-2 border-on-background neo-shadow p-6 rounded-DEFAULT flex flex-col gap-4">
            <label className="font-label-sm text-label-sm uppercase text-on-background flex justify-between">
              <span>Rejected Quantity</span>
              <span className="text-danger">Critical Metric</span>
            </label>
            <div className="flex items-center justify-between bg-surface-container-low border-2 border-on-background p-2 neo-shadow-sm h-[72px]">
              <button type="button" onClick={() => setRejectedQty(Math.max(0, rejectedQty - 1))} className="w-12 h-12 flex items-center justify-center bg-surface border-2 border-on-background neo-shadow active:neo-active rounded-DEFAULT text-on-background">
                <span className="material-symbols-outlined">remove</span>
              </button>
              <input type="number" value={rejectedQty} onChange={(e) => setRejectedQty(parseInt(e.target.value) || 0)} className="w-full text-center font-data-lg text-[48px] bg-transparent border-none focus:ring-0 text-danger p-0 font-bold" min="0" />
              <button type="button" onClick={() => setRejectedQty(rejectedQty + 1)} className="w-12 h-12 flex items-center justify-center bg-surface border-2 border-on-background neo-shadow active:neo-active rounded-DEFAULT text-on-background">
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>

          {/* Downtime Section */}
          <div className="col-span-1 md:col-span-2 bg-surface border-2 border-on-background neo-shadow p-6 rounded-DEFAULT flex flex-col gap-6">
            <div className="flex items-center justify-between border-b-2 border-on-background pb-6">
              <div className="flex flex-col gap-1">
                <label className="font-headline-md text-headline-md text-on-background m-0">Record Downtime</label>
                <span className="font-body-md text-body-md text-on-surface-variant">Toggle if the machine experienced delays.</span>
              </div>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={downtime} onChange={(e) => setDowntime(e.target.checked)} />
                  <div className="block bg-surface-dim border-2 border-on-background w-16 h-10 rounded-full neo-shadow"></div>
                  <div className={`absolute left-1.5 top-1.5 w-7 h-7 rounded-full transition-transform duration-200 ${downtime ? 'translate-x-[100%] bg-primary-container' : 'bg-on-background'}`}></div>
                </div>
              </label>
            </div>
            
            {downtime && (
              <div className="flex flex-col md:flex-row gap-6 transition-opacity duration-300">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="font-label-sm text-label-sm uppercase text-on-background">Downtime Reason</label>
                  <div className="relative w-full h-[56px]">
                    <select 
                      value={downtimeReason}
                      onChange={(e) => setDowntimeReason(e.target.value)}
                      className="w-full h-full appearance-none bg-surface border-2 border-on-background neo-shadow-sm focus:outline-none focus:ring-0 rounded-DEFAULT px-4 font-body-lg text-body-lg text-on-background cursor-pointer"
                    >
                      <option disabled value="">Select Primary Reason</option>
                      <option value="manpower">Manpower Shortage</option>
                      <option value="machine">Machine Failure</option>
                      <option value="mould">Mould Issue/Repair</option>
                      <option value="power">Power Outage</option>
                      <option value="other">Other</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-background">
                      <span className="material-symbols-outlined">expand_more</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <label className="font-label-sm text-label-sm uppercase text-on-background">Duration (Minutes)</label>
                  <input 
                    type="number" 
                    value={downtimeMinutes}
                    onChange={(e) => setDowntimeMinutes(parseInt(e.target.value) || '')}
                    placeholder="0" 
                    className="w-full h-[56px] bg-surface border-2 border-on-background neo-shadow-sm focus:outline-none focus:ring-0 rounded-DEFAULT px-4 font-data-lg text-data-lg text-on-background cursor-text" 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Dispatched Qty */}
          <div className="col-span-1 md:col-span-2 bg-surface-container-low border-2 border-on-background neo-shadow p-6 rounded-DEFAULT flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col gap-2 w-full md:w-1/2">
              <label className="font-headline-md text-headline-md text-on-background">Dispatched Quantity</label>
              <p className="font-body-md text-body-md text-on-surface-variant">Number of accepted units sent to central logistics today.</p>
            </div>
            <div className="w-full md:w-1/2 flex items-center bg-surface border-2 border-on-background p-2 neo-shadow-sm h-[72px]">
              <span className="material-symbols-outlined text-on-background px-4">local_shipping</span>
              <input 
                type="number" 
                min="0" 
                value={dispatchedQty}
                onChange={(e) => setDispatchedQty(parseInt(e.target.value) || '')}
                placeholder="Enter amount" 
                className="w-full h-full bg-transparent border-none focus:ring-0 font-data-lg text-headline-md text-on-background px-2 outline-none" 
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-4 mt-4">
            <button type="button" onClick={() => navigate('/')} disabled={submitting} className="flex-1 h-16 bg-surface border-2 border-on-background text-on-background font-headline-md text-headline-md uppercase neo-shadow hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined">close</span> Cancel
            </button>
            <button type="submit" disabled={submitting || !assignment} className="flex-[2] h-16 bg-primary-container border-2 border-on-background text-on-primary-container font-headline-md text-headline-md uppercase neo-shadow hover:bg-surface-tint transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              <span className="material-symbols-outlined">send</span> {submitting ? 'Submitting...' : 'Submit Final Log'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
