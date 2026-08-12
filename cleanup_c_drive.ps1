# DigitalGer — C Drive Cleanup Script
# Хэрэглэх: PowerShell-г "Run as Administrator" ажиллуулж энэ файлыг нээх
# Эсвэл: Right-click → "Run with PowerShell"

$ErrorActionPreference = "SilentlyContinue"

function Get-FolderSize($path) {
    if (Test-Path $path) {
        $size = (Get-ChildItem -Path $path -Recurse -Force | Measure-Object -Property Length -Sum).Sum
        return [math]::Round($size / 1GB, 2)
    }
    return 0
}

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  DigitalGer C Drive Cleanup" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# C диск одоогийн байдал
$disk = Get-PSDrive C
$freeBefore = [math]::Round($disk.Free / 1GB, 2)
$used = [math]::Round(($disk.Used + $disk.Free) / 1GB, 2)
Write-Host "C диск нийт: $used GB" -ForegroundColor White
Write-Host "Чөлөөт зай (одоо): $freeBefore GB`n" -ForegroundColor Yellow

# ============================================================
# 1. Claude session temp files (хамгийн их зай авч байгаа)
# ============================================================
$claudePath = "$env:APPDATA\Claude\local-agent-mode-sessions"
$claudeSize = Get-FolderSize $claudePath
Write-Host "1. Claude session файлууд: $claudeSize GB" -ForegroundColor Yellow

if (Test-Path $claudePath) {
    # outputs фолдеруудыг устга (завсрын ажлын файлууд)
    Get-ChildItem -Path $claudePath -Recurse -Directory -Filter "outputs" | ForEach-Object {
        Write-Host "   Устгаж байна: $($_.FullName)" -ForegroundColor Gray
        Remove-Item -Path $_.FullName -Recurse -Force
    }
    # uploads фолдеруудыг устга
    Get-ChildItem -Path $claudePath -Recurse -Directory -Filter "uploads" | ForEach-Object {
        Write-Host "   Устгаж байна: $($_.FullName)" -ForegroundColor Gray
        Remove-Item -Path $_.FullName -Recurse -Force
    }
    # __pycache__ устга
    Get-ChildItem -Path $claudePath -Recurse -Directory -Filter "__pycache__" | ForEach-Object {
        Remove-Item -Path $_.FullName -Recurse -Force
    }
    Write-Host "   [OK] Claude temp файлууд цэвэрлэгдлээ" -ForegroundColor Green
}

# ============================================================
# 2. Windows Temp файлууд
# ============================================================
Write-Host "`n2. Windows Temp файлууд цэвэрлэж байна..." -ForegroundColor Yellow

# User temp
$tempPath = $env:TEMP
if (Test-Path $tempPath) {
    Get-ChildItem -Path $tempPath -Force | Remove-Item -Recurse -Force
    Write-Host "   [OK] %TEMP% цэвэрлэгдлээ" -ForegroundColor Green
}

# Windows temp
$winTemp = "C:\Windows\Temp"
if (Test-Path $winTemp) {
    Get-ChildItem -Path $winTemp -Force | Remove-Item -Recurse -Force
    Write-Host "   [OK] Windows\Temp цэвэрлэгдлээ" -ForegroundColor Green
}

# ============================================================
# 3. Windows Update Cache
# ============================================================
Write-Host "`n3. Windows Update cache..." -ForegroundColor Yellow
$wuCache = "C:\Windows\SoftwareDistribution\Download"
if (Test-Path $wuCache) {
    $wuSize = Get-FolderSize $wuCache
    Write-Host "   Windows Update cache: $wuSize GB" -ForegroundColor Gray
    Stop-Service -Name wuauserv -Force
    Get-ChildItem -Path $wuCache -Force | Remove-Item -Recurse -Force
    Start-Service -Name wuauserv
    Write-Host "   [OK] Windows Update cache цэвэрлэгдлээ" -ForegroundColor Green
}

# ============================================================
# 4. Prefetch
# ============================================================
Write-Host "`n4. Prefetch файлууд..." -ForegroundColor Yellow
$prefetch = "C:\Windows\Prefetch"
if (Test-Path $prefetch) {
    Get-ChildItem -Path $prefetch -Force | Remove-Item -Force
    Write-Host "   [OK] Prefetch цэвэрлэгдлээ" -ForegroundColor Green
}

# ============================================================
# 5. Browser Cache (Chrome)
# ============================================================
Write-Host "`n5. Chrome cache..." -ForegroundColor Yellow
$chromeCache = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache"
if (Test-Path $chromeCache) {
    $chromeSize = Get-FolderSize $chromeCache
    Write-Host "   Chrome cache: $chromeSize GB" -ForegroundColor Gray
    Get-ChildItem -Path $chromeCache -Force | Remove-Item -Recurse -Force
    Write-Host "   [OK] Chrome cache цэвэрлэгдлээ" -ForegroundColor Green
}

# Edge cache
$edgeCache = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache"
if (Test-Path $edgeCache) {
    Get-ChildItem -Path $edgeCache -Force | Remove-Item -Recurse -Force
    Write-Host "   [OK] Edge cache цэвэрлэгдлээ" -ForegroundColor Green
}

# ============================================================
# 6. Recycle Bin
# ============================================================
Write-Host "`n6. Recycle Bin..." -ForegroundColor Yellow
Clear-RecycleBin -Force -DriveLetter C
Write-Host "   [OK] Хогийн сав хоослогдлоо" -ForegroundColor Green

# ============================================================
# 7. Disk Cleanup (системийн)
# ============================================================
Write-Host "`n7. Windows Disk Cleanup ажиллуулж байна..." -ForegroundColor Yellow
Start-Process cleanmgr -ArgumentList "/sagerun:1" -Wait

# ============================================================
# Үр дүн
# ============================================================
$disk2 = Get-PSDrive C
$freeAfter = [math]::Round($disk2.Free / 1GB, 2)
$freed = [math]::Round($freeAfter - $freeBefore, 2)

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  Дууслаа!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Өмнө чөлөөт зай: $freeBefore GB" -ForegroundColor White
Write-Host "Одоо чөлөөт зай: $freeAfter GB" -ForegroundColor White
Write-Host "Чөлөөлсөн зай:   +$freed GB" -ForegroundColor Green
Write-Host ""

# Хэрэв дискний зай бага хэвээрээ байвал том файлуудыг харуулах
if ($freeAfter -lt 10) {
    Write-Host "⚠️  Зай хэвээр дутаж байна. Том файлуудыг хайж байна..." -ForegroundColor Red
    Write-Host "Top 20 том файл (C:\Users доторх):`n" -ForegroundColor Yellow
    Get-ChildItem -Path "C:\Users\$env:USERNAME" -Recurse -Force -File |
        Sort-Object Length -Descending |
        Select-Object -First 20 |
        ForEach-Object {
            $sizeMB = [math]::Round($_.Length / 1MB, 1)
            Write-Host "  $sizeMB MB  $($_.FullName)" -ForegroundColor Gray
        }
}

Write-Host "`nEnter дарж гарах..." -ForegroundColor Cyan
Read-Host
