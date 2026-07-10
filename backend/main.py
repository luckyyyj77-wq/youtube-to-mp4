import os
import re
import uuid
import shutil
import subprocess
from pathlib import Path
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

APP_DIR = Path(__file__).parent
JOBS_DIR = APP_DIR / "jobs"
JOBS_DIR.mkdir(exist_ok=True)

app = FastAPI(title="YouTube Audio Extractor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

YOUTUBE_URL_RE = re.compile(
    r"^(https?://)?(www\.|m\.|music\.)?"
    r"(youtube\.com/(watch\?.*[?&]?v=[\w\-]+|shorts/[\w\-]+|live/[\w\-]+)|youtu\.be/[\w\-]+)"
)


class ExtractRequest(BaseModel):
    url: str


class TrimRequest(BaseModel):
    job_id: str
    start: float
    end: float


def job_path(job_id: str) -> Path:
    safe_id = re.sub(r"[^a-zA-Z0-9\-]", "", job_id)
    if not safe_id:
        raise HTTPException(400, "invalid job id")
    return JOBS_DIR / safe_id


def cleanup_old_jobs(max_age_hours: int = 3):
    cutoff = datetime.now() - timedelta(hours=max_age_hours)
    if not JOBS_DIR.exists():
        return
    for d in JOBS_DIR.iterdir():
        try:
            if d.is_dir() and datetime.fromtimestamp(d.stat().st_mtime) < cutoff:
                shutil.rmtree(d, ignore_errors=True)
        except OSError:
            pass


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/extract")
def extract_audio(req: ExtractRequest):
    cleanup_old_jobs()

    url = req.url.strip()
    if not YOUTUBE_URL_RE.match(url):
        raise HTTPException(400, "올바른 유튜브 주소가 아닙니다.")

    job_id = uuid.uuid4().hex[:12]
    out_dir = job_path(job_id)
    out_dir.mkdir(parents=True, exist_ok=True)

    output_template = str(out_dir / "source.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "audio")
            duration = info.get("duration", 0)
    except Exception as e:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise HTTPException(400, f"오디오 추출 실패: {str(e)}")

    mp3_path = out_dir / "source.mp3"
    if not mp3_path.exists():
        shutil.rmtree(out_dir, ignore_errors=True)
        raise HTTPException(500, "변환된 파일을 찾을 수 없습니다.")

    date_str = datetime.now().strftime("%y%m%d")
    filename = f"{date_str}_mp4음원변환.mp3"

    return {
        "job_id": job_id,
        "filename": filename,
        "title": title,
        "duration": duration,
        "audio_url": f"/api/audio/{job_id}",
    }


@app.get("/api/audio/{job_id}")
def get_audio(job_id: str):
    out_dir = job_path(job_id)
    mp3_path = out_dir / "source.mp3"
    if not mp3_path.exists():
        raise HTTPException(404, "파일을 찾을 수 없습니다.")
    return FileResponse(mp3_path, media_type="audio/mpeg", filename="audio.mp3")


@app.post("/api/trim")
def trim_audio(req: TrimRequest):
    out_dir = job_path(req.job_id)
    src_path = out_dir / "source.mp3"
    if not src_path.exists():
        raise HTTPException(404, "원본 파일을 찾을 수 없습니다.")

    if req.end <= req.start:
        raise HTTPException(400, "종료 지점이 시작 지점보다 커야 합니다.")

    trimmed_path = out_dir / f"trimmed_{uuid.uuid4().hex[:8]}.mp3"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(src_path),
        "-ss", str(req.start),
        "-to", str(req.end),
        "-acodec", "libmp3lame",
        "-q:a", "2",
        str(trimmed_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not trimmed_path.exists():
        raise HTTPException(500, f"트리밍 실패: {result.stderr[-500:]}")

    return FileResponse(
        trimmed_path,
        media_type="audio/mpeg",
        filename="trimmed_audio.mp3",
    )
