# Initialises git in this folder, connects it to your GitHub repo and pushes
# the sender files. Run it from PowerShell:
#
#   powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1 -UserName YOUR_GITHUB_USERNAME
#
param(
  [Parameter(Mandatory=$true)][string]$UserName,
  [string]$Repo = "3xcorner-sender",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (Test-Path ".git") {
  Write-Host "-> git repository already exists, reusing it"
} else {
  Write-Host "-> git init"
  git init
}

git checkout -B $Branch

$remote = "https://github.com/$UserName/$Repo.git"
$existing = git remote
if ($existing -contains "origin") {
  Write-Host "-> remote origin already set, updating to $remote"
  git remote set-url origin $remote
} else {
  Write-Host "-> adding remote origin $remote"
  git remote add origin $remote
}

Write-Host "-> staging files"
git add .gitignore package.json send.js messages-seed.js seed-database.js supabase-schema.sql verify-local.js README-NOTIFICATIONS.md sw.js push-to-github.ps1 .github/workflows/schedule.yml

$pending = git status --porcelain
if ([string]::IsNullOrWhiteSpace($pending)) {
  Write-Host "-> nothing to commit (files already committed)"
} else {
  git commit -m "Add push notification sender: send.js, package.json, GitHub Actions schedule"
}

Write-Host "-> pushing to $remote ($Branch)"
git push -u origin $Branch

Write-Host ""
Write-Host "Done. Check the repo at https://github.com/$UserName/$Repo"
