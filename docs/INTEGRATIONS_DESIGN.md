# Integration-friendly architecture options

This design note summarizes integration patterns for the Google Drive Permission Manager. It now treats the project first as a **sheet-first Workspace control layer** that cooperates with the Google APIs (Admin SDK, Drive) and tolerates out-of-band changes. It also preserves a roadmap for adding a thin backend/API if teams need additional isolation or orchestration.

## Why and when to add a backend/API

The sheet-first, API-native mode covers many teams, but some will still want a thin backend to centralize auth, buffering, and policy. Consider adding one when:
- **Buffers and serializes changes** to avoid Google Sheets and Apps Script quota spikes.
- **Enforces contracts** (folder/role/membership schemas) before mutating Sheets, reducing data-quality regressions.
- **Adds stronger auth/audit** via service-to-service credentials, request signing, and correlation IDs.
- **Enables queueing and retries** so transient errors (throttling, partial writes) do not silently drop updates.
- **Exposes a stable front door** (REST/GraphQL) that decouples callers from spreadsheet column conventions.

## Design goals and non-goals

- **Goals**: predictable syncs under bursty load; clear API contracts; auditable writes; simple rollout path that keeps the spreadsheet UI intact; observable status and errors for operators and integrators.
- **Non-goals**: replacing the spreadsheet UI; implementing complex approval workflows (these can be layered on later once the backend boundary exists).

## Sheet-first, API-native integration (no dedicated backend)

Treat the tool as a **Workspace control layer** that coexists with other automations using Google APIs. The spreadsheet remains the operator UI, and the Apps Script sync engine reconciles against authoritative state from Admin SDK/Drive so that out-of-band changes are merged and reflected automatically.

```mermaid
flowchart LR
  External[External systems<br>(HRIS, ticketing, CI/CD)] -->|Google Admin/Drive API| Workspace[Workspace resources<br>(users, groups, folders)]
  Workspace -->|List & diff| Sync[Apps Script sync engine]
  Sync -->|Merge state| Sheet[Control spreadsheet]
  Sheet -->|Desired permissions| Sync
  Sync -->|Logs + metrics| Logging[Cloud Logging / Log tab]

  classDef default fill:#f9fbff,stroke:#1d4ed8,color:#0f172a;
  classDef sheet fill:#fff7ed,stroke:#d97706,color:#7c2d12;
  classDef script fill:#f0fdf4,stroke:#15803d,color:#14532d;
  classDef services fill:#fef2f2,stroke:#ef4444,color:#7f1d1d;

  class Sheet sheet;
  class Sync script;
  class Workspace services;
  class Logging services;
```

### Core behaviors in this mode
- **Bidirectional awareness**: The sync engine periodically reads current Workspace state (folders, memberships, group roles) via Admin SDK/Drive and compares it with the spreadsheet’s desired state. Out-of-band edits are detected and merged or flagged, keeping tabs accurate even when other tools write directly through Google APIs.
- **Conflict handling**: Prefer three-way merges (last synced snapshot vs. current spreadsheet vs. live Workspace state) to preserve operator intent while acknowledging external changes. Use annotations in the `Status` tab for conflicts instead of overwriting silently.
- **Logging where integrators already are**: Mirror `Log`/`Status` tab events to Cloud Logging so downstream Google-native integrations (SIEM, alerting) can consume them without polling Sheets.

### Example Google API integration
- A service account with Admin SDK and Drive scopes updates group membership directly (e.g., adds contractors to `project-editors@`). The nightly sync job fetches group members via Admin SDK, diffs against the spreadsheet’s desired list for that role, and writes any delta back to the appropriate tab. Operators see the merged view in the sheet, and a summary entry is pushed both to the `Log` tab and to Cloud Logging for correlation with other Workspace events.

## High-priority readiness items for integrations

1. **API contract and versioning**: Define resources (`folders`, `roles`, `memberships`) plus a staging flag for writes to “sandbox” tabs. Provide OpenAPI/GraphQL schema and changelog.
2. **Authn/z + audit**: Require service accounts or JWT client credentials; log caller identity and correlation IDs into the `Log`/`Status` tabs (and mirror to Cloud Logging when enabled).
3. **Drift detection and reconciliation**: Read live Workspace state (Admin SDK, Drive) on a schedule, detect out-of-band changes, and either merge them into the sheet or flag them in `Status` for operator review.
4. **Write serialization and buffering**: Use per-folder/role locks and a queue (e.g., Cloud Tasks, Pub/Sub) to smooth bursts and avoid conflicting writes to the same tab.
5. **Validation guardrails**: Reject malformed payloads early; enforce allowed domains and column/header alignment before touching Sheets.
6. **Operational visibility**: Expose health/status endpoints and webhook/pub-sub notifications that reflect the spreadsheet `Status` tab. Alert on persistent drift or repeated sync failures.
7. **Failure isolation**: Stage writes into temporary tabs, then copy/swap into production tabs only after validation; keep rollback primitives (restore from last known-good snapshot).

