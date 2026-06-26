# GMPL Copilot — Technical / Engineering PRD

**Product:** GMPL Copilot
**Owner:** Ganes MetPlast Private Limited (GMPL)
**Document type:** Engineering (Technical) PRD — the build spec
**Companion document:** Functional PRD (owns goals, roles, field lists, business rules, formulas, notification triggers — treated here as ground-truth input)

> **Scope of this document.** This is the layer *underneath* the product: architecture, data model, API surface, service/job design, AI system design, security, and build sequencing. It contains **no UI, visual design, branding, color, typography, or screen-by-screen detail** — that lives in the Design document. It does **not** re-litigate business workflows — that lives in the Functional PRD. Wherever a business formula or rule is needed, it is referenced by name and translated into a concrete technical mechanism; it is never re-derived here. Anything the Functional PRD has not finalized is listed as a blocking dependency in Chapter 19, never silently invented.
>
> **Tagging convention used throughout:**
> - **[V1]** = build now. **[Roadmap]** = design for, do not build.
> - Workflow steps are tagged **`automatic`**, **`human-approval-required`**, or **`background-job`**.

---

## 1. Vision & Architecture Principles

These are the non-negotiable principles specific to GMPL Copilot. Each exists because of a concrete property of *this* product, not as a generic best practice.

1. **Vendor authorization is enforced at the assignment level, server-side, never the user level. [V1]**
   A Vendor login is a single shared credential for an entire vendor *entity*, not a person. Therefore identity tells us nothing about scope — every Vendor-scoped query must filter by that vendor's `vendor_id` (a server-trusted claim) and, for production data, by the set of assignments owned by that vendor. The client is never trusted to supply its own scope.

2. **Every mutation on a core entity is attributable: who, when, before-state, after-state. [V1]**
   The single most important product goal is reducing GMPL↔vendor disputes. A production log, an RM deduction, or a revoked assignment that cannot be traced to an actor and a timestamp is worthless in a dispute. Audit is a first-class write path, not a logging afterthought.

3. **A submitted Daily Production Log is immutable except through the Edit Request workflow. [V1]**
   "One log per mould per vendor per day, corrections only via approved Edit Request" is the backbone of dispute resolution. This is enforced at two layers: a DB uniqueness constraint for the one-per-day rule, and an application-layer immutability guard for the no-silent-edits rule (Chapter 11 picks and justifies the mechanism).

4. **Modular monolith with hard domain boundaries — not microservices. [V1]**
   One company, ~10 internal users, 6–7 vendor entities, ~250 moulds. The operational cost and distributed-transaction complexity of microservices buys nothing at this scale. But modules communicate only through published service interfaces (never cross-module table reads), so any single module can later be extracted without a rewrite.

5. **API-first: the frontend and the AI Copilot are both *only* API consumers. [V1]**
   Neither the web client nor the AI layer ever touches the database directly. This keeps permission checks, validation, and audit in exactly one place (the Service layer) and makes the AI Copilot architecturally incapable of bypassing business rules.

6. **The AI Copilot is an isolated service that uses the same permission-checked read path as everyone else — it has no backdoor. [V1]**
   The AI Gateway calls a restricted, read-only reporting layer. It cannot reach raw transactional tables, cannot mutate any row, and is hard-blocked for any non-Company role *before* a request ever reaches the model. An AI assistant that could surface one vendor's data to another, or be prompt-injected into a destructive query, would destroy the trust the product depends on.

