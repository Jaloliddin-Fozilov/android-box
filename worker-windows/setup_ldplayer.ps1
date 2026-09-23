# ==============================================================================
# Android Box - LDPlayer 9 Avtomatik Sozlash va Ishga Tushirish (PowerShell)
# ==============================================================================
param (
    [int]$Count = 4,
    [int]$Cpu = 1,
    [int]$Memory = 1536,
    [int]$Width = 540,
    [int]$Height = 960,
    [int]$Dpi = 160,
    [int]$Fps = 20
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Android Box - LDPlayer 9 Multi-Instance Sozlagich  " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# LDPlayer 9 yo'lini qidirish
$LdPaths = @(
    "C:\LDPlayer\LDPlayer9",
    "D:\LDPlayer\LDPlayer9",
    "E:\LDPlayer\LDPlayer9",
    "C:\Program Files\LDPlayer\LDPlayer9",
    "D:\Program Files\LDPlayer\LDPlayer9"
)

$LdDir = $null
foreach ($path in $LdPaths) {
    if (Test-Path "$path\ldconsole.exe") {
        $LdDir = $path
        break
    }
}

if (-not $LdDir) {
    Write-Host "[XATO] LDPlayer 9 o'rnatilgan papka topilmadi!" -ForegroundColor Red
    Write-Host "Agar LDPlayer o'rnatilmagan bo'lsa, rasmiy saytdan yuklab oling:" -ForegroundColor Yellow
    Write-Host "https://www.ldplayer.net/" -ForegroundColor Green
    Write-Host ""
    $CustomPath = Read-Host "Iltimos, LDPlayer 9 papkasi yo'lini kiriting (masalan C:\LDPlayer\LDPlayer9)"
    if (Test-Path "$CustomPath\ldconsole.exe") {
        $LdDir = $CustomPath
    } else {
        Write-Host "ldconsole.exe topilmadi. To'xtatildi." -ForegroundColor Red
        exit 1
    }
}

Write-Host "LDPlayer 9 topildi: $LdDir" -ForegroundColor Green
$LdConsole = "$LdDir\ldconsole.exe"

Write-Host "`n[1/3] Hozirgi instansiyalar tekshirilmoqda..." -ForegroundColor Yellow
$ExistingList = & $LdConsole list2

# Mavjud instansiyalar soni
$ExistingCount = 0
if ($ExistingList) {
    $ExistingCount = ($ExistingList | Measure-Object).Count
}
Write-Host "Mavjud instansiyalar: $ExistingCount ta" -ForegroundColor Gray

# Kerakli miqdordagi instansiyalarni yaratish
Write-Host "`n[2/3] $Count ta yengil (Eco) instansiya yaratilmoqda va sozlanmoqda..." -ForegroundColor Yellow
for ($i = 0; $i -lt $Count; $i++) {
    $Name = "AndroidBox_$($i + 1)"
    
    # Mavjudligini tekshirish
    $Found = $false
    if ($ExistingList) {
        foreach ($line in $ExistingList) {
            $parts = $line -split ','
            if ($parts.Count -ge 2 -and ($parts[1] -eq $Name -or $parts[0] -eq "$i")) {
                $Found = $true
                break
            }
        }
    }

    if (-not $Found) {
        Write-Host "-> [$($i + 1)/$Count] Yangi oyna yaratilmoqda: $Name..." -ForegroundColor Cyan
        & $LdConsole add --name "$Name"
        Start-Sleep -Seconds 1
    }

    Write-Host "-> [$($i + 1)/$Count] Optimizatsiya sozlamalari qo'llanmoqda: $Name ($Width x $Height, $Fps FPS, ${Cpu} CPU, ${Memory}MB RAM)..." -ForegroundColor Gray
    # Eco rejim sozlamalari
    & $LdConsole modify --name "$Name" --resolution "$Width,$Height,$Dpi" --cpu $Cpu --memory $Memory
}

Write-Host "`n[3/3] Barcha $Count ta Android Box ishga tushirilmoqda..." -ForegroundColor Yellow
for ($i = 0; $i -lt $Count; $i++) {
    $Name = "AndroidBox_$($i + 1)"
    Write-Host "-> $Name yuklanmoqda..." -ForegroundColor Cyan
    & $LdConsole launch --name "$Name"
    Start-Sleep -Seconds 3
}

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "  TABRIKLAYMIZ! Barcha $Count ta LDPlayer ishga tushdi!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host "Endi Mac Master Serverga ulash uchun quyidagi skriptni bering:" -ForegroundColor Yellow
Write-Host ".\start_worker.bat" -ForegroundColor Cyan
