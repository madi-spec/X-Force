@echo off
REM X-FORCE PST Import Script
REM Run this script daily via Windows Task Scheduler
REM
REM Task Scheduler Setup:
REM 1. Open Task Scheduler
REM 2. Create Basic Task: "X-FORCE PST Import"
REM 3. Trigger: Daily at preferred time (e.g., 6:00 AM)
REM 4. Action: Start a program
REM    - Program: C:\Users\tmort\x-force\scripts\run-pst-import.bat
REM    - Start in: C:\Users\tmort\x-force
REM 5. Check "Run whether user is logged on or not"

echo ================================================
echo X-FORCE PST Import
echo Started: %date% %time%
echo ================================================
echo.

cd /d C:\Users\tmort\x-force

REM Run the import script
node scripts\import-pst.mjs

echo.
echo ================================================
echo Completed: %date% %time%
echo ================================================

REM Uncomment the line below to keep the window open (useful for debugging)
REM pause
