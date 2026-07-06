@echo off
cd /d "%~dp0"
if not exist .venv (
    echo [setup] creating virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)
echo [run] starting backend at http://localhost:8000
uvicorn main:app --host 0.0.0.0 --port 8000
