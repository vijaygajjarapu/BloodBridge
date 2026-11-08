@echo off
title BloodBridge - Fix Referral Links (one time)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-referral-links.ps1"
pause
