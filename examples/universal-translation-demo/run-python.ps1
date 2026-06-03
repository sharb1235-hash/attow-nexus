$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\..\.."

py examples\universal-translation-demo\langgraph_planner.py
py examples\universal-translation-demo\crewai_researcher.py
