@echo off
title BloodBridge - Delete Test Users
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0delete-users.ps1"
pause
