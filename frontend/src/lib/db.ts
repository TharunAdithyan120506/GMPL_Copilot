/**
 * GMPL Copilot — IndexedDB via Dexie.js (v2)
 *
 * Version 2 adds:
 *  - notifications table (15s TTL, server-only)
 *  - analyticsCache table (5min TTL, server-wins)
 *  - settings table (1h TTL, last-write-wins)
 *  - Extended SyncMeta: lastPull, lastPush, lastError, cacheExpiry
 *  - Consistent _version + _syncStatus + _deletedAt on all entity types
 *
 * DB version bumped to 2 — Dexie handles migration automatically.
 */
import Dexie, { type Table } from 'dexie';

// ──────────────────────────────────────────────────────
// Shared sync fields — every cached entity carries these
// ──────────────────────────────────────────────────────

export interface SyncFields {
  _syncedAt: number;           // epoch ms of last server pull
  _version?: number;           // entity version for conflict detection
  _syncStatus?: 'synced' | 'pending' | 'conflict'; // per-row sync state
  _deletedAt?: number | null;  // soft-delete mirror from server
}

// ──────────────────────────────────────────────────────
// Entity types
// ──────────────────────────────────────────────────────

export interface CachedVendor extends SyncFields {
  id: string;
  code: string;
  name: string;
  isInternal: boolean;
  isActive: boolean;
  sharedLoginId: string | null;
}

export interface CachedMould extends SyncFields {
  id: string;
  code: string;
  name: string;
  cavityCount: number;
  lifecycleState: string;
  shotLifeLimit: number;
  shotCountAccumulated: number;
  assignments: any[];
}

export interface CachedMaterial extends SyncFields {
  id: string;
  code: string;
  name: string;
  unit: string;
  allocatedQty: number;
  consumedQty: number;
  lossQty: number;
  availableQty: number;
}

export interface CachedLog extends SyncFields {
  id: string;
  vendorId: string;
  mouldId: string;
  assignmentId: string;
  logDate: string;
  /** append-only: draft | submitted | corrected — never overwrite a submitted log */
  status: string;
  acceptedQty: number;
  rejectedQty: number;
  dispatchedQty: number;
  shotsRun: number;
  rmConsumedQty: number;
  downtimeMinutes: number | null;
  downtimeReason: string | null;
  mould: any;
  assignment: any;
  _isOptimistic?: boolean;
}

export interface CachedEditRequest extends SyncFields {
  id: string;
  vendorId: string;
  dailyProductionLogId: string;
  /** state-machine: pending | approved | rejected — never overwrite */
  status: string;
  reason: string;
  requestedChanges: any;
  vendor: any;
  dailyProductionLog: any;
  _isOptimistic?: boolean;
}

export interface CachedDashboard {
  id: 'singleton';
  data: any;
  _syncedAt: number;
}

/** §13: Widget-level dashboard cache — each KPI widget is independent. */
export interface DashboardWidget extends SyncFields {
  /** e.g. 'production', 'inventory', 'mould-life', 'vendor', 'notifications', 'approvals' */
  widgetId: string;
  data: any;
}

/** §5: Notifications — server-only, never mutated locally (15s TTL). */
export interface CachedNotification extends SyncFields {
  id: string;
  type: string;
  payload: any;
  status: string;    // 'pending' | 'sent' | 'read'
  createdAt: string;
}

/** §5: Analytics cache — server-wins, 5min TTL. Keyed by query hash/type. */
export interface CachedAnalytics extends SyncFields {
  /** e.g. 'production', 'raw-material', 'mould-life', 'downtime' */
  reportType: string;
  data: any;
  expiresAt: number; // epoch ms — repo checks this before re-fetching
}

/** §5: Settings — last-write-wins, 1h TTL. */
export interface CachedSettings extends SyncFields {
  key: string;
  value: any;
  updatedAt: string;
}

// ──────────────────────────────────────────────────────
// Sync Queue
// ──────────────────────────────────────────────────────

export type SyncJobStatus = 'pending' | 'in-flight' | 'done' | 'failed' | 'conflict';
export type ConflictStrategy = 'server-wins' | 'append-only' | 'state-machine' | 'local-only';

