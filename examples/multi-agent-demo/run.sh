#!/usr/bin/env bash
set -euo pipefail

python planner.py
npx tsx researcher.ts
python writer.py
nexus channels
nexus log --run multi-agent-demo

