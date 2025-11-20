# Connector Branch Strategy

This repository keeps **main** free of connector logic. Connector experiments live in a dedicated branch (for example `feature/connectors`) and can be revived when needed without reintroducing them to main by default.

## Goals
- Preserve a clean, supported baseline on `main` with no connector artifacts.
- Maintain a reusable connector implementation in a side branch for future reference or reuse.
- Allow easy rebasing or cherry-picking of connector changes onto current `main` when explicitly desired.

## Recommended workflow
1. **Create and maintain a connector branch**
   - Branch from the commit that contained the working connector code (e.g., `git checkout -b feature/connectors <commit-with-connectors>`), or use the helper below to automate the branch creation.
   - Keep this branch rebased on the latest `main` when you need updated dependencies, but avoid merging it back unless the connectors are officially supported again.

2. **Keep main clean**  
   - Reverts on `main` (like the recent connector removal) stay as-is.  
   - Do not cherry-pick connector commits onto `main`; instead, open PRs targeting the connector branch if updates are required.

3. **Revive connectors on demand**
   - When you want to use the connectors, either:
     - Checkout the connector branch directly (`git checkout feature/connectors`), or
     - Cherry-pick specific connector commits onto a short-lived feature branch that targets a PR (not `main`).

4. **Open PRs against the connector branch**  
   - Set the base branch of connector-related PRs to `feature/connectors` (or similar) so that reviews happen without touching `main`.  
   - If the branch lags behind `main`, rebase it: `git checkout feature/connectors && git rebase origin/main`.

5. **Document the source of truth**  
   - Treat `main` as the authoritative branch for supported functionality.  
   - Treat the connector branch as experimental/optional. Note this status in PR descriptions to prevent accidental promotion to `main`.

## Quick commands
You can perform the steps above manually or with `scripts/connector_branch.sh`.

- Create (or reset) the branch from a known connector commit:
  ```bash
  ./scripts/connector_branch.sh create <connector-commit>
  # example: ./scripts/connector_branch.sh create deadbeef
  ```
- Update the connector branch with latest `main` changes:
  ```bash
  ./scripts/connector_branch.sh rebase origin/main
  ```
- Inspect divergence between the connector branch and main:
  ```bash
  ./scripts/connector_branch.sh status
  ```
- Open a PR that targets the connector branch (GitHub UI): choose `feature/connectors` as the base branch.

### About `scripts/connector_branch.sh`
The helper refuses to run with a dirty working tree and defaults to using the branch name `feature/connectors`. Pass a custom branch name as the final argument to any subcommand if you prefer a different name.

Following this approach keeps `main` free of connector traces while preserving the connector code for future use.
