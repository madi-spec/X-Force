@echo off
REM ============================================
REM X-FORCE PST Import - Daily Scheduled Task
REM Runs at 5:00 AM EST via Windows Task Scheduler
REM ============================================

cd /d "C:\Users\tmort\x-force"

REM Log start time
echo [%date% %time%] Starting PST Import >> logs\pst-import.log

REM Run the import script
node scripts\import-pst.mjs >> logs\pst-import.log 2>&1

REM Log completion
echo [%date% %time%] PST Import completed >> logs\pst-import.log
echo. >> logs\pst-import.log
