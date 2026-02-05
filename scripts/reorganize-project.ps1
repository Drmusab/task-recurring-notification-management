# =============================================================================
# Project Reorganization Script - Phase 1 & 2 (Safe Operations)
# =============================================================================
# This script reorganizes documentation and scripts WITHOUT renaming source files
# Run with: .\scripts\reorganize-project.ps1 -DryRun
# =============================================================================

param(
    [switch]$DryRun = $false,
    [switch]$Force = $false
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot | Split-Path -Parent

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "[STEP] $Message" -ForegroundColor Cyan
}

function Write-Action {
    param([string]$Message)
    Write-Host "  > $Message" -ForegroundColor Gray
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  + $Message" -ForegroundColor Green
}

function Write-Preview {
    param([string]$Message)
    Write-Host "  [DRY-RUN] $Message" -ForegroundColor Yellow
}

function Move-SafeFile {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    $SourcePath = Join-Path $ProjectRoot $Source
    $DestPath = Join-Path $ProjectRoot $Destination
    
    if (-not (Test-Path $SourcePath)) {
        Write-Host "  ! Source not found: $Source" -ForegroundColor Yellow
        return
    }
    
    $DestDir = Split-Path -Parent $DestPath
    
    if ($DryRun) {
        Write-Preview "$Source -> $Destination"
    } else {
        if (-not (Test-Path $DestDir)) {
            New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
        }
        Move-Item -Path $SourcePath -Destination $DestPath -Force
        Write-Ok "$Source -> $Destination"
    }
}

