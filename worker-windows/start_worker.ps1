# ==============================================================================
# Android Box - Windows LDPlayer -> Mac Master Server Ulovchi Skript
# ==============================================================================
param (
    [string]$MasterUrl = "https://democrats-deliver-value-richardson.trycloudflare.com"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Android Box - LDPlayer Ulovchi Xizmat (Windows)     " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# LDPlayer 9 yo'lini aniqlash
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
    Write-Host "[XATO] LDPlayer 9 topilmadi. Avval setup_ldplayer.bat ni ishga tushiring." -ForegroundColor Red
    pause
    exit 1
}

$LdConsole = "$LdDir\ldconsole.exe"
$AdbExe = "$LdDir\adb.exe"

Write-Host "Faol LDPlayer instansiyalari qidirilmoqda..." -ForegroundColor Yellow
$InstancesRaw = & $LdConsole list2

$ActivePorts = @()
if ($InstancesRaw) {
    foreach ($line in $InstancesRaw) {
        $parts = $line -split ','
        # parts: index, title, top_w, bind_w, android_started, pid, adb_port
        if ($parts.Count -ge 7) {
            $isStarted = $parts[4]
            $port = $parts[6]
            $name = $parts[1]
            if ($isStarted -eq "1" -and $port -and $port -ne "-1") {
                Write-Host "  [+] Faol oyna: $name (ADB Port: $port)" -ForegroundColor Green
                $ActivePorts += $port
            }
        }
    }
}

if ($ActivePorts.Count -eq 0) {
    Write-Host "[OGOHLANTIRISH] Hozircha birorta ham oyna ishga tushmagan!" -ForegroundColor Yellow
    Write-Host "Avval 'setup_ldplayer.bat' ni ishga tushirib oynalarni oching yoki LDMultiPlayer orqali oynalarni yoqing." -ForegroundColor Yellow
    Write-Host ""
    $Ans = Read-Host "Hozir avtomatik 4 ta oynani ochishni xohlaysizmi? (h/y)"
    if ($Ans -eq "h" -or $Ans -eq "y" -or $Ans -eq "") {
        & "$PSScriptRoot\setup_ldplayer.ps1"
        Write-Host "Oynalar yuklanishini 15 soniya kutamiz..." -ForegroundColor Gray
        Start-Sleep -Seconds 15
        # Qayta o'qish
        $InstancesRaw = & $LdConsole list2
        foreach ($line in $InstancesRaw) {
            $parts = $line -split ','
            if ($parts.Count -ge 7 -and $parts[4] -eq "1") {
                $ActivePorts += $parts[6]
            }
        }
    } else {
        exit 0
    }
}

Write-Host "`nJami faol ADB portlar: $($ActivePorts.Count) ta ($($ActivePorts -join ', '))" -ForegroundColor Green

# Master Server URL
Write-Host ""
Write-Host "Master Server manzili: $MasterUrl" -ForegroundColor Cyan
$UserMaster = Read-Host "Boshqa Master Server manzili kiritasizmi? (Enter = standart)"
if ($UserMaster -and $UserMaster.Trim() -ne "") {
    $MasterUrl = $UserMaster.Trim()
}

$TmpDir = "$env:TEMP\ldplayer_tunnels"
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

Function Start-TunnelsAndReport {
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Yangi tunnellarni ochish boshlandi..." -ForegroundColor Yellow
    Get-Process -Name "ssh" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Remove-Item -Path "$TmpDir\*.log" -Force -ErrorAction SilentlyContinue

    $Urls = @()
    $Index = 1

    foreach ($port in $ActivePorts) {
        $LogFile = "$TmpDir\tunnel_$Index.log"
        Write-Host -NoNewline "[$Index/$($ActivePorts.Count)] Box #$Index (Port $port) ulanmoqda..." -ForegroundColor Gray

        $sshArgs = "-o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -p 443 -R0:localhost:$port tcp@a.pinggy.io"
        Start-Process -FilePath "ssh.exe" -ArgumentList $sshArgs -RedirectStandardOutput $LogFile -RedirectStandardError "$TmpDir\tunnel_err_$Index.log" -WindowStyle Hidden

        $Url = $null
        for ($att = 1; $att -le 25; $att++) {
            Start-Sleep -Milliseconds 400
            if (Test-Path $LogFile) {
                $Content = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
                if ($Content -match 'tcp://[a-zA-Z0-9.-]*:[0-9]*') {
                    $Url = $matches[0]
                    break
                }
            }
        }

        if ($Url) {
            Write-Host " -> TAYYOR! ($Url)" -ForegroundColor Green
            $Urls += $Url
        } else {
            Write-Host " -> Kutilmoqda..." -ForegroundColor DarkYellow
        }
        $Index++
    }

    if ($Urls.Count -eq 0) {
        Write-Host "[!] Tunnellar ochilmadi. Internet ulanishini tekshiring." -ForegroundColor Red
        return $false
    }

    # JSON shakllantirish
    $JsonEndpoints = "[" + (($Urls | ForEach-Object { "`"$_`"" }) -join ",") + "]"
    $Payload = "{`"workerId`": `"pc_1`", `"endpoints`": $JsonEndpoints}"

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Mac Master Serverga hisobot berilmoqda..." -ForegroundColor Yellow
    try {
        $Response = Invoke-RestMethod -Uri "$MasterUrl/api/workers/report-tunnels" -Method Post -Body $Payload -ContentType "application/json" -TimeoutSec 7
        Write-Host "-> MUVAFFAQIYATLI ULINDI! 🎉 Barcha $($Urls.Count) ta Box Master Dashboard'da ONLINE bo'ldi!" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "-> Master Serverga to'g'ridan-to'g'ri xabar berib bo'lmadi ($($_.Exception.Message))" -ForegroundColor Red
        Write-Host "Manzillar:" -ForegroundColor Yellow
        $Urls | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
        return $false
    }
}

# 24/7 Avtomatik yangilash va monitoring sikli
Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "   24/7 Uzluksiz Aloqa Xizmati Ishga Tushdi           " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

while ($true) {
    Start-TunnelsAndReport | Out-Null
    
    $StartTime = Get-Date
    $MaxSessionSec = 3000 # 50 daqiqa (Pinggy 60 min limitidan oldin)

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 50 daqiqalik barqaror seans boshlandi. Tunnellar kuzatilmoqda..." -ForegroundColor Gray

    while ($true) {
        Start-Sleep -Seconds 15
        $Elapsed = (Get-Date) - $StartTime

        if ($Elapsed.TotalSeconds -ge $MaxSessionSec) {
            Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Pinggy 50 daqiqalik muddati yetdi. Yangi seans ochilmoqda..." -ForegroundColor Yellow
            break
        }

        # Jarayonlar tirikligini tekshirish
        $RunningSsh = (Get-Process -Name "ssh" -ErrorAction SilentlyContinue | Measure-Object).Count
        if ($RunningSsh -lt $ActivePorts.Count) {
            Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Ayrim ulanishlar uzildi (faol: $RunningSsh / $($ActivePorts.Count)). Qayta ulanmoqda..." -ForegroundColor Yellow
            break
        }
    }
}
