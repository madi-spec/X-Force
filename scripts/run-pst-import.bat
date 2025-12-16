@echo off
REM ============================================
REM PST Import Script Launcher
REM For use with Windows Task Scheduler
REM ============================================
REM
REM To set up in Task Scheduler:
REM 1. Open Task Scheduler (taskschd.msc)
REM 2. Create Task (not Basic Task)
REM 3. General: Name "X-FORCE PST Import", Run whether user is logged on or not
REM 4. Triggers: Daily at preferred time (e.g., 6:00 AM)
REM 5. Actions: Start a program
REM    - Program: C:\Users\tmort\x-force\scripts\run-pst-import.bat
REM    - Start in: C:\Users\tmort\x-force
REM 6. Conditions: Uncheck "Start only if on AC power" if needed
REM 7. Settings: Allow task to run on demand
REM

cd /d C:\Users\tmort\x-force

echo ============================================
echo PST Import Starting: %date% %time%
echo ============================================

node scripts/import-pst.mjs

echo ============================================
echo PST Import Finished: %date% %time%
echo ============================================
