# 유튜브 mp4변환/편집기

유튜브 링크에서 오디오를 추출하고, 바로 파형에서 구간을 잘라 편집·저장할 수 있는 개인용 웹앱입니다.
모바일(아이폰/안드로이드)과 PC 모두 지원합니다.

- **프론트엔드**: 정적 HTML/CSS/JS + [WaveSurfer.js](https://wavesurfer.xyz/) — GitHub Pages로 배포
- **백엔드**: FastAPI + yt-dlp + ffmpeg — **본인 PC에서 로컬로 실행**, Cloudflare Tunnel로 외부 노출

## 배포 링크

- 웹앱: https://luckyyyj77-wq.github.io/youtube-to-mp4/

> 클라우드(Render 등) 서버 IP는 유튜브가 봇으로 차단("Sign in to confirm you're not a bot")하는 경우가
> 많아, 백엔드는 개인 PC에서 직접 실행합니다. 모바일에서도 쓸 수 있도록 Cloudflare Tunnel로 PC의
> 백엔드를 임시 HTTPS 주소로 외부에 노출합니다. **웹앱을 쓰려면 먼저 아래 방법으로 PC에서
> 백엔드 + 터널을 켜두어야 합니다.**

## 구조

```
frontend/   GitHub Pages로 배포되는 정적 웹앱
backend/    본인 PC에서 실행하는 API 서버 (FastAPI + yt-dlp + ffmpeg)
run.bat     백엔드 + Cloudflare Tunnel을 한 번에 실행하는 스크립트
run.ps1     run.bat이 내부적으로 호출하는 PowerShell 스크립트
```

## 사용 방법 (매번 사용할 때)

### 1. 최초 1회만: 준비

- ffmpeg 설치: https://ffmpeg.org/download.html
- cloudflared 설치 (PowerShell):
  ```powershell
  winget install --id Cloudflare.cloudflared
  ```
- 백엔드 파이썬 패키지는 `run.bat`을 처음 실행할 때 자동으로 설치됩니다.

### 2. `run.bat` 더블클릭

`D:\youtube_to_mp4\run.bat`을 더블클릭하면 자동으로:
1. 백엔드(uvicorn)를 새 창에서 실행
2. 백엔드가 준비될 때까지 대기
3. Cloudflare Tunnel을 실행해 외부에서 접속 가능한 주소 발급
4. 발급된 주소를 화면에 크게 표시하고 `frontend/config.js`에 자동 반영

터널 주소는 실행할 때마다 바뀝니다. **주소가 이전과 달라졌다면** 화면에 안내되는 대로
아래 명령을 실행해 GitHub에 반영해야 웹앱이 새 주소를 사용합니다:
```bash
git add frontend/config.js
git commit -m "update backend tunnel url"
git push
```
(GitHub Pages가 몇 십 초 내로 자동 재배포됩니다.)

### 3. 웹앱 접속

브라우저(모바일/PC 어디서든)에서 https://luckyyyj77-wq.github.io/youtube-to-mp4/ 접속.
`run.bat` 창(백엔드 창 + 터널 창)을 닫으면 서비스가 중단되니, 사용하는 동안 그대로 두세요.

## 로컬에서 프론트엔드까지 함께 테스트하고 싶을 때

```bash
cd frontend
python -m http.server 8080
```
`http://localhost:8080` 접속.

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
