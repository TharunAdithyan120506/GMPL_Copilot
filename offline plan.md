# GMPL Copilot — Offline-First Architecture & Sync Implementation Plan (Production Ready)

**Version:** 2.0
**Status:** Production Architecture
**Goal:** Transform GMPL Copilot into a local-first ERP that works seamlessly online and offline while maintaining enterprise-grade synchronization, security, and scalability.

---

# 1. Architecture Principles

## Core Philosophy

```
UI
│
▼
Repository Layer
│
├── Read → Local Database (IndexedDB)
├── Write → Local Database + Sync Queue
│
▼
Background Sync Engine
│
▼
Supabase PostgreSQL
```

The UI **never waits for the network**.

All pages read from the local database first.

Synchronization happens asynchronously in the background.

---

## Design Goals

* Instant page navigation (<50ms)
* Offline-first
* Background synchronization
* Automatic conflict detection
* No loading screens after first sync
* Mobile-ready architecture
* Enterprise-grade maintainability

---

# 2. Technology Stack

| Layer           | Technology           |
| --------------- | -------------------- |
| Frontend        | React + Next.js      |
| HTTP            | Axios                |
| Local Database  | Dexie.js (IndexedDB) |
| Sync Engine     | Custom               |
| Backend         | Supabase             |
| Auth            | Supabase Auth        |
| Realtime        | Supabase Realtime    |
| Offline Storage | IndexedDB            |
| Draft Storage   | IndexedDB            |
| Background Sync | Custom Scheduler     |

> **TanStack Query intentionally omitted** to keep a single repository-driven data flow.

---

# 3. Project Structure

```
src/

lib/
    db.ts
    connectivity.ts

sync/
    queue.ts
    push.ts
    pull.ts
    scheduler.ts
    conflicts.ts
    network.ts

repositories/
    vendor.repository.ts
    material.repository.ts
    mould.repository.ts
    dashboard.repository.ts
    logs.repository.ts
    editRequest.repository.ts

hooks/
    useOfflineData.ts
    useSyncStatus.ts
    useFormDraft.ts

contexts/
    SyncContext.tsx

components/
    OfflineBanner.tsx
    SyncIndicator.tsx
```

---

# 4. Repository Layer (Single Source of Truth)

Repositories become the only way to access data.

```
React Component

↓

Hook

↓

Repository

↓

IndexedDB

↓

Sync Engine

↓

Supabase
```

Example:

```
VendorRepository

getAll()

getById()

create()

update()

delete()

sync()
```

Benefits:

* UI never knows where data comes from
* Easy testing
* Easy migration to React Native
* Clean separation of concerns

---

# 5. Local Database (Dexie)

Database

```
GMPL_COPILOT
```

Tables

```
users

vendors

materials

moulds

machines

production_logs

edit_requests

notifications

dashboard_cache

analytics_cache

draft_forms

pending_sync

sync_metadata

settings
```

Each table contains:

```
id

createdAt

updatedAt

version

syncStatus

lastSyncedAt

deletedAt
```

---

# 6. Sync Metadata

Dedicated metadata table

```
sync_metadata

entity

lastSyncedAt

lastPull

lastPush

lastError

cacheExpiry
```

Used to determine refresh requirements.

---

# 7. Connectivity Manager

Responsibilities

* Detect online/offline
* Notify Sync Engine
* Trigger retries
* Notify UI
* Trigger background refresh

Singleton service.

---

# 8. Generic Sync Queue

Queue stores generic jobs.

```
Job

id

entity

entityId

operation

payload

mutationId

retryCount

status

createdAt

updatedAt
```

Operations

```
CREATE

UPDATE

DELETE

APPROVE

REJECT
```

No feature-specific queues.

Everything goes through one pipeline.

---

# 9. Sync Engine

Split into independent modules.

```
sync/

queue.ts

push.ts

pull.ts

scheduler.ts

conflicts.ts

network.ts
```

Responsibilities

## Push

Local

↓

Server

## Pull

Server

↓

Local

## Conflict Detection

Compare versions

Resolve

## Scheduler

Runs periodically

## Queue

Processes pending jobs

## Network

Connectivity detection

---

# 10. Background Scheduler

Triggers sync on

* App launch
* Browser focus
* Internet reconnect
* Manual refresh
* Every 60 seconds (configurable)

Never blocks UI.

---

# 11. Offline-First Data Flow

Page opens

↓

Read IndexedDB

↓

Render immediately

↓

Repository checks cache policy

↓

Background refresh if required

↓

Update IndexedDB

↓

UI updates automatically

---

# 12. Cache Policies

Different entities refresh differently.