export interface SyncJob {
  id?: number;               // auto-increment PK
  mutationId: string;        // UUID — sent as Idempotency-Key, prevents duplicate processing
  method: 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  endpoint: string;
  payload: any;
  headers?: Record<string, string>;
  status: SyncJobStatus;
  attempts: number;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;
  createdAt: number;
  error: string | null;
  entityType: string;        // e.g. 'vendor', 'log', 'editRequest'
  entityId: string;          // server or temp local ID
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSITION';
  conflictStrategy: ConflictStrategy;
  userId: string;            // The ID of the user who created this mutation
}

// ──────────────────────────────────────────────────────
// Form Drafts
// ──────────────────────────────────────────────────────

export interface FormDraft {
  key: string;  // e.g. 'production-log-new'
  data: any;
  savedAt: number;
}

// ──────────────────────────────────────────────────────
// Sync Metadata (§6 — extended)
// ──────────────────────────────────────────────────────

export interface SyncMeta {
  table: string;
  lastSyncedAt: number;      // last successful pull
  lastPull: number | null;   // timestamp of last pull attempt
  lastPush: number | null;   // timestamp of last push attempt
  lastError: string | null;  // last error message (null = no error)
  cacheExpiry: number | null;// epoch ms when cache expires (null = no expiry)
  ttlMs: number;
  conflictStrategy: ConflictStrategy;
}

// ──────────────────────────────────────────────────────
// Database class
// ──────────────────────────────────────────────────────

class GMPLDatabase extends Dexie {
  // v1 tables
  vendors!: Table<CachedVendor, string>;
  moulds!: Table<CachedMould, string>;
  materials!: Table<CachedMaterial, string>;
  logs!: Table<CachedLog, string>;
  editRequests!: Table<CachedEditRequest, string>;
  dashboard!: Table<CachedDashboard, string>;
  syncQueue!: Table<SyncJob, number>;
  formDrafts!: Table<FormDraft, string>;
  syncMeta!: Table<SyncMeta, string>;

  // v2 additions
  dashboardWidgets!: Table<DashboardWidget, string>;
  notifications!: Table<CachedNotification, string>;
  analyticsCache!: Table<CachedAnalytics, string>;
  settings!: Table<CachedSettings, string>;

  constructor() {
    super('GMPLCopilotDB');

    // ── Version 1 (original) ────────────────────────────────────────
    this.version(1).stores({
      vendors:      'id, code, name, _syncedAt',
      moulds:       'id, code, lifecycleState, _syncedAt',
      materials:    'id, code, _syncedAt',
      logs:         'id, vendorId, mouldId, assignmentId, status, logDate, _syncedAt',
      editRequests: 'id, vendorId, status, _syncedAt',
      dashboard:    'id',
      syncQueue:    '++id, status, nextRetryAt, createdAt',
      formDrafts:   'key, savedAt',
      syncMeta:     'table',
    });

    // ── Version 2 ────────────────────────────────────────────────────
    this.version(2).stores({
      vendors:          'id, code, name, _syncedAt, _version',
      moulds:           'id, code, lifecycleState, _syncedAt, _version',
      materials:        'id, code, _syncedAt',
      logs:             'id, vendorId, mouldId, assignmentId, status, logDate, _syncedAt',
      editRequests:     'id, vendorId, status, _syncedAt',
      dashboard:        'id',
      syncQueue:        '++id, status, nextRetryAt, createdAt, entityType',
      formDrafts:       'key, savedAt',
      syncMeta:         'table',
      dashboardWidgets: 'widgetId, _syncedAt',
      notifications:    'id, type, status, createdAt, _syncedAt',
      analyticsCache:   'reportType, expiresAt, _syncedAt',
      settings:         'key, updatedAt',
    });

    // ── Version 3 ────────────────────────────────────────────────────
    // Adds: userId to syncQueue index, name to moulds/materials index
    this.version(3).stores({
      vendors:          'id, code, name, _syncedAt, _version',
      moulds:           'id, code, name, lifecycleState, _syncedAt, _version',
      materials:        'id, code, name, _syncedAt',
      logs:             'id, vendorId, mouldId, assignmentId, status, logDate, _syncedAt',
      editRequests:     'id, vendorId, status, _syncedAt',
      dashboard:        'id',
      syncQueue:        '++id, status, nextRetryAt, createdAt, entityType, userId',
      formDrafts:       'key, savedAt',
      syncMeta:         'table',
      dashboardWidgets: 'widgetId, _syncedAt',
      notifications:    'id, type, status, createdAt, _syncedAt',
      analyticsCache:   'reportType, expiresAt, _syncedAt',
      settings:         'key, updatedAt',
    });
  }
}

export const db = new GMPLDatabase();
