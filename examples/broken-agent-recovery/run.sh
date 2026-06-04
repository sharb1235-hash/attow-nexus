#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 -m pip install -e sdks/python
python3 examples/broken-agent-recovery/run_demo.py