| Entity         | Cache Policy |
| -------------- | ------------ |
| Vendors        | 10 min       |
| Materials      | 10 min       |
| Moulds         | 10 min       |
| Dashboard KPIs | 30 sec       |
| Notifications  | 15 sec       |
| Analytics      | 5 min        |
| Settings       | 1 hour       |

Repositories enforce these rules.

---

# 13. Dashboard Strategy

Dashboard is **not** cached as one object.

Instead cache

```
Production KPI

Inventory KPI

Machine KPI

Vendor KPI

Approvals

Notifications

Recent Activity
```

Widgets refresh independently.

No full-page reload.

---

# 14. Offline Pages

Offline-first pages

* Vendors
* Materials
* Moulds
* Logs
* Edit Requests
* Dashboard
* Notifications
* Analytics
* Machine Data

Forms

* Production Log Entry
* Edit Requests
* Vendor Forms

Auto-save drafts locally.

---

# 15. Draft System

Every form

↓

Autosave

↓

IndexedDB

↓

Restore after refresh/crash

Drafts never synchronize until user submits.

---

# 16. Sync Status

States

🟢 Synced

* Everything uploaded
* Local cache fresh

🟡 Pending

* Offline
* Pending mutations
* Background sync running

🔴 Error

* Sync failed
* User can retry

Displayed globally.

---

# 17. Conflict Resolution

Different entities use different strategies.

## Read-only Data

* Vendors
* Materials
* Moulds

Server always wins.

---

## Production Logs

Append-only.

Never overwrite.

---

## Edit Requests

State machine.

Draft

↓

Submitted

↓

Approved / Rejected

No overwrites.

---

## Settings

Last-write-wins.

---

## Drafts

Local only.

Never conflict.

---

## Version Checking

Every entity includes

```
version
updatedAt
```

Conflict detection compares versions before applying updates.

---

# 18. Mutation Pipeline

User edits

↓

Repository updates IndexedDB

↓

UI updates instantly

↓

Create Queue Job

↓

Background upload

↓

Server success

↓

Mark synced

No blocking.

---

# 19. Retry Strategy

Exponential backoff with jitter.

```
Immediate

↓

2 sec

↓

4 sec

↓

8 sec

↓

16 sec

↓

30 sec (cap)

± random jitter
```

Avoids retry storms.

---

# 20. Mutation IDs

Every mutation gets

```
mutationId (UUID)
```

Prevents duplicate operations if retries occur after partial success.

---

# 21. Security

Frontend only stores data the authenticated user is authorized to access.

Backend enforces:

* Row Level Security
* Role-based access
* Permission checks

Logout

↓

Clear IndexedDB

↓

Clear memory

↓

Clear session

No sensitive data remains on shared devices.

---

# 22. Large Dataset Strategy

Cache

* Active vendors
* Active materials
* Active moulds
* Recent production logs (30 days)

Older data remains server-side.

---

# 23. Development Tools

Internal Sync Dev Panel

Displays

* Queue
* Retry count
* Pending jobs
* Failed jobs
* Conflicts
* Cache size
* Last sync
* Connectivity
* Sync duration

Development only.

---

# 24. Mobile Readiness

Business logic remains platform-independent.

```
Repositories

↓

Sync Engine

↓

Shared Business Logic

↓

Web
IndexedDB

Mobile
SQLite
```

Only storage implementation changes.

---

# 25. Production Readiness Checklist

## Infrastructure

* Dexie configured
* IndexedDB schema finalized
* Repository layer complete
* Connectivity manager complete

## Sync

* Push engine
* Pull engine
* Queue
* Scheduler
* Conflict detection
* Retry mechanism

## UI

* Offline banner
* Sync indicator
* Draft restore
* Background refresh

## Security

* RLS verified
* Permission checks complete
* Logout clears local storage

## Performance

* Instant navigation
* Cache policies
* Background refresh
* Widget-level dashboard updates

## Monitoring

* Sync metrics
* Error logs
* Queue diagnostics

---

# Final Architecture

```
                    React UI
                        │
                        ▼
                 Custom Hooks
                        │
                        ▼
               Repository Layer
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
  Dexie (IndexedDB)              Sync Queue
        │                               │
        └───────────────┬───────────────┘
                        ▼
                  Sync Engine
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
       Push       Pull     Scheduler
          │
          ▼
     Supabase PostgreSQL
          │
          ▼
    Supabase Realtime
```

---

# Expected User Experience

* Dashboard opens instantly after first sync.
* Sidebar navigation feels native (<50ms).
* Previously synced data remains available offline.
* Forms auto-save and recover after crashes.
* Users continue working without internet.
* Background synchronization happens automatically.
* No blank loading screens after initial synchronization.
* Clear sync status with pending/error indicators.
* Architecture is ready for future React Native clients using the same business logic.