function New-SafeDirectory {
    param([string]$Path)
    
    $FullPath = Join-Path $ProjectRoot $Path
    
    if ($DryRun) {
        Write-Preview "Create directory: $Path"
    } else {
        if (-not (Test-Path $FullPath)) {
            New-Item -ItemType Directory -Path $FullPath -Force | Out-Null
            Write-Ok "Created: $Path"
        }
    }
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

Write-Host "========================================"  -ForegroundColor Magenta
Write-Host " Project Reorganization Script"  -ForegroundColor Magenta
Write-Host "========================================"  -ForegroundColor Magenta

if ($DryRun) {
    Write-Host ""
    Write-Host "*** DRY RUN MODE - No changes will be made ***" -ForegroundColor Yellow
    Write-Host ""
}

# -----------------------------------------------------------------------------
# PHASE 1: Documentation Reorganization
# -----------------------------------------------------------------------------

Write-Step "Phase 1: Reorganizing Documentation"

New-SafeDirectory "docs/internal"
New-SafeDirectory "docs/guides"
New-SafeDirectory "docs/features"
New-SafeDirectory "docs/architecture"
New-SafeDirectory "docs/api/http-examples"

Write-Action "Moving root-level documentation to docs/internal/"

$RootDocsToInternal = @(
    @{ Source = "AI_AGENT_CODING_PROMPT.md"; Dest = "docs/internal/ai-agent-coding-prompt.md" }
    @{ Source = "BACKEND_AUDIT_REPORT.md"; Dest = "docs/internal/backend-audit-report.md" }
    @{ Source = "BACKEND_FIXES_SUMMARY.md"; Dest = "docs/internal/backend-fixes-summary.md" }
    @{ Source = "FRONTEND_AUDIT_REPORT.md"; Dest = "docs/internal/frontend-audit-report.md" }
    @{ Source = "FRONTEND_REFACTORING_PLAN.md"; Dest = "docs/internal/frontend-refactoring-plan.md" }
    @{ Source = "IMPLEMENTATION_SUMMARY.md"; Dest = "docs/internal/implementation-summary.md" }
    @{ Source = "INTEGRATION_TEST_CHECKLIST.md"; Dest = "docs/internal/integration-test-checklist.md" }
    @{ Source = "REFACTORING_PROGRESS.md"; Dest = "docs/internal/refactoring-progress.md" }
    @{ Source = "REFACTORING_QUICK_GUIDE.md"; Dest = "docs/internal/refactoring-quick-guide.md" }
)

foreach ($item in $RootDocsToInternal) {
    Move-SafeFile -Source $item.Source -Destination $item.Dest
}

Write-Action "Reorganizing docs/ folder structure"

$DocsReorganization = @(
    @{ Source = "docs/AI_FEATURES.md"; Dest = "docs/features/ai-suggestions.md" }
    @{ Source = "docs/AUTO_CREATION.md"; Dest = "docs/features/auto-creation.md" }
    @{ Source = "docs/bulk-performance_Version3"; Dest = "docs/features/bulk-operations.md" }
    @{ Source = "docs/global-filter-query.md"; Dest = "docs/features/global-filter.md" }
    @{ Source = "docs/InlineTaskParser-Examples.md"; Dest = "docs/features/inline-task-parser-examples.md" }
    @{ Source = "docs/InlineTaskSyntax.md"; Dest = "docs/features/inline-task-syntax.md" }
    @{ Source = "docs/natural-language.md"; Dest = "docs/features/natural-language.md" }
    @{ Source = "docs/NATURAL_LANGUAGE_DATES.md"; Dest = "docs/features/natural-language-dates.md" }
    @{ Source = "docs/outbound-webhooks_Version2.md"; Dest = "docs/features/outbound-webhooks.md" }
    @{ Source = "docs/recurrence-edge-cases_Version2"; Dest = "docs/features/recurrence-edge-cases.md" }
    @{ Source = "docs/advanced-features.md"; Dest = "docs/features/advanced-features.md" }
    @{ Source = "docs/keyboard-shortcuts-reference.md"; Dest = "docs/guides/keyboard-shortcuts.md" }
    @{ Source = "docs/migration-guide.md"; Dest = "docs/guides/migration.md" }
    @{ Source = "docs/mobile.md"; Dest = "docs/guides/mobile-usage.md" }
    @{ Source = "docs/presets.md"; Dest = "docs/guides/presets.md" }
    @{ Source = "docs/query-examples.md"; Dest = "docs/guides/query-examples.md" }
    @{ Source = "docs/query-language.md"; Dest = "docs/guides/query-language.md" }
    @{ Source = "docs/QUERY_LANGUAGE.md"; Dest = "docs/guides/query-language-reference.md" }
    @{ Source = "docs/RECURRENCE_GUIDE.md"; Dest = "docs/guides/recurrence.md" }
    @{ Source = "docs/settings-guide.md"; Dest = "docs/guides/settings.md" }
    @{ Source = "docs/split-view-dashboard.md"; Dest = "docs/guides/split-view.md" }
    @{ Source = "docs/split-view-migration.md"; Dest = "docs/guides/split-view-migration.md" }
    @{ Source = "docs/task-format-reference.md"; Dest = "docs/guides/task-format.md" }
    @{ Source = "docs/ICON_SYSTEM.md"; Dest = "docs/architecture/icon-system.md" }
    @{ Source = "docs/ICON_IMPLEMENTATION_SUMMARY.md"; Dest = "docs/internal/icon-implementation-summary.md" }
    @{ Source = "docs/OPTIMISTIC_UPDATE_GUIDE.md"; Dest = "docs/architecture/optimistic-updates.md" }
    @{ Source = "docs/PHASE1_COMPLETION_SUMMARY.md"; Dest = "docs/internal/phase1-completion-summary.md" }
    @{ Source = "docs/PHASE3_FEATURES.md"; Dest = "docs/architecture/phase3-features.md" }
    @{ Source = "docs/PHASE4_USER_GUIDE.md"; Dest = "docs/architecture/phase4-user-guide.md" }
    @{ Source = "docs/RRULE_ENGINE_IMPLEMENTATION.md"; Dest = "docs/architecture/rrule-engine.md" }
    @{ Source = "docs/SHORTCUTS.md"; Dest = "docs/architecture/shortcuts-implementation.md" }
)

foreach ($item in $DocsReorganization) {
    Move-SafeFile -Source $item.Source -Destination $item.Dest
}

Write-Action "Moving HTTP examples to docs/api/"
Move-SafeFile -Source "examples/http/bulk-operations.http" -Destination "docs/api/http-examples/bulk-operations.http"
Move-SafeFile -Source "examples/http/task-commands.http" -Destination "docs/api/http-examples/task-commands.http"

if (-not $DryRun) {
    $ExamplesHttpPath = Join-Path $ProjectRoot "examples/http"
    $ExamplesPath = Join-Path $ProjectRoot "examples"
    if ((Test-Path $ExamplesHttpPath) -and ((Get-ChildItem $ExamplesHttpPath | Measure-Object).Count -eq 0)) {
        Remove-Item $ExamplesHttpPath -Force
    }
    if ((Test-Path $ExamplesPath) -and ((Get-ChildItem $ExamplesPath | Measure-Object).Count -eq 0)) {
        Remove-Item $ExamplesPath -Force
        Write-Ok "Removed empty examples/ folder"
    }
}

# -----------------------------------------------------------------------------
# PHASE 2: Scripts Reorganization
# -----------------------------------------------------------------------------

Write-Step "Phase 2: Reorganizing Scripts"

New-SafeDirectory "scripts/dev"
New-SafeDirectory "scripts/build"
New-SafeDirectory "scripts/icons"

Write-Action "Moving utility scripts from root to scripts/dev/"

$RootScriptsToMove = @(
    @{ Source = "debug-recurrence.js"; Dest = "scripts/dev/debug-recurrence.js" }
    @{ Source = "fix-relative-imports.cjs"; Dest = "scripts/dev/fix-relative-imports.cjs" }
    @{ Source = "update-imports.cjs"; Dest = "scripts/dev/update-imports.cjs" }
)

foreach ($item in $RootScriptsToMove) {
    Move-SafeFile -Source $item.Source -Destination $item.Dest
}

Write-Action "Reorganizing scripts/ folder"

$ScriptsReorganization = @(
    @{ Source = "scripts/make_dev_link.js"; Dest = "scripts/dev/make-dev-link.js" }
    @{ Source = "scripts/generate-plugin-images.js"; Dest = "scripts/build/generate-plugin-images.js" }
    @{ Source = "scripts/generate-icons.js"; Dest = "scripts/icons/generate-icons.js" }
    @{ Source = "scripts/generate-png-placeholders.js"; Dest = "scripts/icons/generate-png-placeholders.js" }
)

foreach ($item in $ScriptsReorganization) {
    Move-SafeFile -Source $item.Source -Destination $item.Dest
}

# -----------------------------------------------------------------------------
# PHASE 3: Cleanup
# -----------------------------------------------------------------------------

Write-Step "Phase 3: Cleanup"

Write-Action "Checking for build artifacts to clean up"

$ArtifactsToRemove = @("build.log", "package.zip")

foreach ($artifact in $ArtifactsToRemove) {
    $ArtifactPath = Join-Path $ProjectRoot $artifact
    if (Test-Path $ArtifactPath) {
        if ($DryRun) {
            Write-Preview "Would remove: $artifact"
        } else {
            Remove-Item $ArtifactPath -Force
            Write-Ok "Removed: $artifact"
        }
    }
}

$DocsIntegrationPath = Join-Path $ProjectRoot "docs/integration"
if ((Test-Path $DocsIntegrationPath) -and ((Get-ChildItem $DocsIntegrationPath | Measure-Object).Count -eq 0)) {
    if ($DryRun) {
        Write-Preview "Would remove empty: docs/integration/"
    } else {
        Remove-Item $DocsIntegrationPath -Force
        Write-Ok "Removed empty: docs/integration/"
    }
}

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "========================================"  -ForegroundColor Magenta
Write-Host " Reorganization Complete!"  -ForegroundColor Magenta
Write-Host "========================================"  -ForegroundColor Magenta

if ($DryRun) {
    Write-Host ""
    Write-Host "This was a DRY RUN. No changes were made." -ForegroundColor Yellow
    Write-Host "Run without -DryRun flag to execute changes." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Update package.json script paths if needed" -ForegroundColor White
    Write-Host "  2. Run: npm run build" -ForegroundColor White
    Write-Host "  3. Run: npm test" -ForegroundColor White
    Write-Host "  4. Commit your changes with git" -ForegroundColor White
}

Write-Host ""
