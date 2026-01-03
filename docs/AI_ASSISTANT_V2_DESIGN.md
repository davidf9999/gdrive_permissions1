# Gemini CLI Assistant v2 - Design & Implementation Plan

This document outlines the final architecture for the Gemini CLI Assistant v2. The core of this new design is a "stateless" but state-aware state machine that dynamically discovers the user's setup progress at the beginning of each session.

## 1. Core Principles & Goals

- **Resilient & Session-Independent:** The assistant can be stopped and started at will. It will determine the correct state of the setup process every time it runs, without relying on persistent data from previous sessions.
- **State-Aware ("Jumpable"):** The assistant will detect the actual state of the user's environment, even if some steps were completed manually, and "jump" to the correct current step.
- **Document-Driven:** The assistant's logic and the user's view will be driven by the primary [Setup Guide](SETUP_GUIDE.md).
- **Zero-Friction Startup:** The assistant requires no complex pre-setup from the user. The user can run it directly from the main project clone.
- **Non-Intrusive:** The assistant does not require any external databases or services.

---

## 2. Architecture: The Stateless State Machine

The assistant will be architected as a Finite State Machine (FSM). It is "stateless" because it does not persist its own state file between sessions; instead, it discovers the state of the *environment* at runtime.

### 2.1. High-Level States

The main states of the FSM are derived directly from the major numbered steps in the [Setup Guide](SETUP_GUIDE.md):

- `START`
- `WORKSPACE_TENANT_CREATED`
- `SUPER_ADMIN_PREPARED`
- `CONTROL_SPREADSHEET_CREATED`
- `CLASP_PROJECT_SETUP`
- `APIS_ENABLED_AND_CONSENT_GRANTED`
- `FIRST_SYNC_COMPLETE`
- `DONE`

### 2.2. State Actions & Sub-steps

While the FSM operates on high-level states, the **action** performed for each state will be implemented as a granular checklist of sub-steps. This provides a detailed, resilient user experience without over-complicating the main state machine.

For example, the `do_setup_clasp_project()` action will internally manage and retry the sub-steps of creating `.clasp.json`, running `clasp login`, and running `clasp push`.

### 2.3. The State Discovery Loop

On startup, the assistant will execute the following logic to determine the current state:

1.  **Run Verifiers Sequentially:** Starting from the first state (`WORKSPACE_TENANT_CREATED`), the assistant will execute a corresponding `verify_()` function for each high-level state in order.
2.  **Identify First Failure:** The *first* `verify_()` function that returns `false` indicates the user's current step.
3.  **Announce and Proceed:** The assistant will announce the discovered state and begin the action for that state. E.g., "Welcome! I've scanned your environment and it looks like you're ready to set up the Apps Script project. Let's begin."

### 2.4. State Detection (`verify_` functions)

Each high-level state will have a `verify_()` function to determine if that state's goals have been met.

- `verify_workspace_tenant_created()`: Will rely on user confirmation.
- `verify_super_admin_prepared()`: Will rely on user confirmation.
- `verify_control_spreadsheet_created()`: Will ask the user to provide the Script ID.
- `verify_clasp_project_setup()`: Check for `.clasp.json`; run `clasp login --status`; run `clasp status`.
- `verify_apis_enabled()`: Use `gcloud services list --enabled` to check if necessary APIs are enabled.
- `verify_first_sync_complete()`: Will rely on user confirmation.

### 2.5. In-Session State Management

The assistant will hold necessary data (like the user-provided Script ID) in memory for the duration of the interactive session. This data will be discarded when the assistant exits.

---

## 3. User Role Clarification

To address potential user confusion regarding the various Google accounts and roles, a new explanatory asset will be created and added to the main [Setup Guide](SETUP_GUIDE.md).

- **Task:** Create a clear table and/or Mermaid diagram in the [Setup Guide](SETUP_GUIDE.md).
- **Content:** The asset will clearly distinguish between:
    - **Google Workspace Super Admin**
    - **The user running the script**
    - **Sheet Editors**
    - **End Users**

---

## 4. Document-Driven User Experience

- **Source of Truth:** The assistant will treat the [Setup Guide](SETUP_GUIDE.md) as the canonical source of truth for the setup steps.
- **Editor Interaction:** Direct editor manipulation is not reliably feasible. As an alternative, the assistant will provide the user with a direct markdown link to the relevant section of the guide for each step.

---

## 5. Implementation Plan

1.  **Phase 1: Scaffolding & State Loop**
    - Create the main FSM structure.
    - Implement the startup State Discovery Loop.
2.  **Phase 2: Implement `verify_` Functions**
    - Implement the state detection logic for each state defined in `2.1`.
3.  **Phase 3: Refactor Assistant Actions**
    - Refactor the existing linear assistant logic into discrete "action" functions that are called by the FSM for each state. These actions will contain the granular sub-step logic.
4.  **Phase 4: Documentation**
    - Create the User Role Clarification table/diagram and insert it into the [Setup Guide](SETUP_GUIDE.md).
    - Update the main [Gemini CLI Assistant Guide](AI_ASSISTANT_GUIDE.md) to reflect the new, more robust functionality.
