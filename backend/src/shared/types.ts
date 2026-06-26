export interface AuthContext {
  userId: string;
  companyId: string;
  role: 'company' | 'vendor';
  vendorId?: string;
  permissions: string[];
}

export interface ApiSuccess<T> {
  data: T;
  meta: {
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string }[];
    requestId: string;
  };
}

export type LogStatus = 'draft' | 'submitted' | 'correction_pending' | 'corrected';
export type AssignmentStatus = 'active' | 'revoked' | 'completed';
export type MouldLifecycleState = 'active' | 'flagged_for_replacement' | 'in_repair' | 'retired';
export type EditRequestStatus = 'pending' | 'approved' | 'rejected';
export type RepairStatus = 'open' | 'in_progress' | 'reworked' | 'closed';
