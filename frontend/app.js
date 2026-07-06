const urlInput = document.getElementById("urlInput");
const extractBtn = document.getElementById("extractBtn");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const fileRow = document.getElementById("fileRow");
const fileNameInput = document.getElementById("fileNameInput");
const renameBtn = document.getElementById("renameBtn");
const saveBtn = document.getElementById("saveBtn");

const waveformPlaceholder = document.getElementById("waveformPlaceholder");
const timeLabels = document.getElementById("timeLabels");
const curTimeEl = document.getElementById("curTime");
const totalTimeEl = document.getElementById("totalTime");
const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const saveTrimBtn = document.getElementById("saveTrimBtn");
const toast = document.getElementById("toast");

let currentJobId = null;
let currentFilename = "";
let wavesurfer = null;
let regionsPlugin = null;
let activeRegion = null;
let audioObjectUrl = null;

function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), duration);
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function setProgress(percent, text) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = text;
}

async function handleExtract() {
  const url = urlInput.value.trim();
  if (!url) {
    showToast("주소를 입력해주세요");
    return;
  }
  if (!API_BASE_URL || API_BASE_URL.includes("YOUR-BACKEND-NAME")) {
    showToast("config.js에 백엔드 주소를 설정해주세요");
    return;
  }

  extractBtn.disabled = true;
  fileRow.classList.add("hidden");
  setProgress(0, "변환중.....0%");

  let fakeProgress = 0;
  const progressTimer = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + Math.random() * 12, 90);
    setProgress(fakeProgress, `변환중.....${Math.floor(fakeProgress)}%`);
  }, 500);

  try {
    const res = await fetch(`${API_BASE_URL}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    clearInterval(progressTimer);

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "변환 실패");
    }

    setProgress(100, "추출 성공");
    currentJobId = data.job_id;
    currentFilename = data.filename;
    fileNameInput.value = currentFilename;
    fileRow.classList.remove("hidden");

    await loadWaveform(`${API_BASE_URL}${data.audio_url}`);
    showToast("음원 추출 완료");
  } catch (err) {
    clearInterval(progressTimer);
    setProgress(0, "추출 실패");
    showToast(err.message || "추출 실패");
  } finally {
    extractBtn.disabled = false;
  }
}

async function loadWaveform(audioUrl) {
  waveformPlaceholder.classList.add("hidden");
  timeLabels.classList.remove("hidden");

  if (wavesurfer) {
    wavesurfer.destroy();
    wavesurfer = null;
  }

  regionsPlugin = WaveSurfer.Regions.create();

  wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "#c9c2ac",
    progressColor: "#7a8b6f",
    cursorColor: "#5f6f56",
    height: 90,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    normalize: true,
    plugins: [regionsPlugin],
  });

  await wavesurfer.load(audioUrl);

  const duration = wavesurfer.getDuration();
  totalTimeEl.textContent = formatTime(duration);
  curTimeEl.textContent = "0:00";

  activeRegion = regionsPlugin.addRegion({
    start: 0,
    end: duration,
    color: "rgba(122, 139, 111, 0.2)",
    drag: true,
    resize: true,
  });

  regionsPlugin.on("region-updated", (region) => {
    activeRegion = region;
  });

  wavesurfer.on("audioprocess", () => {
    curTimeEl.textContent = formatTime(wavesurfer.getCurrentTime());
  });

  wavesurfer.on("interaction", () => {
    curTimeEl.textContent = formatTime(wavesurfer.getCurrentTime());
  });

  wavesurfer.on("finish", () => {
    playBtn.textContent = "재생";
  });

  playBtn.disabled = false;
  resetBtn.disabled = false;
  exportBtn.disabled = false;
  saveTrimBtn.disabled = false;
  playBtn.textContent = "재생";
}

function togglePlay() {
  if (!wavesurfer) return;
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
    playBtn.textContent = "재생";
  } else {
    if (activeRegion) {
      wavesurfer.play(activeRegion.start, activeRegion.end);
    } else {
      wavesurfer.play();
    }
    playBtn.textContent = "정지";
  }
}

function resetRegion() {
  if (!wavesurfer || !regionsPlugin) return;
  const duration = wavesurfer.getDuration();
  if (activeRegion) {
    activeRegion.remove();
  }
  activeRegion = regionsPlugin.addRegion({
    start: 0,
    end: duration,
    color: "rgba(122, 139, 111, 0.2)",
    drag: true,
    resize: true,
  });
  showToast("트림 영역을 초기화했습니다");
}

async function trimOnServer() {
  if (!currentJobId || !activeRegion) return null;
  const res = await fetch(`${API_BASE_URL}/api/trim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: currentJobId,
      start: activeRegion.start,
      end: activeRegion.end,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "트리밍 실패");
  }
  return res.blob();
}

async function handleExport() {
  exportBtn.disabled = true;
  try {
    const blob = await trimOnServer();
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileNameInput.value || "trimmed_audio.mp3";
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("파일을 내보냈습니다");
  } catch (err) {
    showToast(err.message || "내보내기 실패");
  } finally {
    exportBtn.disabled = false;
  }
}

async function handleSaveTrim() {
  saveTrimBtn.disabled = true;
  try {
    const blob = await trimOnServer();
    if (!blob) return;

    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
    }
    audioObjectUrl = URL.createObjectURL(blob);
    await loadWaveform(audioObjectUrl);
    showToast("편집 내용을 저장하고 편집기에 반영했습니다");
  } catch (err) {
    showToast(err.message || "저장 실패");
  } finally {
    saveTrimBtn.disabled = false;
  }
}

function handleRename() {
  const newName = prompt("새 파일명을 입력하세요", fileNameInput.value);
  if (newName && newName.trim()) {
    let finalName = newName.trim();
    if (!finalName.toLowerCase().endsWith(".mp3")) {
      finalName += ".mp3";
    }
    fileNameInput.value = finalName;
    showToast("이름이 변경되었습니다");
  }
}

async function handleSave() {
  if (!currentJobId) return;
  try {
    const url = audioObjectUrl || `${API_BASE_URL}/api/audio/${currentJobId}`;
    const blob = audioObjectUrl
      ? await (await fetch(audioObjectUrl)).blob()
      : await (await fetch(url)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileNameInput.value || currentFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("저장되었습니다");
  } catch (err) {
    showToast("저장 실패");
  }
}

extractBtn.addEventListener("click", handleExtract);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleExtract();
});
renameBtn.addEventListener("click", handleRename);
saveBtn.addEventListener("click", handleSave);
playBtn.addEventListener("click", togglePlay);
resetBtn.addEventListener("click", resetRegion);
exportBtn.addEventListener("click", handleExport);
saveTrimBtn.addEventListener("click", handleSaveTrim);
