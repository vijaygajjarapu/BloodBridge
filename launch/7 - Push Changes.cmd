@echo off
title BloodBridge - Push changes to a branch
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0push-changes.ps1"