7. **Derived production values are snapshotted at submission, not recomputed on read. [V1]**
   RM consumed, irrecoverable loss, and accumulated shot count are computed once (using the Functional PRD's formulas) and stored as columns at the moment a log is submitted. A dispute must be resolvable against the numbers *as they were calculated that day*, even if a mould's spec is edited later.

8. **Strict layering, no shortcuts: UI → Feature → API → Service → Repository → Database. [V1]**
   No component skips a layer; no Feature or Controller talks to a Repository or the DB directly. This is what makes principles 2, 5, and 6 actually hold instead of being aspirational.

9. **Company-scoping is present from day one even with one company. [V1]**
   Every tenant-relevant table carries `company_id` now (with exactly one row in `companies`). Multi-company is then a config/migration change later, not a schema rewrite. We do not build multi-tenant *features* in V1; we just refuse to paint the schema into a corner.

10. **Build for today's load, design for tomorrow's. [V1]**
    No Redis, no external queue, no MFA, no offline-first PWA in V1 — none are justified by current scale (Chapters 10, 13). But each such deferral is explicit, and each chapter names what the V1 design already does to keep that door cheap to open.

---

## 2. Technology Stack

The prior-build stack is adopted as the default. Deviations are called out with a reason; there are no speculative additions "for future scale."

| Layer | Choice | Tag | Notes / justification |
|---|---|---|---|
| Frontend | React 18 + Vite + TypeScript, Vercel | [V1] | Unchanged from prior build. Pure API consumer. |
| Backend | Node + Express + TypeScript | [V1] | Unchanged. Hosts the modular monolith. |
| ORM | Prisma | [V1] | Typed client for all application (non-AI) data access. |
| Database | PostgreSQL via Supabase | [V1] | Unchanged. Supabase also provides Auth primitives and object storage (Chapter 14). |
| Background jobs | In-process scheduler (`node-cron`) + a Postgres-backed job table for the few async tasks (report generation, notification dispatch) | [V1] | **Deviation from "no queue": we add a lightweight Postgres-backed job table, *not* Redis/BullMQ.** Justification in Chapter 10 — V1 has only a handful of async tasks at trivial volume; a dedicated broker is unjustified, but a durable job row gives us retry/visibility without one. |
| AI layer | Separate AI Gateway service (in-repo module, isolated boundary) calling an external LLM provider's API | [V1] | The Gateway is its own module with no business-logic access. The model is reached only via HTTPS API; no model runs in-process. |
| AI query access | Raw SQL generation against a **whitelisted read-only view layer**, executed through a dedicated read-only Postgres role — *not* the Prisma client | [V1] | **Deviation, justified:** the AI generates ad-hoc analytical SQL that Prisma's typed client cannot express. We do not give the AI the application DB credentials; we give it a separate Postgres role whose grants are SELECT-only and scoped to the reporting views (Chapters 9, 11). |
| Reporting / PDF | Separate Python microservice (ReportLab), Railway | [V1] | Unchanged from prior build. Stateless; generates files on demand from data passed by the backend. |
| Hosting / infra | Vercel (frontend), Railway (PDF service + backend), Supabase (DB/Auth/Storage) | [V1] | Reuses the proven prior-build topology. |

No Redis, no Kafka/RabbitMQ, no Elasticsearch, no MFA provider in V1. Triggers that would justify each are named in Chapters 10 and 18.

---

## 3. System / Application Architecture

### 3.1 Layering and where the AI Gateway sits

```
                            ┌─────────────────────────────────────────────┐
                            │                  CLIENTS                     │
                            │   React Web App (Company + Vendor logins)    │
                            └───────────────────────┬─────────────────────┘
                                                    │  HTTPS / REST  /api/v1
                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND MONOLITH (Node/Express)                        │
│                                                                                    │
│   ┌──────────────┐                                          ┌───────────────────┐  │
│   │  FEATURE     │  (request orchestration, DTO assembly)   │   AI GATEWAY      │  │
│   │  LAYER       │                                          │   (isolated)      │  │
│   └──────┬───────┘                                          │  Prompt build →   │  │
│          │                                                  │  Perm check →     │  │
│          ▼                                                  │  Schema retrieve→ │  │
│   ┌──────────────┐   <── shared cross-cutting ──┐           │  SQL gen →        │  │
│   │  API LAYER   │   Auth · AuthZ · Audit ·      │           │  SQL validate →   │  │
│   │ (controllers)│   Notifications · Validation  │           │  execute →        │  │
│   └──────┬───────┘                               │           │  format           │  │
│          │                                       │           └─────────┬─────────┘  │
│          ▼                                       │                     │            │
│   ┌──────────────────────────────────────────────┐                    │ SELECT-only│
│   │             SERVICE LAYER                      │◄──── AI calls ─────┘ via the    │
│   │  (business rules, state machines, formulas,    │   the SAME read     read-only   │
│   │   permission checks, audit writes)             │   service methods   repo only   │
│   └──────┬─────────────────────────────────────────┘                                 │
│          │                                                                            │
│          ▼                                                                            │
│   ┌──────────────┐        ┌───────────────────────────────┐                          │
│   │ REPOSITORY   │        │  READ-ONLY REPORTING REPO      │  (whitelisted views,     │
│   │ (Prisma)     │        │  (read-only PG role, views)    │   SELECT-only PG role)   │
│   └──────┬───────┘        └───────────────┬───────────────┘                          │
└──────────┼────────────────────────────────┼─────────────────────────────────────────┘
           ▼                                 ▼
        ┌──────────────────────────────────────────┐
        │            PostgreSQL (Supabase)          │
        │   transactional tables  +  reporting views│
        └──────────────────────────────────────────┘

        ┌──────────────────────┐   ┌───────────────────────────┐
        │ PDF microservice     │   │  Job table + node-cron     │
        │ (Python/ReportLab)   │   │  (async: reports, notifs)  │
        └──────────────────────┘   └───────────────────────────┘
```

**Decision: the AI Gateway sits *beside* the API layer and calls into a restricted read-only repository, not the full Service layer's write paths. [V1]**

Justification: the Gateway needs exactly two things from the rest of the system — (a) the permission context of the caller, resolved by the *same* Auth/AuthZ cross-cutting modules the API layer uses, and (b) read access to analytical data. It must be structurally unable to invoke any write/state-transition service method. Routing its data access through a dedicated read-only reporting repository (backed by a SELECT-only Postgres role over whitelisted views) makes "the AI cannot mutate anything" a property of the *infrastructure*, not just of careful coding. The Gateway still runs the permission check through the shared AuthZ module, so it can never see data the calling Company user couldn't.

### 3.2 Modules and their boundaries

Nine business modules (fixed by the Functional PRD) plus three cross-cutting modules. A module **owns** its tables and **exposes** a service interface; no module reads another module's tables directly.

| Module | Owns (tables) | Exposes to others | Consumes from others |
|---|---|---|---|
| **Mould Management** | `moulds`, `mould_lifecycle_events` | mould specs, current lifecycle state, shot-life status | Audit, Notifications |
| **Raw Material Management** | `raw_materials` | RM master data, RM availability | Audit |
| **Vendor & Assignment Management** | `vendors`, `assignments` | active assignments per vendor, assignment scope checks | Mould, Raw Material (validity of refs), Audit, Notifications |
| **Daily Production Logging** | `daily_production_logs` | submitted production data (read interface only) | Vendor/Assignment (scope), Mould (shot weight spec), Raw Material (deduction), Audit |
| **Edit Request Workflow** | `edit_requests` | pending requests, approval state | Daily Production Logging (applies approved corrections), Audit, Notifications |
| **Repair & Rework Management** | `repair_records` | repair history per mould | Mould (lifecycle transitions), Audit, Notifications |
| **Analytics** | *(owns no base tables)* — owns the **read layer**: reporting views | cross-vendor aggregates, time series | reads via the reporting-view layer it defines over other modules' tables |
| **Vendor Performance Tracking** | `vendor_performance_snapshots` | vendor scores/rankings | **Analytics read layer only — never Daily Production Logging tables directly** |
| **AI Copilot** | `ai_conversations`, `ai_messages` | natural-language query answers (Company-only) | Analytics read layer (via read-only repo), Auth/AuthZ |
| *(cross-cutting)* **Auth** | `users`, `sessions` | identity, role, `vendor_id` claim | — |
| *(cross-cutting)* **AuthZ** | `roles`, `permissions`, `role_permissions` | permission checks, vendor scoping | Auth |
| *(cross-cutting)* **Audit** | `audit_log` | append-only audit write API, audit query | every mutating module calls it |
| *(cross-cutting)* **Notifications** | `notifications` | enqueue/dispatch notification | every triggering module calls it |

**Explicit boundary call-out (per the prompt):** Vendor Performance Tracking reads **only** through the Analytics-owned reporting-view layer. It never queries `daily_production_logs` directly. This means the scoring inputs come from one governed, versioned read surface, which is also the only surface the AI Copilot can see — so "what the AI can compute" and "what vendor performance is scored on" stay consistent and auditable.

---

## 4. Data Architecture & Core Entity Schemas

### 4.0 Conventions

- All tables carry standard audit columns: `id (uuid PK)`, `created_at`, `updated_at`, `created_by`, `updated_by`.
- `company_id uuid FK -> companies.id NOT NULL` on every tenant-relevant table (one row today; Chapter 7). [V1]
- **Soft-delete** (`deleted_at timestamptz NULL`) is added only where history must survive deletion for dispute/audit; each table states yes/no with a reason.
- **Version/snapshot** columns are added where a row's prior state must be reconstructable; stated per table.
- Money/quantity columns use `numeric` (never float) to avoid rounding drift in RM arithmetic.
- Derived fields name the Functional PRD formula they implement; they do not restate it.

#### Reference: companies & users (cross-cutting, abridged)

```
Table: companies
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | [V1] exactly one row today |
| name | text | not null | |
| created_at/updated_at | timestamptz | not null | |
Soft-delete: no (a company is never deleted in V1). Version: no.

Table: users
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | |
| role_id | uuid | FK -> roles.id, not null | 'company' or 'vendor' in V1 |
| vendor_id | uuid | FK -> vendors.id, null | NOT NULL only for vendor-role users; the server-trusted scope claim |
| login_identifier | text | unique, not null | shared per vendor entity for vendor role |
| password_hash | text | not null | |
| is_active | boolean | not null default true | |
Soft-delete: yes (deactivate, never hard-delete — audit attribution must survive). Version: no.
```

---

### 4.1 Mould

```
Table: moulds
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] single row today, present for future multi-company |
| code | text | not null, unique (company_id, code) | human mould identifier |
| name | text | not null | |
| cavity_count | integer | not null, check (cavity_count > 0) | input to Shot Weight Formula |
| part_weight_g | numeric | not null, check (part_weight_g > 0) | input to Shot Weight Formula |
| runner_weight_g | numeric | not null, check (runner_weight_g >= 0) | input to Shot Weight Formula |
| shot_weight_g | numeric | generated/derived | = Shot Weight Formula (Functional PRD) |
| shot_life_limit | bigint | not null, check (shot_life_limit > 0) | finite mould life in shots |
| shot_count_accumulated | bigint | not null default 0 | derived, maintained |
| lifecycle_state | text | not null, check in ('active','flagged_for_replacement','in_repair','retired') | mirrors latest lifecycle event |
| version | integer | not null default 1 | snapshot/optimistic-lock |
| deleted_at | timestamptz | null | soft-delete |
| created_at/updated_at/created_by/updated_by | | not null (created_*) | standard audit |

Derived fields:
- shot_weight_g — computed by: DB generated column (STORED), on: insert/update of cavity_count/part_weight_g/runner_weight_g.
  Placement justification: it is a pure row-local arithmetic function of three columns on the same row (Shot Weight Formula), so a generated column is the cheapest correct place and can never drift from its inputs.
- shot_count_accumulated — computed by: application service (Mould Management), on: each Daily Production Log submission (same DB transaction).
  Placement justification: it is a running total fed by another module's writes and must atomically trigger the shot-life threshold flag (Mould Lifecycle Formula); that branching logic belongs in a service, not a column default.
- lifecycle_state — maintained by: application service, on: each mould_lifecycle_event insert. Denormalized mirror of the latest event for fast filtering; the event table remains the source of truth.

Relationships: has many Assignments; has many Mould Lifecycle Events; has many Repair Records; referenced by Daily Production Logs.
Soft-delete: YES — a mould is decommissioned, not erased; its production history must remain attributable.
Version/snapshot: YES — specs (weights, cavity) change over a mould's life; the `version` column + snapshotting of specs into each log (4.6) preserves "as-calculated" disputes.
```

### 4.2 Raw Material

```
Table: raw_materials
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| code | text | not null, unique (company_id, code) | |
| name | text | not null | |
| unit | text | not null | e.g. kg; quantities elsewhere are in this unit |
| deleted_at | timestamptz | null | soft-delete |
| created_at/updated_at/created_by/updated_by | | | standard audit |

Derived fields: none on the master row. Per-assignment RM balances live on `assignments` (4.5).
Relationships: referenced by Assignments; referenced (via assignment) by Daily Production Logs.
Soft-delete: YES — an RM type may be retired but is still referenced by historical assignments/logs.
Version/snapshot: NO — RM master is descriptive reference data; it carries no per-day computed state that a dispute hinges on. (RM *balances* that disputes hinge on live on the assignment, which is versioned.)
```

### 4.3 Vendor

```
Table: vendors
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| code | text | not null, unique (company_id, code) | e.g. 'VENDOR_A', 'GMPL_INTERNAL' |
| name | text | not null | |
| is_internal | boolean | not null default false | true for the GMPL in-house line |
| is_active | boolean | not null default true | |
| deleted_at | timestamptz | null | soft-delete |
| created_at/updated_at/created_by/updated_by | | | standard audit |

Derived fields: none stored here. Performance scores live in vendor_performance_snapshots (computed from the Analytics read layer).
Relationships: has many Assignments; has one shared Vendor user (Auth); referenced by Daily Production Logs (through assignment).
Soft-delete: YES — vendor relationships end but their production history is dispute-relevant indefinitely.
Version/snapshot: NO — a vendor row is a stable identity; it holds no per-period computed state. (The `is_internal` flag is configuration, not computed state.)
```

### 4.4 Customer Requirement

```
Table: customer_requirements
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| customer_name | text | not null | |
| mould_id | uuid | FK -> moulds.id, not null | the mould the requirement needs |
| required_qty | numeric | not null, check (required_qty > 0) | parts required |
| due_date | date | null | |
| status | text | not null, check in ('open','assigned','fulfilled','cancelled') | |
| deleted_at | timestamptz | null | soft-delete |
| created_at/updated_at/created_by/updated_by | | | standard audit |

Derived fields: status transitions are driven by the Assignment/Production services (e.g., 'fulfilled' when dispatched qty meets required_qty per the Functional PRD fulfilment rule) — maintained by application service.
Relationships: triggers Assignments; references one Mould.
Soft-delete: YES — cancelled/closed requirements remain part of the assignment paper-trail.
Version/snapshot: NO — fulfilment is tracked through linked assignments/logs, not by snapshotting this row.
```

### 4.5 Assignment

```
Table: assignments
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| vendor_id | uuid | FK -> vendors.id, not null | the scope key for vendor-side queries |
| mould_id | uuid | FK -> moulds.id, not null | |
| customer_requirement_id | uuid | FK -> customer_requirements.id, null | |
| raw_material_id | uuid | FK -> raw_materials.id, not null | which RM was assigned |
| rm_assigned_qty | numeric | not null, check (rm_assigned_qty >= 0) | RM handed to vendor |
| rm_consumed_qty | numeric | not null default 0 | derived, maintained |
| rm_irrecoverable_loss_qty | numeric | not null default 0 | derived, maintained (wastage/purging) |
| rm_remaining_qty | numeric | not null default 0 | derived, maintained |
| status | text | not null, check in ('active','revoked','completed') | |
| assigned_at | timestamptz | not null | |
| revoked_at | timestamptz | null | set on revoke transition |
| version | integer | not null default 1 | snapshot/optimistic-lock |
| deleted_at | timestamptz | null | soft-delete |
| created_at/updated_at/created_by/updated_by | | | standard audit |

Constraints enforcing business rules:
- partial unique index on (mould_id) where status='active' — a mould can be actively assigned to only one vendor at a time
  (enforces the Functional PRD single-active-assignment rule at the DB level). [Confirm exact rule in Ch.19 if FPRD allows split assignment.]

Derived fields:
- rm_consumed_qty — computed by: application service (Daily Production Logging), on: each log submission. += per-log rm_consumed (RM Consumption Formula).
- rm_irrecoverable_loss_qty — computed by: application service, on: each log submission. += per-log irrecoverable loss (Irrecoverable Loss Accounting, Functional PRD).
- rm_remaining_qty — computed by: application service, on: each log submission and on assignment edit; = rm_assigned_qty − rm_consumed_qty − rm_irrecoverable_loss_qty.
  Placement justification: all three are running aggregates across many logs in the same transaction as the log write; keeping them on the assignment row (vs. recomputing on read) gives O(1) reads for the dashboards/AI and a single transactional point where the deduction can be reconciled and audited.
Relationships: belongs to Vendor, Mould, Raw Material, Customer Requirement; has many Daily Production Logs.
Soft-delete: YES — revoked/completed assignments are central dispute evidence.
Version/snapshot: YES — revocation mid-period and RM re-assignment change balances; version + audit before/after make each change reconstructable.
```

### 4.6 Daily Production Log

```
Table: daily_production_logs
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| assignment_id | uuid | FK -> assignments.id, not null | links vendor+mould+RM |
| vendor_id | uuid | FK -> vendors.id, not null | denormalized scope key (matches assignment.vendor_id) |
| mould_id | uuid | FK -> moulds.id, not null | denormalized for the uniqueness constraint |
| log_date | date | not null | the production day |
| shots_run | bigint | not null, check (shots_run >= 0) | input to RM consumption + shot-life |
| accepted_qty | numeric | not null, check (accepted_qty >= 0) | |
| rejected_qty | numeric | not null, check (rejected_qty >= 0) | |
| dispatched_qty | numeric | not null, check (dispatched_qty >= 0) | |
| downtime_reason | text | null, check in ('manpower_shortage','machine_breakdown','mould_breakdown','power_cut','others', null) | |
| downtime_minutes | integer | null, check (downtime_minutes >= 0) | |
| shot_weight_g_snapshot | numeric | not null | mould.shot_weight_g copied at submit (as-calculated) |
| rm_consumed_qty | numeric | not null | derived, snapshotted |
| rm_irrecoverable_loss_qty | numeric | not null default 0 | derived, snapshotted |
| status | text | not null, check in ('draft','submitted','correction_pending','corrected') | state machine (Ch.8) |
| version | integer | not null default 1 | bumped when a correction is applied |
| deleted_at | timestamptz | null | soft-delete |
| created_at/updated_at/created_by/updated_by | | | standard audit |

Constraints enforcing business rules:
- UNIQUE (vendor_id, mould_id, log_date) WHERE deleted_at IS NULL
  — enforces "one log per mould per vendor per day" at the DATABASE level, not just application code. This is the single most important constraint in the schema.

Derived fields:
- shot_weight_g_snapshot — copied by: application service, on: submit. Freezes the mould spec used so a later mould edit cannot retroactively change this log's math.
- rm_consumed_qty — computed by: application service (Daily Production Logging), on: submit. = RM Consumption Formula (Functional PRD) using shots_run × shot_weight_g_snapshot.
- rm_irrecoverable_loss_qty — computed by: application service, on: submit, per Irrecoverable Loss Accounting (Functional PRD).
Relationships: belongs to Assignment (and via it Vendor/Mould/RM); has at most-pending/historical Edit Requests; drives Mould.shot_count_accumulated.
Soft-delete: YES — but only via correction lineage; a submitted log is never user-deletable (Ch.11).
Version/snapshot: YES — corrections produce a new version; the prior values live in audit_log before/after.
```

### 4.7 Edit Request

```
Table: edit_requests
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| daily_production_log_id | uuid | FK -> daily_production_logs.id, not null | the log to correct |
| vendor_id | uuid | FK -> vendors.id, not null | requester scope (must match log) |
| requested_changes | jsonb | not null | proposed field→value diffs |
| reason | text | not null | vendor's justification |
| status | text | not null, check in ('pending','approved','rejected') | state machine (Ch.8) |
| decided_by | uuid | FK -> users.id, null | Company user who decided |
| decided_at | timestamptz | null | |
| decision_note | text | null | |
| created_at/updated_at/created_by/updated_by | | | standard audit |

Constraints enforcing business rules:
- partial unique index on (daily_production_log_id) where status='pending'
  — at most one open Edit Request per log at a time (prevents racing corrections).

Derived fields: none. The applied result is written onto the log row + audited on approval.
Relationships: belongs to one Daily Production Log; decided by one Company user.
Soft-delete: NO — an Edit Request is itself an immutable audit artifact; it is never deleted, only resolved. (Keeping it permanently is the point.)
Version/snapshot: NO — it is single-decision and terminal; the before/after of the log it edits is captured in audit_log.
```

### 4.8 Repair / Rework Record

```
Table: repair_records
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| mould_id | uuid | FK -> moulds.id, not null | |
| reported_by | uuid | FK -> users.id, not null | |
| status | text | not null, check in ('open','in_progress','reworked','closed') | |
| issue_description | text | not null | |
| rework_description | text | null | filled when reworked |
| opened_at | timestamptz | not null | |
| closed_at | timestamptz | null | |
| deleted_at | timestamptz | null | soft-delete |
| created_at/updated_at/created_by/updated_by | | | standard audit |

Derived fields: drives Mould lifecycle transitions (active↔in_repair) via application service (Ch.8).
Relationships: belongs to one Mould; correlates with mould_lifecycle_events.
Soft-delete: YES — repair history informs predictive-maintenance roadmap and disputes over downtime cause.
Version/snapshot: NO — status progression is captured in audit_log; no per-period computed value to snapshot.
```

### 4.9 Mould Lifecycle Event

```
Table: mould_lifecycle_events
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| mould_id | uuid | FK -> moulds.id, not null | |
| event_type | text | not null, check in ('activated','flagged_for_replacement','moved_to_repair','returned_to_rotation','retired') | |
| from_state | text | null | mould lifecycle_state before |
| to_state | text | not null | mould lifecycle_state after |
| shot_count_at_event | bigint | not null | accumulated shots when the event fired |
| triggered_by | uuid | FK -> users.id, null | null when triggered automatically by shot-life threshold |
| trigger_kind | text | not null, check in ('automatic','manual') | |
| note | text | null | |
| created_at/created_by | | not null | append-only |

Derived fields: none — this table IS the lifecycle source of truth; moulds.lifecycle_state is its denormalized mirror.
Relationships: belongs to one Mould.
Soft-delete: NO — append-only event log; deleting a lifecycle event would corrupt the very history disputes rely on.
Version/snapshot: NO — events are immutable facts; never updated.
```

### 4.10 Audit log (cross-cutting, supports Principle 2)

```
Table: audit_log
| column | type | constraints | notes |
|---|---|---|---|
| id | uuid | PK | |
| company_id | uuid | FK -> companies.id, not null | [V1] |
| entity_type | text | not null | e.g. 'daily_production_log' |
| entity_id | uuid | not null | |
| action | text | not null, check in ('create','update','delete','state_transition','approve','reject','revoke') | |
| actor_user_id | uuid | FK -> users.id, null | null only for system/background actions |
| actor_role | text | not null | 'company' / 'vendor' / 'system' |
| before | jsonb | null | prior state (null on create) |
| after | jsonb | null | new state (null on delete) |
| created_at | timestamptz | not null default now() | |

Append-only. No update, no delete, no soft-delete. Written in the SAME transaction as the mutation it records (Ch.11).
```

---

## 5. API Design Standards

### 5.1 Conventions [V1]

- **Versioning:** all routes under `/api/v1/`. Breaking changes bump to `/api/v2/`.
- **Pagination:** cursor or offset via `?page=`, `?limit=` (default 25, max 100). Responses include `meta.pagination`.
- **Filtering:** `?filter[field]=value` (e.g. `?filter[status]=submitted`). Date ranges via `?filter[log_date][gte]=` / `[lte]=`.
- **Sorting:** `?sort=field` / `?sort=-field` (leading `-` = descending). Multiple comma-separated.
- **Search:** `?search=` for free-text on a module's designated searchable columns.
- **Auth:** `Authorization: Bearer <JWT>` on every route except login/health.
- **Idempotency:** unsafe POSTs that must not double-apply (log submit, approve, revoke) accept an `Idempotency-Key` header.

**Success envelope**
```json
{
  "data": { },
  "meta": { "pagination": { "page": 1, "limit": 25, "total": 0 }, "request_id": "uuid" }
}
```

**Error envelope**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "human-readable summary",
    "details": [ { "field": "accepted_qty", "issue": "must be >= 0" } ],
    "request_id": "uuid"
  }
}
```
Stable machine codes: `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT` (e.g. duplicate daily log), `STATE_TRANSITION_INVALID`, `RATE_LIMITED`, `UPSTREAM_AI_UNAVAILABLE`, `INTERNAL`.

### 5.2 Endpoints by module

Roles: **C** = Company, **V** = Vendor. Every Vendor-callable route is additionally scoped to the caller's `vendor_id` server-side (Chapter 6).

**Mould Management**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/moulds` | C, V | List moulds (V sees only moulds on its active assignments) |
| GET | `/api/v1/moulds/:id` | C, V | Mould detail incl. shot-life status |
| POST | `/api/v1/moulds` | C | Create mould |
| PATCH | `/api/v1/moulds/:id` | C | Edit mould specs (bumps version) |
| DELETE | `/api/v1/moulds/:id` | C | Soft-delete / decommission |
| POST | `/api/v1/moulds/:id/move-to-repair` | C | Lifecycle transition active→in_repair (`human-approval-required` = Company action) |
| POST | `/api/v1/moulds/:id/return-to-rotation` | C | Lifecycle in_repair→active |
| POST | `/api/v1/moulds/:id/retire` | C | Lifecycle →retired |
| GET | `/api/v1/moulds/:id/lifecycle-events` | C | Lifecycle event history |

