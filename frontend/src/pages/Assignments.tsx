import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface Assignment {
  id: string;
  mouldId: string;
  vendorId: string;
  rmRemainingQty: number;
  status: string;
  mould: {
    name: string;
    code: string | null;
  };
}

export function Assignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await api.get('/vendors/assignments'); // Assuming this endpoint exists or similar
        if (res.data && res.data.data) {
          setAssignments(res.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch assignments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  if (user?.role === 'company') {
    return <div className="p-margin text-danger font-bold">Access Denied. Only vendors can view their assignments.</div>;
  }

  return (
    <div className="flex-1 w-full p-margin flex flex-col gap-gutter">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-4 border-b-4 border-on-background border-dashed">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-background leading-none">My Assignments</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Active moulds allocated to you and current raw material balances.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-bento-gap">
        {loading ? (
          <div className="font-body-md p-4">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <div className="font-body-md p-4 col-span-full">No active assignments found.</div>
        ) : (
          assignments.map(assignment => (
            <div key={assignment.id} className="bg-surface border-2 border-on-background neo-shadow p-6 flex flex-col justify-between hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_#1A1A1A] transition-all">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="inline-block bg-surface-container-high border-2 border-on-background px-2 py-1 font-label-sm text-label-sm mb-2 text-on-background">
                      {assignment.mould?.code || 'UNKNOWN'}
                    </span>
                    <h3 className="font-headline-md text-headline-md">{assignment.mould?.name}</h3>
                  </div>
                  <span className="bg-success text-on-background border-2 border-on-background px-3 py-1 font-label-sm text-label-sm flex items-center gap-1 uppercase tracking-wider">
                    ACTIVE
                  </span>
                </div>
                <div className="mb-6">
                  <div className="flex justify-between font-label-sm text-label-sm mb-1 uppercase">
                    <span>Remaining RM Balance</span>
                    <span className="font-data-md text-data-md">{Number(assignment.rmRemainingQty || 0).toLocaleString()} kg</span>
                  </div>
                </div>
              </div>
              <div className="border-t-2 border-on-background pt-4 mt-2">
                <button 
                  onClick={() => navigate(`/logs/new?assignmentId=${assignment.id}`)}
                  className="w-full bg-deep-orange text-surface border-2 border-on-background neo-shadow-sm font-label-sm text-label-sm uppercase py-3 hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Log Production
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
