param(
  [switch]$Basic,
  [switch]$NoDashboard
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoRoot

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
}

function Invoke-CommandChecked {
  param(
    [string]$File,
    [string[]]$Arguments,
    [string]$WorkingDirectory = $RepoRoot
  )

  Push-Location $WorkingDirectory
  try {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$File $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Test-DaemonHealth {
  $health = & curl.exe -fsS "http://127.0.0.1:7822/api/health" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Nexus daemon is not running. Start Terminal 1 with: docker compose up --build" -ForegroundColor Yellow
    exit 1
  }
  return $health
}

Write-Section "Checking local daemon"
$health = Test-DaemonHealth
Write-Host $health
Invoke-CommandChecked "curl.exe" @("http://127.0.0.1:7823/metrics")

Write-Section "Installing Python SDK"
Invoke-CommandChecked "py" @("-m", "pip", "install", "-e", ".") (Join-Path $RepoRoot "sdks\python")

$runBasicDemo = [bool]$Basic
if (-not $runBasicDemo) {
  try {
    Invoke-CommandChecked "py" @("-m", "pip", "install", "langgraph")
  } catch {
    Write-Host "LangGraph install failed; falling back to the basic Python demo." -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor DarkYellow
    $runBasicDemo = $true
  }
}

Write-Section "Running universal translation demo"
if ($runBasicDemo) {
  Invoke-CommandChecked "py" @("examples\python-basic\main.py")
} else {
  Invoke-CommandChecked "py" @("examples\universal-translation-demo\langgraph_planner.py")
  Invoke-CommandChecked "py" @("examples\universal-translation-demo\crewai_researcher.py")
}

Write-Section "Running TypeScript/Vercel-style demo"
if ($runBasicDemo) {
  Write-Host "Skipped because -Basic was requested or LangGraph install failed."
} else {
  $UniversalDemoDir = Join-Path $RepoRoot "examples\universal-translation-demo"
  Invoke-CommandChecked "npm.cmd" @("install") $UniversalDemoDir
  Invoke-CommandChecked "npm.cmd" @("run", "vercel-demo") $UniversalDemoDir
}

Write-Section "Inspecting Nexus state"
$runId = if ($runBasicDemo) { "demo-run" } else { "universal-demo" }
Invoke-CommandChecked "cargo" @("run", "-p", "nexus", "--", "agents")
Invoke-CommandChecked "cargo" @("run", "-p", "nexus", "--", "channels")
Invoke-CommandChecked "cargo" @("run", "-p", "nexus", "--", "log", "--run", $runId)

Write-Section "Starting dashboard"
if ($NoDashboard) {
  Write-Host "Dashboard start skipped because -NoDashboard was provided."
  exit 0
}

Write-Host "When Vite prints the Local URL, open it in your browser."
Write-Host "If port 5173 is in use, Vite may choose another nearby port."
$DashboardDir = Join-Path $RepoRoot "dashboard"
Invoke-CommandChecked "npm.cmd" @("install") $DashboardDir
Invoke-CommandChecked "npm.cmd" @("run", "dev") $DashboardDir