## Proposed architecture

```mermaid
flowchart LR
  subgraph Clients[Client systems]
    A[HRIS/CRM/ITSM]
    B[CI/CD or ticketing]
    C[Custom apps]
  end

  subgraph Backend[Integration backend]
    API[REST/GraphQL API]
    Queue[Queue / Tasks]
    Worker[Writer + Validator]
    StatusSvc[Status & Notifications]
  end

  Sheet[Control Spreadsheet]
  Script[Apps Script<br>sync engine]
  Drive[Drive & Groups APIs]

  A & B & C --> API
  API --> Queue
  Queue --> Worker
  Worker -->|Batch writes + optimistic locks| Sheet
  Worker -->|Trigger| Script
  Script -->|Reconcile| Drive
  Script -->|Log outcomes| Sheet
  Sheet --> StatusSvc
  StatusSvc -->|Webhooks/Alerts| Clients

  classDef default fill:#f9fbff,stroke:#1d4ed8,color:#0f172a;
  classDef backend fill:#f1f5f9,stroke:#0ea5e9,color:#0f172a;
  classDef sheet fill:#fff7ed,stroke:#d97706,color:#7c2d12;
  classDef script fill:#f0fdf4,stroke:#15803d,color:#14532d;
  classDef services fill:#fef2f2,stroke:#ef4444,color:#7f1d1d;

  class Backend backend;
  class Sheet sheet;
  class Script script;
  class Drive services;
```

### Data flow highlights
- **Ingress**: Clients call the API with folder/role/membership payloads. The API authenticates, validates, and enqueues work items.
- **Write path**: Workers de-duplicate by folder/role, apply optimistic locking (Sheets API ETags), and write into staging tabs before swapping into production tabs.
- **Sync trigger**: After writes, workers invoke the Apps Script Execution API (or web app endpoint) to run `fullSync`/`syncAdds`/`syncDeletes` as needed.
- **Feedback loop**: Status/Log tab updates are surfaced through a status endpoint and optional webhooks/pub-sub notifications.

## Phased rollout plan

1. **Phase 0 – Hardening direct integrations**: Add HMAC validation for any existing Apps Script web app endpoints; enable column/header checks; start logging correlation IDs.
2. **Phase 1 – Thin API gateway**: Stand up a minimal API with auth, schema validation, and enqueueing; continue writing to Sheets directly but serialize per folder/role.
3. **Phase 2 – Queue + staging tabs**: Introduce a queue and staging tabs; implement optimistic locking and rollback on failed validations.
4. **Phase 3 – Observability and hooks**: Publish status endpoints plus webhooks/pub-sub events sourced from the `Status` tab; add dashboards and alerts for drift/lag.
5. **Phase 4 – Deeper backend**: Migrate durable state (e.g., golden membership lists) to a datastore while keeping the spreadsheet as the operator UI; progressively move complex policies out of Apps Script.

## Tech options

- **Hosting**: Cloud Run/Functions, Firebase Hosting + Cloud Functions, or your preferred FaaS/containers platform.
- **Queueing**: Cloud Tasks, Pub/Sub, SQS, or RabbitMQ (if self-hosted).
- **Identity**: Google service accounts with domain-wide delegation for Sheets/Drive; JWT client credentials for external callers; signed HMAC for low-trust webhook sources.
- **Schema validation**: JSON Schema or Zod/Yup in the API; consider rejecting unknown columns and enforcing allowed domains.
- **Monitoring**: Cloud Logging + Error Reporting, paired with spreadsheet log mirroring to BigQuery for retention.

## Open questions to resolve

- What integrations require **strong ordering** versus best-effort eventual consistency?
- Do stakeholders need **approvals** before writes hit production tabs, or is staging + audit logging sufficient?
- Which events should trigger **webhooks** (e.g., sync succeeded, sync failed, drift detected, quota backoff)?
- Are there **data residency** constraints that impact hosting/queuing choices?

Addressing these questions early will help tailor the backend shape and prioritize the next iteration.
