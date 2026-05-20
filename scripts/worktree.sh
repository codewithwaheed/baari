#!/usr/bin/env bash
# worktree.sh — manage Claude Code worktrees for the Baari monorepo
#
# Usage:
#   ./scripts/worktree.sh list              — show all worktrees + status
#   ./scripts/worktree.sh merge <branch>    — merge branch into main & clean up
#   ./scripts/worktree.sh discard <branch>  — delete branch + worktree
#   ./scripts/worktree.sh clean             — remove stale/already-merged worktrees

set -euo pipefail

# Always resolve to the MAIN worktree root, not whichever worktree we're called from.
# `git worktree list` lists the main worktree first; grab its path.
REPO_ROOT="$(git worktree list --porcelain | awk '/^worktree / { print $2; exit }')"
BASE_BRANCH="${BASE_BRANCH:-main}"
WORKTREE_DIR="$REPO_ROOT/.claude/worktrees"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; DIM='\033[2m';    RST='\033[0m'
bold() { printf '\033[1m%s\033[0m' "$*"; }

# ── helpers ───────────────────────────────────────────────────────────────────
die()  { echo -e "${RED}error:${RST} $*" >&2; exit 1; }
info() { echo -e "${BLU}→${RST} $*"; }
ok()   { echo -e "${GRN}✓${RST} $*"; }
warn() { echo -e "${YLW}⚠${RST}  $*"; }

# Trap unexpected exits and print last command so failures are never silent
trap 'echo -e "${RED}error:${RST} script exited unexpectedly (last command: $BASH_COMMAND)" >&2' ERR

require_clean_main() {
  # Ignore untracked files (e.g. .claude/worktrees) — only fail on staged/modified tracked files.
  # The `|| true` absorbs grep's exit-1 when there are zero matching lines (clean tree),
  # which would otherwise kill the script under set -eo pipefail.
  local dirty
  dirty=$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null | grep -v '^??' | head -1 || true)
  [[ -z "$dirty" ]] || die "main repo has uncommitted changes — stash or commit first"
}

# ── commands ──────────────────────────────────────────────────────────────────

cmd_list() {
  echo ""
  bold "Worktrees\n"
  git -C "$REPO_ROOT" worktree list --porcelain | awk '
    /^worktree / { path=$2 }
    /^branch /   { branch=substr($0, index($0,$2)) }
    /^HEAD /     { sha=substr($2,1,7) }
    /^$/         {
      if (path != "") {
        ahead = 0
        cmd = "git -C \"" path "\" rev-list " ENVIRON["BASE_BRANCH"] "..HEAD --count 2>/dev/null"
        cmd | getline ahead; close(cmd)
        printf "  %-52s  %s  %+d commits\n", branch, sha, ahead+0
      }
      path=""
    }
  ' BASE_BRANCH="$BASE_BRANCH"
  echo ""
}

cmd_merge() {
  local branch="${1:-}"
  [[ -n "$branch" ]] || die "usage: worktree.sh merge <branch>"

  # Find the worktree path for this branch
  local wt_path
  wt_path=$(git -C "$REPO_ROOT" worktree list --porcelain \
    | awk -v b="$branch" '
        /^worktree / { path=$2 }
        /^branch /   { if (index($0,b)) print path }
      ' | head -1)

  [[ -n "$wt_path" ]] || die "no worktree found for branch '$branch'"

  # Verify clean working tree in worktree
  local dirty
  dirty=$(git -C "$wt_path" status --porcelain 2>/dev/null | head -1)
  [[ -z "$dirty" ]] || die "worktree '$wt_path' has uncommitted changes"

  local sha
  sha=$(git -C "$wt_path" rev-parse --short HEAD)
  info "Merging $(bold "$branch") ($sha) into $(bold "$BASE_BRANCH") …"

  require_clean_main

  info "Switching to $BASE_BRANCH in main repo ($REPO_ROOT) …"
  git -C "$REPO_ROOT" checkout "$BASE_BRANCH" \
    || die "Could not checkout '$BASE_BRANCH' in $REPO_ROOT"

  info "Pulling latest $BASE_BRANCH …"
  git -C "$REPO_ROOT" pull --ff-only origin "$BASE_BRANCH" 2>/dev/null \
    && ok "Pulled latest." || warn "Pull skipped (no remote or already up-to-date)."

  info "Merging $branch …"
  git -C "$REPO_ROOT" merge --no-ff "$branch" -m "merge: $branch → $BASE_BRANCH" \
    || die "Merge failed — resolve conflicts in $REPO_ROOT then re-run."

  ok "Merge complete."

  # Remove worktree + branch
  info "Removing worktree at $wt_path …"
  git -C "$REPO_ROOT" worktree remove "$wt_path" --force \
    || warn "Could not remove worktree at $wt_path (may already be gone)."

  info "Deleting branch $branch …"
  git -C "$REPO_ROOT" branch -D "$branch" 2>/dev/null \
    || warn "Branch '$branch' not deleted (may already be gone)."

  ok "Done — $branch merged into $BASE_BRANCH and worktree cleaned up."
}

cmd_discard() {
  local branch="${1:-}"
  [[ -n "$branch" ]] || die "usage: worktree.sh discard <branch>"

  local wt_path
  wt_path=$(git -C "$REPO_ROOT" worktree list --porcelain \
    | awk -v b="$branch" '
        /^worktree / { path=$2 }
        /^branch /   { if (index($0,b)) print path }
      ' | head -1)

  [[ -n "$wt_path" ]] || die "no worktree found for branch '$branch'"

  echo ""
  warn "This will permanently delete:"
  echo "  branch  : $branch"
  echo "  worktree: $wt_path"
  echo ""
  read -rp "  Type 'discard' to confirm: " confirm
  [[ "$confirm" == "discard" ]] || die "Cancelled."

  git -C "$REPO_ROOT" worktree remove "$wt_path" --force
  git -C "$REPO_ROOT" branch -D "$branch"
  ok "Branch and worktree discarded."
}

cmd_clean() {
  info "Pruning stale worktree references …"
  git -C "$REPO_ROOT" worktree prune

  local removed=0
  while IFS= read -r line; do
    local wt_path branch
    wt_path=$(echo "$line" | awk '{print $1}')
    branch=$(echo "$line" | awk '{print $3}')

    # Skip the main worktree
    [[ "$wt_path" == "$REPO_ROOT" ]] && continue

    # Check if branch is already merged into base
    if git -C "$REPO_ROOT" branch --merged "$BASE_BRANCH" | grep -q "${branch#refs/heads/}"; then
      warn "Already merged: $branch  →  removing worktree $wt_path"
      git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
      git -C "$REPO_ROOT" branch -d "${branch#refs/heads/}" 2>/dev/null || true
      removed=$((removed + 1))
    fi
  done < <(git -C "$REPO_ROOT" worktree list | tail -n +2)

  if [[ $removed -eq 0 ]]; then
    ok "Nothing to clean."
  else
    ok "Removed $removed merged worktree(s)."
  fi
}

# ── dispatch ──────────────────────────────────────────────────────────────────
cmd="${1:-list}"
shift || true

case "$cmd" in
  list)    cmd_list ;;
  merge)   cmd_merge "$@" ;;
  discard) cmd_discard "$@" ;;
  clean)   cmd_clean ;;
  *)
    echo "Usage: worktree.sh <list|merge|discard|clean> [branch]"
    exit 1
    ;;
esac
