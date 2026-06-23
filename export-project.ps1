# ==========================================
# DrumTracerDEV Full Project Export Script
# Creates a clean ZIP archive for handoff
# ==========================================

Write-Host "Preparing DrumTracerDEV export..."

# Ensure script runs from project root
$projectRoot = Get-Location
Write-Host "Project root: $projectRoot"

# Output folder
$exportFolder = "$projectRoot\export"
$zipPath = "$projectRoot\DrumTracerDEV_Export.zip"

# Remove old export folder if exists
if (Test-Path $exportFolder) {
    Remove-Item -Recurse -Force $exportFolder
}

# Remove old zip if exists
if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
}

# Create export folder
New-Item -ItemType Directory -Path $exportFolder | Out-Null

# Copy backend
Write-Host "Copying backend..."
Copy-Item -Recurse -Force "$projectRoot\backend" "$exportFolder\backend"

# Copy frontend
Write-Host "Copying frontend..."
Copy-Item -Recurse -Force "$projectRoot\frontend" "$exportFolder\frontend"

# Copy shared folders
$sharedFolders = @("shared", "assets", "docs")

foreach ($folder in $sharedFolders) {
    if (Test-Path "$projectRoot\$folder") {
        Write-Host "Copying $folder..."
        Copy-Item -Recurse -Force "$projectRoot\$folder" "$exportFolder\$folder"
    }
}

# Remove heavy or unnecessary folders
$pathsToRemove = @(
    "$exportFolder\frontend\node_modules",
    "$exportFolder\frontend\dist",
    "$exportFolder\backend\**\bin",
    "$exportFolder\backend\**\obj"
)

foreach ($path in $pathsToRemove) {
    Get-ChildItem -Path $path -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Create ZIP archive
Write-Host "Creating ZIP archive..."
Compress-Archive -Path "$exportFolder\*" -DestinationPath $zipPath

Write-Host "`n====================================="
Write-Host " DrumTracerDEV Export Complete"
Write-Host "====================================="
Write-Host "Exported to: $zipPath"
Write-Host "====================================="
