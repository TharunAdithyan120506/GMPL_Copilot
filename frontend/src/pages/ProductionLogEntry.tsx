import { useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { MouldRepository } from '../repositories/mould.repository';
import { LogRepository } from '../repositories/log.repository';
import { db } from '../lib/db';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { playSound } from '../lib/sound';

export function ProductionLogEntry() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = location.state?.from || '/';
  const returnLabel = location.state?.fromLabel || (returnPath === '/' ? 'Home' : returnPath === '/moulds' ? 'My Moulds' : 'Back');
  const handleReturn = () => navigate(returnPath);
  const handleReturnAfterSubmit = () => {
    if (typeof returnPath === 'string') {
      navigate(returnPath, { state: { justLogged: true } });
    } else {
      navigate(returnPath);
    }
  };

  const assignmentId = searchParams.get('assignmentId');

  const { data: moulds, isFirstLoad } = useLiveQuery<any>(
    () => MouldRepository.getAll() as any,
    (force) => MouldRepository.refresh(force),
    db.moulds as any,
    'moulds'
  );

  const mould = (moulds as any[]).find(m => m.assignments?.some((a: any) => a.id === assignmentId));
  const assignment = mould?.assignments?.find((a: any) => a.id === assignmentId);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const [acceptedQty, setAcceptedQty] = useState<number | ''>('');
  const [rejectedQty, setRejectedQty] = useState<number | ''>('');
  const [dispatchedQty, setDispatchedQty] = useState<number | ''>('');
  const [downtime, setDowntime] = useState(false);
  const [downtimeHours, setDowntimeHours] = useState<number | ''>('');
  const [downtimeMins, setDowntimeMins] = useState<number | ''>('');
  const [downtimeReason, setDowntimeReason] = useState('');

  const accepted = Number(acceptedQty) || 0;
  const rejected = Number(rejectedQty) || 0;
  const total = accepted + rejected;
  const cavityCount = Number(mould?.cavityCount) || 1;
  const isValidTotal = total > 0 && total % cavityCount === 0;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment || !mould) return;
    setError('');
    if (total === 0) {
      const msg = 'Please enter at least one accepted or rejected part.';
      setError(msg);
      toast.warning(msg);
      return;
    }
    if (total % cavityCount !== 0) {
      const msg = `Total parts (${total}) must be divisible by cavity count (${cavityCount}).`;
      setError(msg);
      toast.warning(msg);
      return;
    }
    setConfirmOpen(true);
  };

  const executeSubmit = async () => {
    if (!assignment || !mould) return;
    setSubmitting(true);
    setConfirmOpen(false);

    const totalDowntimeMinutes = downtime
      ? (Number(downtimeHours) || 0) * 60 + (Number(downtimeMins) || 0)
      : 0;

    try {
      const logPayload = {
        assignmentId: assignment.id,
        mouldId: assignment.mouldId,
        logDate: new Date().toISOString().split('T')[0],
        acceptedQty: accepted,
        rejectedQty: rejected,
        dispatchedQty: Number(dispatchedQty) || 0,
        downtimeMinutes: downtime ? totalDowntimeMinutes : 0,
        downtimeReason: downtime ? downtimeReason : undefined,
      };

      await LogRepository.createLog(logPayload);

      playSound('submit');
      toast.success('Production log submitted!', { silent: true }); // sound already played above
      handleReturnAfterSubmit();
    } catch (err: any) {
      const msg = err.message || 'Failed to submit log. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isFirstLoad) {
    return <div className="p-margin max-w-2xl mx-auto"><SkeletonCard /></div>;
  }

  if (!assignmentId || !assignment) {
    return (
      <div className="p-margin text-center flex flex-col items-center justify-center h-full gap-4">
        <span className="material-symbols-outlined text-[56px] text-warning">warning</span>
        <h2 className="font-headline-lg">No Mould Selected</h2>
        <p className="text-on-surface-variant">Go back to {returnLabel} and tap "Log Production".</p>
        <button onClick={handleReturn} className="mt-4 bg-primary-container text-on-primary-container border-2 border-on-background px-6 py-3 font-label-sm uppercase neo-shadow">
          Go to {returnLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-grow flex justify-center py-6 px-4 md:px-8 overflow-y-auto bg-background">
      <div className="w-full max-w-xl flex flex-col gap-5">

        {/* Page Header */}
        <div className="border-b-2 border-on-background pb-4">
          <button type="button" onClick={handleReturn} className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm uppercase mb-3 hover:text-on-background transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to {returnLabel}
          </button>
          <h1 className="font-display-lg text-[28px] font-black leading-tight text-on-background">
            Daily Log Entry
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="bg-primary-container text-on-primary-container border-2 border-on-background px-3 py-1 font-label-sm text-label-sm uppercase font-bold neo-shadow-sm">
              {assignment.mould?.code || mould?.code || 'Mould'}
            </span>
            <span className="font-body-md text-on-surface-variant">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-error-container border-2 border-danger p-4 flex items-start gap-3 neo-shadow-sm">
            <span className="material-symbols-outlined fill-icon text-danger mt-0.5 shrink-0">error</span>
            <p className="font-body-md text-danger font-bold">{error}</p>
          </div>
        )}

        <form className="flex flex-col gap-5" onSubmit={handlePreSubmit}>

          {/* Accepted Qty */}
          <div className="bg-surface border-2 border-on-background neo-shadow p-5">
            <label htmlFor="accepted-qty" className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-1">
              Accepted Parts <span className="text-success font-bold">✓ Good</span>
            </label>
            <p className="font-body-md text-body-md text-on-surface-variant mb-3">
              How many parts passed quality check?
            </p>
            <input
              id="accepted-qty"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="0"
              value={acceptedQty}
              onChange={e => setAcceptedQty(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
              className="w-full h-20 bg-surface-container-low border-2 border-on-background text-center text-[40px] font-black text-success focus:outline-none focus:border-success neo-shadow-sm transition-all"
            />
          </div>

          {/* Rejected Qty */}
          <div className="bg-surface border-2 border-on-background neo-shadow p-5">
            <label htmlFor="rejected-qty" className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-1">
              Rejected Parts <span className="text-danger font-bold">✗ Defects</span>
            </label>
            <p className="font-body-md text-body-md text-on-surface-variant mb-3">
              How many parts failed quality check?
            </p>
            <input
              id="rejected-qty"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="0"
              value={rejectedQty}
              onChange={e => setRejectedQty(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
              className="w-full h-20 bg-surface-container-low border-2 border-on-background text-center text-[40px] font-black text-danger focus:outline-none focus:border-danger neo-shadow-sm transition-all"
            />
          </div>

          {/* Live summary */}
          {total > 0 && (
            <div className={`border-2 ${isValidTotal ? 'border-success bg-success/10' : 'border-warning bg-warning/10'} p-4 flex items-center justify-between`}>
              <div className="font-body-md text-on-background">
                <span className="font-bold">{total.toLocaleString()}</span> total parts
                {!isValidTotal && (
                  <span className="text-warning block text-sm mt-0.5">
                    Must be divisible by {cavityCount} (cavity count)
                  </span>
                )}
              </div>
              {isValidTotal && (
                <span className="material-symbols-outlined text-success text-[28px]">check_circle</span>
              )}
            </div>
          )}

          {/* Dispatched Qty */}
          <div className="bg-surface border-2 border-on-background neo-shadow p-5">
            <label htmlFor="dispatched-qty" className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-1">
              Dispatched Today
            </label>
            <p className="font-body-md text-body-md text-on-surface-variant mb-3">
              Units sent to central warehouse today (optional).
            </p>
            <div className="flex items-center gap-3 bg-surface-container-low border-2 border-on-background neo-shadow-sm h-16 px-4">
              <span className="material-symbols-outlined text-on-surface-variant">local_shipping</span>
              <input
                id="dispatched-qty"
                type="number"
                inputMode="numeric"
                min="0"
                value={dispatchedQty}
                onChange={e => setDispatchedQty(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-full h-full bg-transparent border-none focus:ring-0 text-[28px] font-bold text-on-background outline-none"
              />
            </div>
          </div>

          {/* Downtime Toggle */}
          <div className="bg-surface border-2 border-on-background neo-shadow p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-headline-md text-on-background font-bold">Machine Downtime?</p>
                <p className="font-body-md text-on-surface-variant text-sm mt-1">
                  Did the machine stop or have delays today?
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={downtime}
                onClick={() => setDowntime(v => !v)}
                className={`relative w-20 h-11 rounded-full border-2 border-on-background transition-colors duration-200 neo-shadow-sm shrink-0 ${downtime ? 'bg-warning' : 'bg-surface-dim'}`}
              >
                <div className={`absolute top-1 w-8 h-8 rounded-full border-2 border-on-background transition-all duration-200 ${downtime ? 'left-9 bg-on-background' : 'left-1 bg-on-surface-variant'}`} />
              </button>
            </div>

            {downtime && (
              <div className="mt-5 pt-5 border-t-2 border-on-background flex flex-col gap-4">
                <div>
                  <label className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-2">
                    What caused it?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'machine', label: 'Machine Fault', icon: 'build' },
                      { value: 'mould', label: 'Mould Issue', icon: 'precision_manufacturing' },
                      { value: 'manpower', label: 'Manpower', icon: 'person_off' },
                      { value: 'power', label: 'Power Cut', icon: 'bolt' },
                      { value: 'other', label: 'Other Reason', icon: 'more_horiz' },
                    ].map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDowntimeReason(option.value)}
                        className={`flex items-center gap-2 p-3 border-2 transition-colors font-body-md text-sm text-left ${
                          downtimeReason === option.value
                            ? 'border-on-background bg-on-background text-surface neo-shadow'
                            : 'border-on-background bg-surface-container-low hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px] shrink-0">{option.icon}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-label-sm text-label-sm uppercase text-on-surface-variant mb-2">
                    How long was the downtime?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-label-sm text-[11px] uppercase text-on-surface-variant">Hours</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="24"
                        value={downtimeHours}
                        onChange={e => setDowntimeHours(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        className="w-full h-16 bg-surface-container-low border-2 border-on-background text-center text-[32px] font-black text-on-background focus:outline-none neo-shadow-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-label-sm text-[11px] uppercase text-on-surface-variant">Minutes</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="59"
                        value={downtimeMins}
                        onChange={e => setDowntimeMins(e.target.value === '' ? '' : Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                        placeholder="0"
                        className="w-full h-16 bg-surface-container-low border-2 border-on-background text-center text-[32px] font-black text-on-background focus:outline-none neo-shadow-sm"
                      />
                    </div>
                  </div>
                  {(Number(downtimeHours) > 0 || Number(downtimeMins) > 0) && (
                    <p className="mt-2 font-body-md text-sm text-on-surface-variant">
                      = {(Number(downtimeHours) || 0) * 60 + (Number(downtimeMins) || 0)} total minutes
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pb-8">
            <button
              type="submit"
              disabled={submitting || !assignment || !isValidTotal}
              className="w-full h-16 bg-primary-container border-2 border-on-background text-on-primary-container font-headline-md text-headline-md uppercase neo-shadow hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  Review &amp; Submit Log
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleReturn}
              disabled={submitting}
              className="w-full h-12 bg-surface border-2 border-on-background text-on-background font-label-sm text-label-sm uppercase neo-shadow-sm hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              Cancel
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        severity="info"
        title="Confirm Production Log"
        description={`Please verify today's numbers for mould "${assignment.mould?.code || mould?.code}":\n• Accepted: ${acceptedQty} parts\n• Rejected: ${rejectedQty} parts\n• Total Yield: ${Number(acceptedQty || 0) + Number(rejectedQty || 0)} parts\n• Dispatched: ${dispatchedQty || 0} units${downtime ? `\n• Downtime: ${(Number(downtimeHours) || 0) * 60 + (Number(downtimeMins) || 0)} minutes (${downtimeReason})` : ''}`}
        confirmLabel="Confirm & Submit"
        cancelLabel="Edit Numbers"
        loading={submitting}
        onConfirm={executeSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