**Raw Material Management**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/raw-materials` | C, V | List RM types |
| POST | `/api/v1/raw-materials` | C | Create RM type |
| PATCH | `/api/v1/raw-materials/:id` | C | Edit RM type |
| DELETE | `/api/v1/raw-materials/:id` | C | Soft-delete |

**Vendor & Assignment Management**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/vendors` | C | List vendors |
| POST | `/api/v1/vendors` | C | Create vendor |
| PATCH | `/api/v1/vendors/:id` | C | Edit vendor |
| GET | `/api/v1/assignments` | C, V | List assignments (V → own only) |
| GET | `/api/v1/assignments/:id` | C, V | Assignment detail incl. RM balances |
| POST | `/api/v1/assignments` | C | Assign mould + RM to a vendor |
| PATCH | `/api/v1/assignments/:id` | C | Adjust RM assigned qty (audited) |
| POST | `/api/v1/assignments/:id/revoke` | C | Revoke assignment (state transition; Ch.8 edge case) |
| POST | `/api/v1/assignments/:id/add-raw-material` | C | Add RM to an in-flight assignment |

**Daily Production Logging**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/logs` | C, V | List logs (V → own; filter by date/mould/assignment) |
| GET | `/api/v1/logs/:id` | C, V | Log detail |
| POST | `/api/v1/logs` | V | Create a draft log |
| POST | `/api/v1/logs/:id/submit` | V | Submit (locks the log; `automatic` deduction + shot-count update) |
| POST | `/api/v1/logs/:id/edit-requests` | V | Raise an Edit Request against a submitted log |

**Edit Request Workflow**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/edit-requests` | C, V | List (V → own; C → all pending) |
| GET | `/api/v1/edit-requests/:id` | C, V | Detail |
| POST | `/api/v1/edit-requests/:id/approve` | C | Approve (`human-approval-required`; applies correction) |
| POST | `/api/v1/edit-requests/:id/reject` | C | Reject (`human-approval-required`) |

