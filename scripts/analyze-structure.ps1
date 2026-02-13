# Repository Structure Visualization
# Generates before/after tree structure for comparison

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Repository Structure Analysis" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

function Get-DirectoryTree {
    param(
        [string]$Path,
        [int]$Depth = 2,
        [string]$Prefix = ""
    )
    
    if ($Depth -le 0) { return }
    
    $items = Get-ChildItem -Path $Path -ErrorAction SilentlyContinue | 
             Where-Object { $_.Name -notmatch '^(node_modules|dist|\.git|\.github)$' } |
             Sort-Object { -not $_.PSIsContainer }, Name
    
    foreach ($item in $items) {
        $isLast = $item -eq $items[-1]
        $connector = if ($isLast) { "└──" } else { "├──" }
        $fileCount = ""
        
        if ($item.PSIsContainer) {
            $count = (Get-ChildItem -Path $item.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
            $fileCount = " ($count files)"
            Write-Host "$Prefix$connector 📁 $($item.Name)$fileCount" -ForegroundColor Cyan
            
            $newPrefix = if ($isLast) { "$Prefix    " } else { "$Prefix│   " }
            Get-DirectoryTree -Path $item.FullName -Depth ($Depth - 1) -Prefix $newPrefix
        } else {
            $size = if ($item.Length -lt 1KB) { "$($item.Length)B" } 
                   elseif ($item.Length -lt 1MB) { "{0:N0}KB" -f ($item.Length / 1KB) }
                   else { "{0:N1}MB" -f ($item.Length / 1MB) }
            Write-Host "$Prefix$connector 📄 $($item.Name) [$size]" -ForegroundColor Gray
        }
    }
}

function Get-FolderSummary {
    param([string]$Path)
    
    $files = Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName -notmatch '(node_modules|dist|\.git)' }
    
    $totalSize = ($files | Measure-Object -Property Length -Sum).Sum
    $fileCount = $files.Count
    $tsFiles = ($files | Where-Object Extension -eq '.ts').Count
    $tsxFiles = ($files | Where-Object Extension -eq '.tsx').Count
    $svelteFiles = ($files | Where-Object Extension -eq '.svelte').Count
    $jsFiles = ($files | Where-Object Extension -eq '.js').Count
    
    [PSCustomObject]@{
        Path = $Path
        Files = $fileCount
        TypeScript = $tsFiles + $tsxFiles
        Svelte = $svelteFiles
        JavaScript = $jsFiles
        TotalSize = "{0:N1}MB" -f ($totalSize / 1MB)
    }
}

# ================================================
# ROOT STRUCTURE
# ================================================

Write-Host "[Root Directory Structure]" -ForegroundColor Yellow
Write-Host ""
Get-DirectoryTree -Path "." -Depth 1

Write-Host "`n"

# ================================================
# SOURCE CODE STRUCTURE (DETAILED)
# ================================================

Write-Host "[Source Code Structure (src/)]" -ForegroundColor Yellow
Write-Host ""
Get-DirectoryTree -Path "src" -Depth 2

Write-Host "`n"

# ================================================
# STATISTICS
# ================================================

Write-Host "[Repository Statistics]" -ForegroundColor Yellow
Write-Host ""

$stats = @(
    (Get-FolderSummary "src\backend"),
    (Get-FolderSummary "src\frontend"),
    (Get-FolderSummary "src\domain"),
    (Get-FolderSummary "src\shared"),
    (Get-FolderSummary "src\application"),
    (Get-FolderSummary "src\infrastructure")
) | Format-Table -AutoSize

$stats

Write-Host ""

# ================================================
# ISSUES DETECTED
# ================================================

Write-Host "[Potential Issues Detected]" -ForegroundColor Yellow
Write-Host ""

$issues = @()

if (Test-Path "src\ui") {
    $uiFiles = (Get-ChildItem "src\ui" -Recurse -File -ErrorAction SilentlyContinue).Count
    if ($uiFiles -eq 0) {
        $issues += "❌ src\ui\ is empty (should be removed)"
    } else {
        $issues += "⚠️  src\ui\ has $uiFiles files (duplicates frontend?)"
    }
}

if (Test-Path "src\stores") {
    $storeFiles = (Get-ChildItem "src\stores" -Recurse -File -ErrorAction SilentlyContinue).Count
    if ($storeFiles -gt 0) {
        $issues += "⚠️  src\stores\ has $storeFiles files (duplicates frontend\stores?)"
    }
}

if (Test-Path "src\components") {
    $compFiles = (Get-ChildItem "src\components" -Recurse -File -ErrorAction SilentlyContinue).Count
    if ($compFiles -le 1) {
        $issues += "❌ src\components\ is nearly empty (should be removed)"
    }
}

if (Test-Path "# Code Citations.md") {
    $issues += "❌ '# Code Citations.md' has invalid filename (space and #)"
}

if (Test-Path "index.css") {
    $issues += "⚠️  index.css at root (should be in src/)"
}

if (Test-Path "index.js") {
    $issues += "⚠️  index.js at root (verify if needed)"
}

$coreFiles = (Get-ChildItem "src\core" -Recurse -File -ErrorAction SilentlyContinue).Count
if ($coreFiles -lt 5) {
    $issues += "ℹ️  src\core\ has only $coreFiles files (could be merged into infrastructure)"
}

$applicationFiles = (Get-ChildItem "src\application" -Recurse -File -ErrorAction SilentlyContinue).Count
if ($applicationFiles -lt 5) {
    $issues += "ℹ️  src\application\ has only $applicationFiles files (could be reorganized)"
}

if ($issues.Count -eq 0) {
    Write-Host "✅ No issues detected!" -ForegroundColor Green
} else {
    foreach ($issue in $issues) {
        Write-Host "  $issue" -ForegroundColor Yellow
    }
}

Write-Host ""

# ================================================
# RECOMMENDATIONS
# ================================================

Write-Host "[Recommendations]" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Execute Phase 1-2 cleanup:" -ForegroundColor White
Write-Host "   .\scripts\reorganize-phase1-2.ps1" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. Review the full reorganization plan:" -ForegroundColor White
Write-Host "   docs\REPOSITORY_REORGANIZATION_PLAN.md" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Consider consolidating:" -ForegroundColor White
Write-Host "   • src\core → src\infrastructure" -ForegroundColor Cyan
Write-Host "   • src\application → better organized structure" -ForegroundColor Cyan
Write-Host "   • src\types → src\shared\types" -ForegroundColor Cyan
Write-Host ""

# ================================================
# FILE COUNT BY TYPE
# ================================================

Write-Host "[File Distribution by Type]" -ForegroundColor Yellow
Write-Host ""

$allFiles = Get-ChildItem -Path "src" -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '(node_modules|dist)' }

$byExtension = $allFiles | Group-Object Extension | 
               Sort-Object Count -Descending |
               Select-Object @{N='Extension'; E={if($_.Name){"*$($_.Name)"}else{"[none]"}}}, Count

$byExtension | Format-Table -AutoSize

Write-Host ""
Write-Host "Total source files: $($allFiles.Count)" -ForegroundColor Green
Write-Host ""
