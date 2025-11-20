#!/usr/bin/env bash
set -euo pipefail

BRANCH_NAME="feature/connectors"

die() {
  echo "[connector-branch] $1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage:
  connector_branch.sh create <connector_commit> [branch_name]
    - Create (or reset) a connector branch from the specified commit hash.

  connector_branch.sh rebase <main_ref> [branch_name]
    - Rebase the connector branch onto the given main reference (default origin/main).

  connector_branch.sh status [branch_name]
    - Show the current connector branch commit and whether it diverges from main.

Notes:
  - The script will refuse to run with a dirty working tree.
  - <connector_commit> is the commit that still contains the connector code (for example, a merge commit from PR #19).
  - The default branch name is "feature/connectors"; override by passing a third argument.
USAGE
  exit 1
}

ensure_clean_tree() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "Working tree is dirty. Commit or stash changes first."
  fi
}

resolve_branch_name() {
  if [[ -n "${2:-}" ]]; then
    echo "$2"
  else
    echo "$BRANCH_NAME"
  fi
}

create_branch() {
  local commit_ref="$1"
  local branch_name
  branch_name=$(resolve_branch_name "$@")

  git rev-parse --verify "$commit_ref" >/dev/null 2>&1 || die "Commit $commit_ref not found."

  git branch -f "$branch_name" "$commit_ref"
  echo "Connector branch '$branch_name' now points to $commit_ref."
  echo "Use 'git checkout $branch_name' to switch to it."
}

rebase_branch() {
  local main_ref="$1"
  local branch_name
  branch_name=$(resolve_branch_name "$@")

  git rev-parse --verify "$branch_name" >/dev/null 2>&1 || die "Branch $branch_name does not exist."
  git rev-parse --verify "$main_ref" >/dev/null 2>&1 || die "Main ref $main_ref not found."

  git checkout "$branch_name"
  git rebase "$main_ref"
  echo "Rebased '$branch_name' onto '$main_ref'."
}

status_branch() {
  local branch_name
  branch_name=$(resolve_branch_name "$@")

  git rev-parse --verify "$branch_name" >/dev/null 2>&1 || die "Branch $branch_name does not exist."
  local main_ref
  main_ref="${2:-origin/main}"

  local branch_sha main_sha
  branch_sha=$(git rev-parse "$branch_name")
  main_sha=$(git rev-parse "$main_ref")

  echo "Connector branch: $branch_name ($branch_sha)"
  echo "Main reference:  $main_ref ($main_sha)"
  git log --oneline --left-right --boundary "$main_ref"..."$branch_name"
}

main() {
  [[ $# -lt 1 ]] && usage
  local cmd="$1"
  shift || true

  case "$cmd" in
    create)
      [[ $# -lt 1 ]] && usage
      ensure_clean_tree
      create_branch "$@"
      ;;
    rebase)
      [[ $# -lt 1 ]] && usage
      ensure_clean_tree
      rebase_branch "$@"
      ;;
    status)
      ensure_clean_tree
      status_branch "$@"
      ;;
    *)
      usage
      ;;
  esac
}

main "$@"