**Repair & Rework Management**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/repair-records` | C | List repair records |
| POST | `/api/v1/repair-records` | C | Open a repair record (also drives mould→in_repair) |
| PATCH | `/api/v1/repair-records/:id` | C | Update progress / rework notes |
| POST | `/api/v1/repair-records/:id/close` | C | Close (may drive mould→active) |

**Analytics**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/analytics/production` | C | Cross-vendor production aggregates / time series |
| GET | `/api/v1/analytics/raw-material` | C | RM consumption & remaining across assignments |
| GET | `/api/v1/analytics/mould-life` | C | Shot-life remaining across moulds |
| GET | `/api/v1/analytics/downtime` | C | Downtime breakdown by reason |

**Vendor Performance Tracking**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/vendor-performance` | C | Vendor scores & ranking (from Analytics read layer) |
| GET | `/api/v1/vendor-performance/:vendorId` | C | Single vendor scorecard |

**AI Copilot** (Company only)
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/v1/ai/conversations` | C | Start a conversation |
| POST | `/api/v1/ai/conversations/:id/messages` | C | Ask a question (full pipeline, Ch.9) |
| GET | `/api/v1/ai/conversations/:id` | C | Retrieve conversation history |

**Auth (cross-cutting)**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/login` | — | Issue JWT |
| POST | `/api/v1/auth/logout` | C, V | Invalidate session |
| GET | `/api/v1/auth/me` | C, V | Current identity, role, permissions |

**Health (cross-cutting):** `GET /api/v1/health` (— ), `GET /api/v1/health/ai` (—) — Chapter 12.

---

## 6. Authentication, Authorization & Permission Model

### 6.1 Roles [V1]

Two roles, modelled in a `roles` table so adding more is data, not code: `company` and `vendor`. Each maps to dot-notation permission strings via `role_permissions`.

```
Table: roles            (id, company_id, key, name)
Table: permissions      (id, key)                         -- e.g. 'mould.create'
Table: role_permissions (role_id, permission_id)          -- many-to-many
```

### 6.2 Full permission list and current holders [V1]

| Permission | company | vendor |
|---|---|---|
| `mould.view` | ✓ | ✓ (own-assignment moulds only) |
| `mould.create` | ✓ | |
| `mould.update` | ✓ | |
| `mould.delete` | ✓ | |
| `mould.lifecycle.transition` | ✓ | |
| `rawmaterial.view` | ✓ | ✓ |
| `rawmaterial.create` | ✓ | |
| `rawmaterial.update` | ✓ | |
| `rawmaterial.delete` | ✓ | |
| `vendor.view` | ✓ | |
| `vendor.create` | ✓ | |
| `vendor.update` | ✓ | |
| `assignment.view` | ✓ | ✓ (own only) |
| `assignment.create` | ✓ | |
| `assignment.update` | ✓ | |
| `assignment.revoke` | ✓ | |
| `assignment.addrawmaterial` | ✓ | |
| `log.view` | ✓ | ✓ (own only) |
| `log.create` | | ✓ |
| `log.submit` | | ✓ |
| `editrequest.create` | | ✓ |
| `editrequest.view` | ✓ | ✓ (own only) |
| `editrequest.approve` | ✓ | |
| `editrequest.reject` | ✓ | |
| `repair.view` | ✓ | |
| `repair.create` | ✓ | |
| `repair.update` | ✓ | |
| `analytics.view` | ✓ | |
| `vendorperformance.view` | ✓ | |
| `ai.query` | ✓ | |

Note the hard split: `log.create`/`log.submit`/`editrequest.create` are **vendor-only**; every approval/mutation of master data is **company-only**; `ai.query` is **company-only** (Principle 6, enforced again in Ch.9).

### 6.3 Vendor scoping (the critical control) [V1]

A Vendor login is shared across an entire vendor entity, so authorization cannot rely on user identity. Mechanism:

1. On login, the server resolves the user's `vendor_id` and embeds it as a **signed JWT claim** (`vendor_id`). It is never read from request body/query.
2. Every vendor-scoped repository method takes the `vendor_id` from the auth context and adds `WHERE vendor_id = :ctx.vendor_id` (and, for production data, `assignment_id IN (vendor's assignments)`) **server-side**. There is no code path where a vendor query runs without this filter.
3. Any attempt by a vendor token to address a resource outside its scope returns `NOT_FOUND` (not `FORBIDDEN`) so existence of other vendors' records is not leaked.
4. Company tokens carry no `vendor_id`; their queries are company-scoped (Ch.7) but not vendor-filtered.

### 6.4 Future Company role hierarchy [Roadmap]

The `roles`/`permissions`/`role_permissions` design is purely additive. Introducing Admin/Manager/Viewer later means inserting new `roles` rows and `role_permissions` mappings — **no schema change, no code change to the permission-check middleware**. Illustrative future split (not a V1 requirement):

```
company_admin   → all 'company' permissions above
company_manager → all except {vendor.create, mould.delete, rawmaterial.delete}
company_viewer  → only {*.view, analytics.view, vendorperformance.view}  (no ai.query)
```

---

## 7. Multi-Tenancy & Scoping

**Formal rule [V1]:** GMPL Copilot is a single-company internal tool in V1. We do **not** build cross-company features. We **do** carry a dormant tenant key so multi-company is later a migration, not a rewrite.

1. **Which tables carry `company_id` now:** every table in Chapter 4 except `permissions` (global) — i.e. `moulds`, `raw_materials`, `vendors`, `customer_requirements`, `assignments`, `daily_production_logs`, `edit_requests`, `repair_records`, `mould_lifecycle_events`, `users`, `roles`, `audit_log`, `notifications`, `ai_conversations`, `ai_messages`, `vendor_performance_snapshots`. There is exactly **one** row in `companies` today.
2. **How every query is scoped even with one company:** the Service layer derives `company_id` from the auth context and the Repository layer injects `WHERE company_id = :ctx.company_id` into every query — unconditionally, today, with one company. This means the code path is already correct when a second company appears; we are not relying on "there's only one company so it doesn't matter."
3. **What changes when a second company is onboarded:** essentially only data/config — insert a second `companies` row, provision its users/roles, and (the one real engineering task) add Postgres Row-Level Security policies keyed on `company_id` as defense-in-depth. No table restructure, no query rewrite. **[Roadmap]** — RLS policies and a tenant-resolution step at login are designed-for but not built in V1.

---

## 8. Business-Rule-to-Service Mapping & Background Jobs

Each stateful workflow is modelled as an explicit state machine. Transitions reference the Functional PRD rule/formula they implement; they do not restate it.

### 8.1 Daily Production Log

```
States:  draft ──submit──▶ submitted ──raise edit req──▶ correction_pending
                                ▲                                │
                                └──────── edit rejected ─────────┘
         correction_pending ──edit approved──▶ corrected (terminal until next edit cycle)
```

| Transition | Trigger | Sync/Async | Tag |
|---|---|---|---|
| draft → submitted | Vendor calls `/logs/:id/submit` | **synchronous** (one DB transaction: insert-lock, snapshot shot weight, compute `rm_consumed` via RM Consumption Formula, decrement assignment balances, increment `moulds.shot_count_accumulated`, evaluate shot-life threshold, write audit) | `automatic` (all calculations); the submit itself is a vendor action |
| submitted → correction_pending | Vendor raises Edit Request | synchronous | `human-approval-required` (downstream) |
| correction_pending → corrected | Company approves Edit Request | synchronous (apply diff, bump version, re-run affected deductions, audit before/after) | `human-approval-required` |
| correction_pending → submitted | Company rejects Edit Request | synchronous | `human-approval-required` |

Once a log is `submitted` it is immutable outside this machine (Ch.11). The uniqueness constraint (4.6) makes a second log for the same vendor+mould+date impossible.

### 8.2 Edit Request

```
States:  pending ──approve──▶ approved (terminal)
         pending ──reject───▶ rejected (terminal)
```

| Transition | Trigger | Sync/Async | Tag |
|---|---|---|---|
| (none) → pending | Vendor `POST /logs/:id/edit-requests` | synchronous | `automatic` creation; decision pending |
| pending → approved | Company `POST /edit-requests/:id/approve` | synchronous; applies `requested_changes` to the log, recomputes deductions, audits | `human-approval-required` |
| pending → rejected | Company `POST /edit-requests/:id/reject` | synchronous | `human-approval-required` |

The partial unique index (4.7) guarantees at most one `pending` request per log.

### 8.3 Mould Lifecycle

```
States:  active ──flag (auto on shot-life)──▶ flagged_for_replacement
         active ──move-to-repair (Company)──▶ in_repair ──return──▶ active
         active / flagged / in_repair ──retire (Company)──▶ retired (terminal)
```

| Transition | Trigger | Sync/Async | Tag |
|---|---|---|---|
| active → flagged_for_replacement | shot-life threshold crossed during a log submit (Mould Lifecycle / Shot-Life Formula) | synchronous, inside the submit transaction; emits a notification | `automatic` |
| active → in_repair | Company `move-to-repair` (often from a repair record) | synchronous | `human-approval-required` |
| in_repair → active | Company `return-to-rotation` after rework | synchronous | `human-approval-required` |
| any → retired | Company `retire` | synchronous | `human-approval-required` |

### 8.4 Background jobs [V1]

There are only two genuinely async tasks; both run via `node-cron` + the Postgres job table (Ch.2):

| Job | Trigger | Sync/Async | Retry/failure | Tag |
|---|---|---|---|---|
| Report generation | requested via API; enqueued | async | up to 3 retries with backoff; on final failure mark job `failed`, notify requester, keep partial off storage | `background-job` |
| Notification dispatch | enqueued by triggering modules | async | up to 5 retries; on final failure leave `notifications` row `failed` for retry/visibility | `background-job` |
| Vendor performance snapshot recompute | scheduled (e.g. nightly) **[Roadmap if on-demand suffices]** | async | idempotent recompute; safe to re-run | `background-job` |

### 8.5 Named edge cases (technical resolution)

1. **Vendor doesn't log at all that day.** No reconciliation job is required — the data model has nothing to "close out" for a missing day; absence of a row is simply no production. We confirm **there is nothing to reconcile** in V1. *If* the Functional PRD later defines a daily-completeness expectation (e.g. flagging vendors with missing logs), that becomes a scheduled `background-job` — **flagged as a dependency in Ch.19**, not built speculatively.
2. **GMPL revokes an assignment mid-period (in-flight RM).** `assignment.revoke` is `human-approval-required` (a Company action) and synchronous: it sets `status='revoked'`, `revoked_at`, freezes the current `rm_remaining_qty`, and audits before/after. **What happens to the frozen remaining RM (returned to stock? written off? carried to a new assignment?) is a Functional PRD accounting rule** — referenced here, and **listed in Ch.19** if not yet finalized. Already-submitted logs under the revoked assignment are untouched (immutable).
3. **Mould hits its shot-life limit mid-run.** The log that crosses the threshold is accepted in full (we do not reject production already made). Inside that same submit transaction, after the shot-count increment, the Shot-Life Formula is evaluated; if crossed, the mould transitions `active → flagged_for_replacement` (`automatic`) and a notification is emitted. The mould is not auto-removed from rotation — pulling it is a Company decision (`move-to-repair`/`retire`).

---

## 9. AI Copilot Architecture

Pipeline, in order:

```
Company request
   │
   ▼
[1 Gateway]            authenticate; attach auth context (role, company_id)
   │
   ▼
[2 Permission Checker] HARD-BLOCK any role != company BEFORE the model is touched.
   │                   require 'ai.query'. Vendor/anonymous → 403 FORBIDDEN, no model call.
   ▼
[3 Prompt Builder]     assemble system prompt + bounded conversation memory + user question
   │
   ▼
[4 Schema/Context      inject ONLY the whitelisted read-only reporting-view catalog
   Retriever]          (names + columns). Raw transactional tables are never exposed.
   │
   ▼
[5 Query Generator]    LLM produces a single SELECT against the whitelisted views
   │
   ▼
[6 Query Validator]    static checks: must be a single read-only SELECT; only whitelisted
   │                   views/columns; no DDL/DML/multi-statement; enforce LIMIT.
   ▼
[7 Execute]            run via the SELECT-only Postgres role over the reporting views,
   │                   inside a read-only transaction with a statement timeout
   ▼
[8 Formatter]          turn rows into a natural-language answer (+ the figures)
   │
   ▼
[9 Response]           return; persist question/answer to ai_messages
```

**(a) Permission Checker — hard block.** Non-Company roles are rejected at step 2 *before* any prompt is built or model call made (Principle 6). This is a separate guard from the route-level `ai.query` permission, so even a misconfigured route cannot leak the AI to a vendor.

**(b) Schema Retriever — whitelisted read-only views only.** The AI sees only the Analytics-owned reporting views (the same read layer Vendor Performance uses, Ch.3.2), never `daily_production_logs`/`assignments`/etc. directly. Why: (i) it makes cross-vendor leakage structurally impossible to express incorrectly — the views are the governed aggregation surface; (ii) it removes any path to a destructive or schema-probing query, because the executing role has SELECT-only grants on views alone; (iii) it decouples the AI from transactional schema churn.

**(c) In-scope vs out-of-scope.**
- **In scope (read-only questions):** production totals by vendor/mould/date, RM remaining per assignment/vendor, mould shot-life remaining, downtime breakdowns, vendor comparisons and ranking, trend questions over time.
- **Explicitly out of scope (must be impossible, not merely discouraged):** approving/rejecting an Edit Request, submitting/editing a log, revoking/creating assignments, mutating any row, or reading anything outside the reporting views. Steps 6–7 make these unrepresentable; step 2 keeps non-Company users out entirely.

**(d) Memory, rate limiting, fallback. [V1]**
- **Conversation memory scope:** bounded to the current conversation (last N turns, capped token budget), stored in `ai_conversations`/`ai_messages`, scoped by `company_id`. No cross-conversation or cross-company memory. **[Roadmap]:** long-term semantic memory.
- **Rate limiting:** per-user and per-company request caps (simple in-app counter; values sized in Ch.10/Ch.19 once expected concurrency is known). Returns `RATE_LIMITED`.
- **Fallback if the model/API is unavailable:** the Gateway returns `UPSTREAM_AI_UNAVAILABLE` with a clear message; the rest of the product is unaffected (the AI is fully isolated). No silent fabricated answer is ever returned. **[Roadmap]:** cached answers for common queries (Ch.10).

```
Table: ai_conversations (id, company_id, user_id, started_at, ...)
Table: ai_messages      (id, conversation_id, company_id, role['user'|'assistant'],
                         content, generated_sql NULL, latency_ms, status, created_at)
```
`generated_sql`, `latency_ms`, and `status` are stored for the trust/observability reasons in Ch.12.

---

## 10. Caching & Performance Strategy

**Load reality:** ~10 Company users, 6–7 vendor logins, ~250 moulds, at most a few hundred log rows per day. This is small-data, low-concurrency. Targets are sized accordingly, not to generic enterprise SLAs.

**V1 targets [V1]:**
- p95 read endpoint latency < 300 ms; p95 write/transition < 500 ms.
- AI Copilot end-to-end p95 < 8 s (dominated by model latency, not our DB).
- Daily log submit (the hot transactional path) < 500 ms including all deductions.

**Redis / external job queue: NOT needed in V1. [V1]** Postgres plus modest application-level in-memory caching of slow-changing reference data (mould specs, vendor list, permission maps) is sufficient at this scale. Derived balances are maintained on write (Ch.4), so dashboards read O(1) without a cache tier.

**[Roadmap] triggers that would justify Redis / a real queue — named, not vague:**
- **AI Copilot response caching** if query volume rises enough that repeated identical analytical questions dominate cost/latency → introduce a Redis cache keyed on (normalized question + company_id).
- **Async fan-out** if notification/report volume grows beyond what the Postgres job table comfortably handles → move to BullMQ on Redis.
Until one of those is observed, the Postgres-backed job table (Ch.2) is the queue.

Indexing [V1]: composite indexes on `daily_production_logs (vendor_id, log_date)`, `(assignment_id, log_date)`, `(mould_id, log_date)`; `assignments (vendor_id, status)`, partial unique `(mould_id) where status='active'`; `edit_requests (daily_production_log_id) where status='pending'`; `audit_log (entity_type, entity_id, created_at)`.

---

## 11. Security & Data Integrity

**Authentication [V1]:** JWT bearer tokens issued at login (short-lived access token; refresh handled via the session record). Passwords hashed with a strong adaptive hash (bcrypt/argon2). MFA is **[Roadmap]** — not justified for an internal tool with ~10 users and shared vendor logins; the auth module is structured so MFA is an added step at login, not a rewrite.

**Daily Production Log immutability — chosen mechanism: application-layer guard in the Service layer (not a DB check constraint). [V1]**
Justification: the rule is conditional and stateful — "a `submitted` log's production fields may change *only* as the result of an approved Edit Request transition." A DB `CHECK` constraint cannot express "this UPDATE is allowed because it originates from an approved Edit Request" (it has no notion of the request's state or the actor). The Service layer is the only writer (Principle 8), so a guard there is both expressive and sufficient: any update to a `submitted` log not flowing through the Edit Request approval path is rejected, and the legitimate correction path bumps `version` and writes `before`/`after` to `audit_log`. The DB still enforces the parts it *can* enforce declaratively: the one-log-per-day uniqueness constraint and all column checks.

**Audit logging [V1]:** every `create`/`update`/`delete`/`state_transition`/`approve`/`reject`/`revoke` on the 9 core entities writes an `audit_log` row **in the same transaction** as the mutation (so an audit gap is impossible — if the audit write fails, the mutation rolls back). Captures actor, role, timestamp, before, after (Principle 2 / dispute-reduction goal).

**Injection / XSS, with the AI in mind [V1]:**
- Application data access is via Prisma (parameterized) — no string-built SQL.
- The AI Copilot is the one component that emits SQL, so it gets defense in depth: (1) it can only produce SELECTs validated at Ch.9 step 6; (2) it executes under a SELECT-only Postgres role with grants on reporting views only — even a validator bypass cannot mutate or read outside the views; (3) a statement timeout and row LIMIT cap blast radius; (4) generated SQL is logged (`ai_messages.generated_sql`) for review.
- API inputs validated/sanitized at the API layer (schema validation); responses are JSON (no server-rendered HTML), and the client treats all stored text as data, mitigating stored XSS. Output encoding is enforced client-side per the Design doc.
- Transport: HTTPS everywhere; secrets (DB creds, model API key, the read-only role creds) in platform secret stores, never in the repo.


---

## 12. Observability & Monitoring

Lean V1 set, sized to an internal tool:

**[V1]**
- **Structured logging:** JSON logs with `request_id`, `user_id`, `role`, `company_id`, route, latency, status. The `request_id` flows into both envelopes (Ch.5) for traceability.
- **Error tracking:** an error aggregator (e.g. Sentry) on backend and frontend for unhandled exceptions and 5xx.
- **Health checks:** `GET /api/v1/health` (process + DB connectivity) and `GET /api/v1/health/ai` (Gateway → model reachability) for uptime monitoring.
- **AI Copilot-specific logging:** per query, record latency, success/failure, the generated SQL, and the validator outcome (`ai_messages`). Rationale: a *wrong* answer from an ops assistant is a **trust** risk, not just a latency stat — capturing the SQL behind every answer lets a Company user/admin audit *why* the AI said what it said and catch systematic errors. Track an AI answer-failure rate as a first-class signal.

**[Roadmap]** — flagged, not built: full distributed tracing, metrics dashboards (Prometheus/Grafana), and alerting pipelines. Concrete trigger to build them: sustained multi-service latency issues or AI volume high enough that aggregate dashboards beat per-request logs. Not justified at current scale.

---

## 13. Offline Strategy

**Question:** do Vendor users need offline logging, given factory-floor connectivity may be unreliable?

**V1 answer [V1]:** Do **not** build a full offline-first / PWA / sync engine speculatively — the Functional PRD does not specify offline as a requirement, and a sync-conflict engine is expensive and risky (it directly threatens the one-log-per-day integrity rule). Instead ship the minimal resilience that matters on a shop floor:
- **Client-side draft + retry-on-submit-failure:** the log entry form keeps the draft locally; if `POST /logs/:id/submit` fails on a flaky connection, the client retries (with the `Idempotency-Key` header so a retry can't create a duplicate or double-deduct). The server's uniqueness constraint is the final backstop against duplicates.
- The 48px touch-target / stepper-input ergonomics for the mobile vendor flow are a **Design-doc** concern, noted only as the reason a low-friction single-submit flow matters here.

**[Roadmap]:** full offline-first with a local store and background sync — only if real-world usage shows submits routinely failing for long offline windows. Designing the submit endpoint as idempotent now keeps that door open: an eventual sync engine just replays queued idempotent submits.

**Open Question (also in Ch.19):** confirm with GMPL whether vendor connectivity is bad enough that even draft+retry is insufficient — this materially changes V1 scope.

---

## 14. File Storage & Reporting

**What becomes a file [V1]:**
- Vendor performance reports (periodic scorecards / rankings).
- Repair & rework documentation (per repair record, for the dispute/maintenance trail).
- Production summaries / RM reconciliation exports on demand.

**Where it lives [V1]:** Supabase Storage (object storage), in a private bucket. Files are never public; access is mediated by the backend, which issues short-lived signed URLs only after a permission check.

**Naming convention [V1]:** `{company_id}/{report_type}/{scope}/{yyyymmdd}-{entity_id|range}-{uuid}.pdf`
(e.g. `…/vendor_performance/vendor_a/20260101-20260131-<uuid>.pdf`). The leading `company_id` segment keeps storage tenant-partitioned from day one (consistent with Ch.7).

**Access control [V1]:** Company-only for cross-vendor reports (`analytics.view`/`vendorperformance.view`); a vendor-scoped report (if/when exposed to vendors) is gated by the same `vendor_id` scoping as the rest of their data.

**Sync vs background [V1]:** report generation is a **`background-job`** — enqueued via the Postgres job table (Ch.8.4), generated by the **separate Python/ReportLab microservice** (reusing the prior build's pattern), result stored to Supabase Storage, requester notified. The backend passes already-permission-filtered data to the microservice; the microservice has no DB access of its own (it is a pure render service), keeping the layering and security model intact.

---

## 15. DevOps & Deployment

**[V1]**
- **Environments:** `dev` → `staging` → `prod`, each with its own Supabase project and isolated secrets. No shared databases across environments.
- **CI:** on PR — typecheck (tsc), lint, unit + integration tests (Ch.16), Prisma migration dry-run against an ephemeral DB. Block merge on failure.
- **Migrations:** Prisma Migrate, version-controlled, applied in CI/CD on deploy. Migrations are forward-only and reviewed; destructive migrations require explicit sign-off.
- **Deployment targets (reused from Ch.2):** frontend → Vercel; backend + PDF microservice → Railway; DB/Auth/Storage → Supabase. Promotion is staging→prod after checks pass.
- **Rollback:** application rollback via the platform's previous-deployment redeploy (Vercel/Railway). Database rollback via a paired down-migration *or*, for risky changes, an expand/contract migration pattern (add new, backfill, switch, drop later) so a bad deploy can be reverted without losing data. Supabase point-in-time restore is the last-resort backstop.

---

## 16. Testing Strategy

Tests are prioritized by **dispute/consequence severity**, not coverage vanity.

**Must-have for V1 (in priority order):**
1. **One-log-per-day uniqueness** — integration test proving a second log for the same vendor+mould+date is rejected by the DB constraint, including the soft-delete/correction case.
2. **RM deduction arithmetic** — unit + integration tests on the submit transaction: `rm_consumed`, irrecoverable loss, and `rm_remaining` are correct and consistent with the Functional PRD formulas (test against fixtures; the formulas themselves are FPRD-owned).
3. **Mould shot-life threshold flagging** — test that crossing the limit during submit transitions the mould to `flagged_for_replacement` exactly once and emits a notification, and that a sub-threshold submit does not.
4. **Edit Request state machine** — pending→approved applies the diff, recomputes deductions, bumps version, and audits before/after; pending→rejected leaves the log untouched; no second pending request can open.
5. **Permission boundaries** — a Vendor token cannot read or mutate another vendor's logs/assignments (returns `NOT_FOUND`), cannot hit Company-only routes, and cannot call the AI.
6. **AI Copilot permission + safety** — non-Company role is hard-blocked before the model; the validator rejects non-SELECT / non-whitelisted-view SQL; the read-only role cannot mutate.

**Split [V1]:**
- **Unit:** formula-application services, validators, state-machine guards, permission resolution. High coverage here — cheapest place to catch the consequential bugs.
- **Integration:** the transactional paths (submit, approve, revoke) against a real Postgres, including constraints and audit writes. This is where the dispute-critical behavior actually lives, so it gets the most attention.
- **E2E:** a thin happy-path suite (vendor logs → submits → raises edit request → company approves; company assigns/revokes; company asks the AI a question). **Nice-to-have / minimal for V1** — broad E2E is deferred; the integration layer carries the correctness burden.

---

## 17. Engineering & Coding Standards

**[V1]**
- **TypeScript strict mode** on across frontend and backend (`strict: true`, `noUncheckedIndexedAccess`, no implicit `any`).
- **Tooling:** ESLint + Prettier, enforced in CI; commit hooks for lint/format.
- **Folder structure mirrors the module boundary from Ch.3.2** (modular monolith), e.g.:
```
backend/src/
  modules/
    mould/            { mould.controller.ts, mould.service.ts, mould.repository.ts, mould.routes.ts }
    raw-material/
    vendor-assignment/
    daily-logging/
    edit-request/
    repair-rework/
    analytics/        (owns the reporting-view read layer)
    vendor-performance/
    ai-copilot/       (the isolated Gateway; no business-write imports)
  cross-cutting/
    auth/  authz/  audit/  notifications/
  shared/             (envelopes, validation, error codes)
```
  Each module folder contains its controller → service → repository, and may import *another module's service interface* but never another module's repository or Prisma models directly (enforces Ch.3 boundaries; lint rule restricts cross-module imports).
- **Naming conventions, kept consistent with Ch.4–6:**
  - Tables: `snake_case`, plural (`daily_production_logs`).
  - Columns: `snake_case`; derived columns suffixed with their meaning (`rm_consumed_qty`, `shot_count_accumulated`), snapshots suffixed `_snapshot`.
  - Endpoints: `/api/v1/{kebab-case-resource}` plural; workflow transitions as sub-actions (`/logs/:id/submit`, `/moulds/:id/move-to-repair`).
  - Permission strings: `resource.action` dot-notation, lowercase (`editrequest.approve`), matching Ch.6 exactly.
  - TypeScript: `PascalCase` types, `camelCase` vars/functions; DTOs suffixed `Dto`.

---

## 18. Scalability Roadmap (explicitly not V1)

| Capability | What today's V1 design already does to keep the door open |
|---|---|
| **Activate multi-company** | `company_id` on every tenant table + unconditional company-scoped queries (Ch.7). Activation = add a `companies` row + RLS policies; no schema rewrite. |
| **More concurrent users / Company role hierarchy** | `roles`/`permissions`/`role_permissions` is additive (Ch.6.4); permission middleware needs no change. Stateless JWT auth scales horizontally behind a load balancer. |
| **Barcode / QR scanning for mould tracking** | Moulds have a stable `code` + `id`; an endpoint to resolve a scanned code to a mould is additive (no model change). **Gap:** no barcode field/format standard chosen yet — minor add when needed. |
| **Predictive maintenance from downtime data** | Downtime reasons + minutes are captured structured on every log; repair records and lifecycle events are full history. The data needed to train/derive predictions is already being collected; the model/job is additive against the Analytics read layer. |
| **Public API / webhooks** | API-first design, versioned `/api/v1/`, permission-scoped — a public surface is a new role + rate-limit tier + webhook dispatcher (reuses the notification job pattern), not a redesign. |
| **ERP integration (SAP/Oracle/Tally)** | Clean module service interfaces + a governed read layer give integration adapters a stable surface to map to. **Gap:** no canonical external-ID mapping table yet; add a `external_refs` table per entity when a specific ERP is chosen. |
| **AI response caching / real queue** | Job table abstracts async work; AI Gateway isolates query handling — swapping in Redis/BullMQ is contained (Ch.10). |

All rows above are **[Roadmap]**.

---

## 19. Open Questions / Risks (technical)

Distinct from the Functional PRD's own open questions. Items marked **BLOCKING** must be resolved before the dependent code is final.

1. **Offline logging requirement (Ch.13).** Is factory-floor connectivity poor enough that draft+idempotent-retry is insufficient and true offline-first sync is needed? This materially changes V1 scope. *Default assumed: draft+retry only.*
2. **Multi-company within ~12 months (Ch.7).** If a second company is genuinely near-term, RLS and tenant resolution should move from [Roadmap] into V1 (the dormant `company_id` is enough only if it stays single-company for the foreseeable term). *Default assumed: single-company V1, dormant key.*
3. **Expected concurrent AI Copilot usage (Ch.9d/10).** Drives rate-limit values and whether response caching is needed sooner. With ~10 Company users, low concurrency is assumed; confirm peak usage. *Affects only config, not architecture.*
4. **Who actually enters Vendor logs (Ch.6).** Are logs entered by vendor staff via the shared Vendor login, or by GMPL staff on the vendor's behalf? If the latter, the Vendor login may not need to exist as designed and the scoping model simplifies. **BLOCKING for the auth/scoping build** — the entire vendor-scoping mechanism (Ch.6.3) depends on this answer. *Default assumed: vendors enter their own logs via the shared login.*
5. **Functional-PRD formulas/rules this document depends on but cannot assume final** — each translated to a concrete mechanism above; each **BLOCKING** for the corresponding service:
   - **RM Consumption Formula** (shots × shot weight → RM consumed) — drives `daily_production_logs.rm_consumed_qty` and assignment deduction.
   - **Irrecoverable Loss Accounting** (how wastage/purging is computed and deducted separately) — drives `rm_irrecoverable_loss_qty`.
   - **Shot Weight Formula** (runner + part × cavity) — drives the `moulds.shot_weight_g` generated column (assumed final, since stated in context; confirm exact rounding/units).
   - **Shot-Life / Mould Lifecycle threshold math** (when a mould is flagged) — drives the auto-flag transition (8.3).
   - **Vendor Performance scoring** — drives `vendor_performance_snapshots` and the Analytics read layer; the *inputs and weighting* are FPRD-owned and not assumed here.
   - **Revoked-assignment RM disposition** (8.5 case 2) — what happens to frozen remaining RM on revoke (return to stock / write-off / carry forward).
   - **Customer Requirement fulfilment rule** (4.4) — when a requirement flips to `fulfilled`.
   - **Single-active-assignment-per-mould** (4.5) — confirm a mould cannot be split across vendors simultaneously, since a DB constraint enforces it.
   - **Daily-completeness expectation** (8.5 case 1) — confirm there is genuinely nothing to reconcile when a vendor doesn't log; if missing-log flagging is wanted, it becomes a scheduled background job.

---

*End of Technical / Engineering PRD — GMPL Copilot.*
