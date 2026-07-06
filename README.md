# 유튜브 mp4변환/편집기

유튜브 링크에서 오디오를 추출하고, 바로 파형에서 구간을 잘라 편집·저장할 수 있는 개인용 웹앱입니다.

- **프론트엔드**: 정적 HTML/CSS/JS + [WaveSurfer.js](https://wavesurfer.xyz/) — GitHub Pages로 배포
- **백엔드**: FastAPI + yt-dlp + ffmpeg — **본인 PC에서 로컬로 실행**

## 배포 링크

- 웹앱: https://luckyyyj77-wq.github.io/youtube-to-mp4/

> 클라우드(Render 등) 서버 IP는 유튜브가 봇으로 차단("Sign in to confirm you're not a bot")하는 경우가
> 많아, 백엔드는 개인 PC에서 직접 실행하는 방식으로 운영합니다. 웹앱 페이지는 그대로 GitHub Pages에
> 접속하고, 오디오 추출/편집 요청만 로컬 PC의 백엔드(`http://localhost:8000`)로 보냅니다.
> **웹앱을 쓰려면 먼저 아래 방법으로 로컬 백엔드를 켜두어야 합니다.**

## 구조

```
frontend/   GitHub Pages로 배포되는 정적 웹앱
backend/    본인 PC에서 실행하는 API 서버 (FastAPI + yt-dlp + ffmpeg)
```

## 사용 방법 (매번 사용할 때)

### 1. 로컬 백엔드 켜기

최초 1회만 준비:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
(ffmpeg가 PC에 설치되어 있어야 합니다: https://ffmpeg.org/download.html)

이후 사용할 때마다:
```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000
```
`http://localhost:8000/api/health` 접속 시 `{"status":"ok"}`가 뜨면 준비 완료.

### 2. 웹앱 접속

브라우저에서 https://luckyyyj77-wq.github.io/youtube-to-mp4/ 접속 (백엔드가 켜져 있는 동안만 동작).

## 로컬에서 프론트엔드까지 함께 테스트하고 싶을 때

```bash
cd frontend
python -m http.server 8080
```
`http://localhost:8080` 접속. `config.js`는 이미 `http://localhost:8000`을 가리키도록 설정되어 있습니다.

## yt-dlp 관련 참고

유튜브 쪽 정책/포맷 변경이 잦아 `yt-dlp`가 오래되면 추출이 실패할 수 있습니다.
문제가 생기면 아래처럼 최신 버전으로 업그레이드하세요.
```bash
cd backend
.venv\Scripts\activate
pip install -U yt-dlp
```

## 주의사항

개인 용도로만 사용하세요. 유튜브 이용약관 및 저작권법을 준수하는 범위 내에서 사용해야 합니다.
