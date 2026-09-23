@echo off
chcp 65001 >nul
title Android Box - LDPlayer 9 Sozlagich
powershell -ExecutionPolicy Bypass -File "%~dp0setup_ldplayer.ps1"
pause
