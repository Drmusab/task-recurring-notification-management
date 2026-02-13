# Repository Reorganization Script
# Phase 1-2: Low Risk Cleanup
# Safe to execute - removes empty folders, fixes filenames, organizes docs

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Repository Reorganization - Phase 1-2" -ForegroundColor Cyan
Write-Host "  Low Risk: Cleanup & Documentation" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No changes will be made`n" -ForegroundColor Yellow
}

function Execute-Command {
    param(
        [string]$Description,
        [scriptblock]$Command,
        [switch]$Critical = $false
    )
    
    if ($Verbose) {
        Write-Host "→ $Description" -ForegroundColor Gray
    }
    
    try {
        if ($DryRun) {
            Write-Host "  WOULD EXECUTE: $Description" -ForegroundColor DarkGray
        } else {
            & $Command
            Write-Host "  Done: $Description" -ForegroundColor Green
        }
    } catch {
        if ($Critical) {
            Write-Host "  ✗ ERROR: $Description" -ForegroundColor Red
            Write-Host "    $_" -ForegroundColor Red
            throw
        } else {
            Write-Host "  ⚠ Warning: $Description - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# ============================================
# PHASE 1: CLEANUP EMPTY/DUPLICATE FOLDERS
# ============================================

Write-Host "Phase 1: Cleanup Empty/Duplicate Folders" -ForegroundColor Cyan
Write-Host ""

# Check and remove src/ui (empty)
if (Test-Path "src\ui") {
    $uiFiles = Get-ChildItem -Path "src\ui" -Recurse -File -ErrorAction SilentlyContinue
    if ($uiFiles.Count -eq 0) {
        Execute-Command "Remove empty src\ui folder" {
            Remove-Item "src\ui" -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  ⚠ src\ui has $($uiFiles.Count) files - skipping" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ℹ src\ui already removed" -ForegroundColor Gray
}

# Remove duplicate store files
if (Test-Path "src\stores\TaskStore.ts") {
    Execute-Command "Remove duplicate src\stores\TaskStore.ts" {
        Remove-Item "src\stores\TaskStore.ts" -Force
    }
} else {
    Write-Host "  ℹ src\stores\TaskStore.ts already removed" -ForegroundColor Gray
}

if (Test-Path "src\stores\SettingsStore.ts") {
    Execute-Command "Remove duplicate src\stores\SettingsStore.ts" {
        Remove-Item "src\stores\SettingsStore.ts" -Force
    }
} else {
    Write-Host "  ℹ src\stores\SettingsStore.ts already removed" -ForegroundColor Gray
}

# Remove src/stores folder if empty
if (Test-Path "src\stores") {
    $storeFiles = Get-ChildItem -Path "src\stores" -Recurse -File -ErrorAction SilentlyContinue
    if ($storeFiles.Count -eq 0) {
        Execute-Command "Remove empty src\stores folder" {
            Remove-Item "src\stores" -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  ⚠ src\stores has $($storeFiles.Count) files - skipping" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ℹ src\stores already removed" -ForegroundColor Gray
}

# Remove src/components folder if nearly empty
if (Test-Path "src\components") {
    $compFiles = Get-ChildItem -Path "src\components" -Recurse -File -ErrorAction SilentlyContinue
    if ($compFiles.Count -le 1) {
        Execute-Command "Remove empty/minimal src\components folder" {
            Remove-Item "src\components" -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  ⚠ src\components has $($compFiles.Count) files - manual review needed" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ℹ src\components already removed" -ForegroundColor Gray
}

Write-Host ""

# ============================================
# FIX ROOT-LEVEL FILENAMES
# ============================================

Write-Host "Phase 1: Fix Root-Level Filenames" -ForegroundColor Cyan
Write-Host ""

if (Test-Path "# Code Citations.md") {
    Execute-Command "Rename '# Code Citations.md' to 'CODE_CITATIONS.md'" {
        Rename-Item "# Code Citations.md" "CODE_CITATIONS.md" -Force
    }
} else {
    Write-Host "  ℹ '# Code Citations.md' not found or already renamed" -ForegroundColor Gray
}

# Move index.css if it exists at root
if (Test-Path "index.css") {
    Execute-Command "Create src\styles directory" {
        New-Item -ItemType Directory -Path "src\styles" -ErrorAction SilentlyContinue | Out-Null
    }
    Execute-Command "Move index.css to src\styles\" {
        Move-Item "index.css" "src\styles\index.css" -Force
    }
} else {
    Write-Host "  ℹ index.css not found at root (already moved or doesn't exist)" -ForegroundColor Gray
}

Write-Host ""

# ============================================
# PHASE 2: ORGANIZE DOCUMENTATION
# ============================================

Write-Host "Phase 2: Organize Documentation" -ForegroundColor Cyan
Write-Host ""

# Create documentation structure
Execute-Command "Create docs\architecture directory" {
    New-Item -ItemType Directory -Path "docs\architecture" -ErrorAction SilentlyContinue | Out-Null
}

Execute-Command "Create docs\guides directory" {
    New-Item -ItemType Directory -Path "docs\guides" -ErrorAction SilentlyContinue | Out-Null
}

Execute-Command "Create docs\refactoring directory" {
    New-Item -ItemType Directory -Path "docs\refactoring" -ErrorAction SilentlyContinue | Out-Null
}

# Move refactoring documentation
$refactoringDocs = Get-ChildItem -Path "docs" -Filter "FRONTEND_*.md" -File -ErrorAction SilentlyContinue
foreach ($doc in $refactoringDocs) {
    Execute-Command "Move $($doc.Name) to docs\refactoring\" {
        Move-Item $doc.FullName "docs\refactoring\" -Force -ErrorAction SilentlyContinue
    }
}

# Move architecture documentation
$archDocs = @(
    "docs\ARCHITECTURAL_*.md",
    "docs\PHASE*.md",
    "docs\REORGANIZATION_*.md",
    "docs\STRUCTURE_*.md",
    "docs\REFACTORING_PROGRESS.md",
    "docs\REFACTORING_SUMMARY.md"
)

foreach ($pattern in $archDocs) {
    $docs = Get-ChildItem -Path $pattern -File -ErrorAction SilentlyContinue
    foreach ($doc in $docs) {
        Execute-Command "Move $($doc.Name) to docs\architecture\" {
            Move-Item $doc.FullName "docs\architecture\" -Force -ErrorAction SilentlyContinue
        }
    }
}

# Move guide documentation
$guideDocs = Get-ChildItem -Path "docs" -Filter "*GUIDE*.md" -File -ErrorAction SilentlyContinue
foreach ($doc in $guideDocs) {
    Execute-Command "Move $($doc.Name) to docs\guides\" {
        Move-Item $doc.FullName "docs\guides\" -Force -ErrorAction SilentlyContinue
    }
}

$guideDocsLower = Get-ChildItem -Path "docs" -Filter "*guide*.md" -File -ErrorAction SilentlyContinue
foreach ($doc in $guideDocsLower) {
    if ($doc.Name -notmatch "GUIDE") {  # Avoid duplicates
        Execute-Command "Move $($doc.Name) to docs\guides\" {
            Move-Item $doc.FullName "docs\guides\" -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host ""

# ============================================
# SUMMARY
# ============================================

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Phase 1-2 Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "This was a DRY RUN. To execute changes, run:" -ForegroundColor Yellow
    Write-Host "  .\scripts\reorganize-phase1-2.ps1" -ForegroundColor White
    Write-Host ""
}

Write-Host "Summary of changes:" -ForegroundColor Cyan
Write-Host "  ✓ Removed empty/duplicate folders" -ForegroundColor Green
Write-Host "  ✓ Fixed root-level filenames" -ForegroundColor Green
Write-Host "  ✓ Organized documentation into subdirectories" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Verify changes with: git status" -ForegroundColor White
Write-Host "  2. Build project: npm run build" -ForegroundColor White
Write-Host "  3. If successful, commit changes" -ForegroundColor White
Write-Host "  4. Review REPOSITORY_REORGANIZATION_PLAN.md for Phase 3+" -ForegroundColor White
Write-Host ""

Write-Host "To run validation:" -ForegroundColor Yellow
Write-Host "  npm run build" -ForegroundColor White
Write-Host ""
