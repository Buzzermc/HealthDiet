@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 iniciar.py
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    python iniciar.py
  ) else (
    echo No se encuentra Python 3. Consulta LEEME.txt.
  )
)
pause
