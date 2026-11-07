@echo off
title BloodBridge - Delete Test Requests
cd /d "%~dp0..\backend"
npx tsx scripts/delete-test-requests.ts > "%~dp0delete-test-requests.log" 2>&1
type "%~dp0delete-test-requests.log"
pause
