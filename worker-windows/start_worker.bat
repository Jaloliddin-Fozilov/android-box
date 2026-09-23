@echo off
chcp 65001 >nul
title Android Box - LDPlayer Ulovchi Xizmat
powershell -ExecutionPolicy Bypass -File "%~dp0start_worker.ps1"
pause
