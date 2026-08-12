# Disk Space Analyzer — C Drive
# Right-click → Run with PowerShell

$ErrorActionPreference = "SilentlyContinue"

function Format-Size($bytes) {
    if ($bytes -gt 1GB) { return "$([math]::Round($bytes/1GB,1)) GB" }
    elseif ($bytes -gt 1MB) { return "$([math]::Round($bytes/1MB,0)) MB" }
    else { return "$([math]::Round($bytes/1KB,0)) KB" }
}

function Get-DirSize($path) {
    if (-not (Test-Path $path)) { return 0 }
    try {
        return (Get-ChildItem -Path $path -Recurse -Force -File -ErrorAction SilentlyContinue |
            Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
    } catch { return 0 }
}

Clear-Host
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   C Drive Space Analyzer" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# Нийт диск
$disk = Get-PSDrive C
$total = $disk.Used + $disk.Free
Write-Host "Нийт:     $(Format-Size $total)" -ForegroundColor White
Write-Host "Ашигласан: $(Format-Size $disk.Used)" -ForegroundColor Red
Write-Host "Чөлөөт:   $(Format-Size $disk.Free)" -ForegroundColor Green
Write-Host ""

# Мэдэгдэж байгаа том газрууд
Write-Host "--- Хамгийн том газрууд ---`n" -ForegroundColor Yellow

$checks = @(
    @{ Name = "Windows (System32 + WinSxS)";   Path = "C:\Windows" },
    @{ Name = "Program Files";                  Path = "C:\Program Files" },
    @{ Name = "Program Files (x86)";            Path = "C:\Program Files (x86)" },
    @{ Name = "Users хавтас нийт";              Path = "C:\Users" },
    @{ Name = "  └ Таны Downloads";             Path = "C:\Users\$env:USERNAME\Downloads" },
    @{ Name = "  └ Таны Documents";             Path = "C:\Users\$env:USERNAME\Documents" },
    @{ Name = "  └ Таны Desktop";               Path = "C:\Users\$env:USERNAME\Desktop" },
    @{ Name = "  └ Таны Videos";                Path = "C:\Users\$env:USERNAME\Videos" },
    @{ Name = "  └ Таны Pictures";              Path = "C:\Users\$env:USERNAME\Pictures" },
    @{ Name = "  └ AppData\Roaming";            Path = "C:\Users\$env:USERNAME\AppData\Roaming" },
    @{ Name = "  └ AppData\Local";              Path = "C:\Users\$env:USERNAME\AppData\Local" },
    @{ Name = "  └ AppData\LocalLow";           Path = "C:\Users\$env:USERNAME\AppData\LocalLow" },
    @{ Name = "Claude Sessions (temp)";         Path = "$env:APPDATA\Claude\local-agent-mode-sessions" },
    @{ Name = "iTunes Backup (Apple)";          Path = "C:\Users\$env:USERNAME\AppData\Roaming\Apple Computer\MobileSync\Backup" },
    @{ Name = "iTunes Backup (alt)";            Path = "C:\Users\$env:USERNAME\AppData\Local\Apple Computer\MobileSync\Backup" },
    @{ Name = "iCloud Drive";                   Path = "C:\Users\$env:USERNAME\iCloudDrive" },
    @{ Name = "OneDrive";                       Path = "C:\Users\$env:USERNAME\OneDrive" },
    @{ Name = "Windows Temp";                   Path = "C:\Windows\Temp" },
    @{ Name = "User Temp";                      Path = $env:TEMP },
    @{ Name = "Windows Update Cache";           Path = "C:\Windows\SoftwareDistribution\Download" },
    @{ Name = "Pagefile (virtual memory)";      Path = "C:\pagefile.sys" },
    @{ Name = "Hibernation file";               Path = "C:\hiberfil.sys" },
    @{ Name = "Docker data";                    Path = "C:\ProgramData\Docker" },
    @{ Name = "Docker Desktop WSL";             Path = "C:\Users\$env:USERNAME\AppData\Local\Docker" },
    @{ Name = "WSL (Windows Subsystem Linux)";  Path = "C:\Users\$env:USERNAME\AppData\Local\Packages" },
    @{ Name = "node_modules нийт";              Path = "C:\Users\$env:USERNAME" },
    @{ Name = "Recycle Bin";                    Path = "C:\`$Recycle.Bin" }
)

foreach ($item in $checks) {
    $size = Get-DirSize $item.Path
    if ($size -gt 100MB -or $item.Name -match "Pagefile|Hibernation") {
        # Pagefile нь file, folder биш
        if ($item.Name -match "Pagefile|Hibernation") {
            $f = Get-Item -Path $item.Path -Force
            if ($f) { $size = $f.Length }
        }
        $bar = ""
        $gb = $size / 1GB
        for ($i = 0; $i -lt [math]::Min([math]::Round($gb), 30); $i++) { $bar += "█" }

        $color = if ($gb -gt 20) { "Red" } elseif ($gb -gt 5) { "Yellow" } else { "White" }
        Write-Host ("{0,-40} {1,8}  {2}" -f $item.Name, (Format-Size $size), $bar) -ForegroundColor $color
    }
}

# node_modules тусад нь хайх
Write-Host "`n--- node_modules олох (хөгжүүлэгчийн том файлууд) ---`n" -ForegroundColor Yellow
$nodeModules = Get-ChildItem -Path "C:\Users\$env:USERNAME" -Recurse -Directory -Filter "node_modules" -Force -Depth 5 -ErrorAction SilentlyContinue
$totalNode = 0
foreach ($nm in $nodeModules) {
    $s = Get-DirSize $nm.FullName
    $totalNode += $s
    if ($s -gt 50MB) {
        Write-Host ("  {0,-55} {1}" -f $nm.FullName.Substring([math]::Min(30,$nm.FullName.Length-1)), (Format-Size $s)) -ForegroundColor Gray
    }
}
Write-Host "  НИЙТ node_modules: $(Format-Size $totalNode)" -ForegroundColor Red

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Enter дарж гарах..."
Read-Host
