#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

BASIC=0
NO_DASHBOARD=0

for arg in "$@"; do
  case "${arg}" in
    --basic|-b)
      BASIC=1
      ;;
    --no-dashboard)
      NO_DASHBOARD=1
      ;;
    *)
      echo "Unknown option: ${arg}" >&2
      echo "Usage: ./scripts/setup.sh [--basic] [--no-dashboard]" >&2
      exit 2
      ;;
  esac
done

section() {
  printf "\n==> %s\n" "$1"
}

run() {
  echo "+ $*"
  "$@"
}

section "Checking local daemon"
if ! curl -fsS "http://127.0.0.1:7822/api/health"; then
  echo "Nexus daemon is not running. Start Terminal 1 with: docker compose up --build" >&2
  exit 1
fi
echo ""
run curl "http://127.0.0.1:7823/metrics"

section "Installing Python SDK"
run python3 -m pip install -e "sdks/python"

RUN_BASIC_DEMO="${BASIC}"
if [[ "${RUN_BASIC_DEMO}" -eq 0 ]]; then
  if ! run python3 -m pip install langgraph; then
    echo "LangGraph install failed; falling back to the basic Python demo." >&2
    RUN_BASIC_DEMO=1
  fi
fi

section "Running universal translation demo"
if [[ "${RUN_BASIC_DEMO}" -eq 1 ]]; then
  run python3 "examples/python-basic/main.py"
else
  run python3 "examples/universal-translation-demo/langgraph_planner.py"
  run python3 "examples/universal-translation-demo/crewai_researcher.py"
fi

section "Running TypeScript/Vercel-style demo"
if [[ "${RUN_BASIC_DEMO}" -eq 1 ]]; then
  echo "Skipped because --basic was requested or LangGraph install failed."
else
  (
    cd "examples/universal-translation-demo"
    run npm install
    run npm run vercel-demo
  )
fi

section "Inspecting Nexus state"
RUN_ID="universal-demo"
if [[ "${RUN_BASIC_DEMO}" -eq 1 ]]; then
  RUN_ID="demo-run"
fi
run cargo run -p nexus -- agents
run cargo run -p nexus -- channels
run cargo run -p nexus -- log --run "${RUN_ID}"

section "Starting dashboard"
if [[ "${NO_DASHBOARD}" -eq 1 ]]; then
  echo "Dashboard start skipped because --no-dashboard was provided."
  exit 0
fi

echo "Open the Local URL printed by Vite."
echo "If port 5173 is in use, Vite may choose another nearby port."
(
  cd "dashboard"
  run npm install
  run npm run dev
)
