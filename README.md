# 유튜브 mp4변환/편집기

유튜브 링크에서 오디오를 추출하고, 바로 파형에서 구간을 잘라 편집·저장할 수 있는 개인용 웹앱입니다.

- **프론트엔드**: 정적 HTML/CSS/JS + [WaveSurfer.js](https://wavesurfer.xyz/) — GitHub Pages로 배포
- **백엔드**: FastAPI + yt-dlp + ffmpeg — Render.com 무료 플랜으로 배포

## 배포 링크

- 웹앱: https://luckyyyj77-wq.github.io/youtube-to-mp4/

## 구조

```
frontend/   GitHub Pages로 배포되는 정적 웹앱
backend/    Render.com에 Docker로 배포되는 API 서버
```

## 백엔드 배포 방법 (Render.com)

1. [render.com](https://render.com) 가입 후 New > Web Service
2. 이 저장소 연결, Root Directory를 `backend`로 지정
3. Environment: Docker 선택 (Dockerfile 자동 인식)
4. Instance Type: Free 선택 후 배포
5. 배포 완료 후 발급된 URL(예: `https://xxxx.onrender.com`)을
   `frontend/config.js`의 `API_BASE_URL`에 붙여넣고 커밋/푸시

무료 플랜은 일정 시간 미사용 시 슬립 상태가 되며, 첫 요청 시 콜드스타트로
30~60초 정도 걸릴 수 있습니다. 개인용으로는 충분합니다.

## 로컬 실행

### 백엔드
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
(ffmpeg가 로컬에 설치되어 있어야 합니다)

### 프론트엔드
```bash
cd frontend
python -m http.server 8080
```
`config.js`의 `API_BASE_URL`을 로컬 백엔드 주소(`http://localhost:8000`)로 바꿔서 테스트하세요.

## 주의사항

개인 용도로만 사용하세요. 유튜브 이용약관 및 저작권법을 준수하는 범위 내에서 사용해야 합니다.
