$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\.."))
py -m pip install -e sdks\python
py examples\broken-agent-recovery\run_demo.py
