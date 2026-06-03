$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot"

npm.cmd install
npm.cmd run vercel-demo
