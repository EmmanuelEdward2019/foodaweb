#!/usr/bin/env bash
# Run all Supabase migrations against the remote project.
# Usage: ./migrate.sh [--dry-run]
#
# Requirements: supabase CLI (https://supabase.com/docs/guides/cli)
# Install: brew install supabase/tap/supabase
#
# The script reads SUPABASE_DB_PASSWORD from the environment or prompts for it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/supabase/migrations"
PROJECT_REF="jxkmsdwqaxcqrqtmwlln"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] Would push migrations to project $PROJECT_REF"
fi

# ── Preflight checks ────────────────────────────────────────────────
if ! command -v supabase &>/dev/null; then
  echo "Error: supabase CLI not found."
  echo "Install it with:  brew install supabase/tap/supabase"
  echo "Then run:         supabase login"
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Note: SUPABASE_ACCESS_TOKEN not set. supabase CLI will use your stored login."
  echo "If not logged in, run: supabase login"
fi

# ── Link project (idempotent) ────────────────────────────────────────
echo "Linking project $PROJECT_REF..."
if [[ "$DRY_RUN" == false ]]; then
  supabase link --project-ref "$PROJECT_REF" --workdir "$SCRIPT_DIR"
fi

# ── Push migrations ──────────────────────────────────────────────────
echo ""
echo "Migrations to apply (from $MIGRATIONS_DIR):"
for f in "$MIGRATIONS_DIR"/[0-9]*.sql; do
  echo "  $(basename "$f")"
done

echo ""
if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] No changes made."
  exit 0
fi

echo "Pushing migrations..."
supabase db push --workdir "$SCRIPT_DIR"

echo ""
echo "Done. All migrations applied."
