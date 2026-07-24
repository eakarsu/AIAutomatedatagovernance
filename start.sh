#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$project_dir"
[[ -f .env ]] || { echo 'Missing .env; copy .env.example and configure it.' >&2; exit 1; }
[[ -d backend/node_modules && -d frontend/node_modules ]] || { echo 'Dependencies are missing; run scripts/bootstrap.sh explicitly.' >&2; exit 1; }
set -a; source .env; set +a
: "${BACKEND_PORT:?BACKEND_PORT is required}"
: "${FRONTEND_PORT:?FRONTEND_PORT is required}"
[[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || { echo 'BACKEND_PORT and FRONTEND_PORT must differ.' >&2; exit 1; }
for runtime_port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if lsof -nP -iTCP:"$runtime_port" -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $runtime_port is already in use; no process was changed." >&2; exit 1; fi
done
export RUNTIME_PROJECT_NAME='AI Automated Data Governance'
export RUNTIME_AI_ENDPOINT='/api/ai/data-governance-review'
export RUNTIME_AI_FEATURE='data-governance-evidence-review'
export RUNTIME_AI_SYSTEM_PROMPT='Review data-governance evidence for ownership, lineage, quality controls, classification, access policy, retention, and human approval boundaries.'
(BACKEND_PORT="$BACKEND_PORT" PORT="$BACKEND_PORT" node backend/server.js) & backend_pid=$!
(cd frontend && ./node_modules/.bin/vite --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort) & frontend_pid=$!
cleanup() { trap - INT TERM EXIT; kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; wait "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do sleep 1; done
echo 'A child service exited unexpectedly.' >&2
exit 1
