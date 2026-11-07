@echo off
title BloodBridge - Check code
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0check-code.ps1"
