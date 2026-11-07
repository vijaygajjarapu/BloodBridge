@echo off
title BloodBridge - Restart backend
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0restart-backend.ps1"
