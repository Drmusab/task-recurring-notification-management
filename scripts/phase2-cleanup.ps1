# Phase 2 Cleanup Script
# Deletes verified orphan files

$ErrorActionPreference = "Stop"
$ProjectRoot = "c:\Users\Pro\Documents\the optmaztion\task-recurring-notification-management-master"
$LogFile = "$ProjectRoot\cleanup\deleted-files.log"

# Files to delete (verified orphans)
$FilesToDelete = @(
    # Orphan RecurrenceEngine duplicates
    "src\backend\services\RecurrenceEngine.ts",
    "src\domain\recurrence\RecurrenceEngine.ts",
    
    # Orphan DependencyGraph duplicates
    "src\backend\core\engine\DependencyGraph.ts",
    "src\domain\dependencies\DependencyGraph.ts",
    
    # Orphan Parser duplicates  
    "src\infrastructure\parsers\TaskLineParser.ts",
    "src\infrastructure\parsers\TaskLineSerializer.ts",
    
    # Orphan Status/Registry duplicates
    "src\backend\core\models\StatusRegistry.ts",
    "src\shared\types\StatusRegistry.ts",
    "src\backend\core\models\Status.ts",
    "src\shared\types\Status.ts",
    
    # Orphan QueryParser
    "src\domain\query\QueryParser.ts",
    
    # Orphan CompletionHandler
    "src\application\actions\CompletionHandler.ts",
    
    # webhook/ shim folder (after updating imports)
    "src\backend\webhook\types\Error.ts",
    "src\backend\webhook\types\Response.ts",
    "src\backend\webhook\types\Request.ts"
)

Write-Host "Phase 2: Deleting Orphan Files" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

$DeletedCount = 0
$TotalLinesRemoved = 0

foreach ($file in $FilesToDelete) {
    $FullPath = Join-Path $ProjectRoot $file
    
    if (Test-Path $FullPath) {
        # Count lines before deletion
        $Content = Get-Content $FullPath -ErrorAction SilentlyContinue
        $Lines = $Content.Count
        
        # Delete the file
        Remove-Item $FullPath -Force
        
        # Log the deletion
        $LogEntry = @"
        
DELETED: $file
Reason: Orphan file (0 importers) or duplicate
Lines: $Lines
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

"@
        Add-Content -Path $LogFile -Value $LogEntry
        
        Write-Host "[DELETED] $file ($Lines lines)" -ForegroundColor Green
        
        $DeletedCount++
        $TotalLinesRemoved += $Lines
    } else {
        Write-Host "[NOT FOUND] $file" -ForegroundColor Yellow
    }
}

# Delete empty directories
$DirsToRemove = @(
    "src\backend\webhook\types",
    "src\backend\webhook"
)

foreach ($dir in $DirsToRemove) {
    $FullPath = Join-Path $ProjectRoot $dir
    if (Test-Path $FullPath) {
        # Check if directory is empty
        $items = Get-ChildItem $FullPath -ErrorAction SilentlyContinue
        if ($items.Count -eq 0) {
            Remove-Item $FullPath -Force -Recurse
            Write-Host "[DELETED DIR] $dir" -ForegroundColor Green
        }
    }
}

Write-Host "`n===================================`n" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "Files deleted: $DeletedCount" -ForegroundColor White
Write-Host "Lines removed: ~$TotalLinesRemoved" -ForegroundColor White
Write-Host "`nPhase 2 cleanup complete!" -ForegroundColor Green
