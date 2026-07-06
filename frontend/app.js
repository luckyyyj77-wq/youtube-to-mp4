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
const seekBarWrap = document.getElementById("seekBarWrap");
const seekBar = document.getElementById("seekBar");
const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const saveTrimBtn = document.getElementById("saveTrimBtn");
const toast = document.getElementById("toast");

const SEEK_BAR_MAX = 1000;
let isSeekDragging = false;

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

  let data = null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    clearInterval(progressTimer);

    data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "변환 실패");
    }

    setProgress(100, "추출 성공");
    currentJobId = data.job_id;
    currentFilename = data.filename;
    fileNameInput.value = currentFilename;
    fileRow.classList.remove("hidden");
  } catch (err) {
    clearInterval(progressTimer);
    setProgress(0, "추출 실패");
    showToast(err.message || "추출 실패");
    extractBtn.disabled = false;
    return;
  }
  extractBtn.disabled = false;

  try {
    await loadWaveform(`${API_BASE_URL}${data.audio_url}`);
    showToast("음원 추출 완료");
  } catch (err) {
    showToast("추출은 성공했지만 편집기 로딩에 실패했습니다. 저장/공유는 가능합니다.");
  }
}

function updatePlayIcon(playing) {
  playBtn.textContent = playing ? "⏸" : "▶";
}

function updateTimeDisplay(t) {
  curTimeEl.textContent = formatTime(t);
  if (!isSeekDragging) {
    const duration = wavesurfer.getDuration() || 1;
    seekBar.value = Math.round((t / duration) * SEEK_BAR_MAX);
  }
}

async function loadWaveform(audioUrl) {
  waveformPlaceholder.classList.add("hidden");
  timeLabels.classList.remove("hidden");
  seekBarWrap.classList.remove("hidden");

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
  seekBar.value = 0;

  activeRegion = regionsPlugin.addRegion({
    start: 0,
    end: duration,
    color: "rgba(122, 139, 111, 0.2)",
    drag: true,
    resize: true,
  });

  regionsPlugin.on("region-updated", (region) => {
    activeRegion = region;
    // 트림 영역을 조절했을 때 재생/커서 위치가 새 영역을 자연스럽게 따라가도록 함
    const current = wavesurfer.getCurrentTime();
    const outOfRange = current < region.start || current > region.end;
    const wasPlaying = wavesurfer.isPlaying();

    if (outOfRange) {
      wavesurfer.setTime(region.start);
      updateTimeDisplay(region.start);
      if (wasPlaying) {
        wavesurfer.play(region.start, region.end);
      }
    } else if (wasPlaying) {
      // 재생 중 영역 끝(stopAtPosition)이 바뀐 경우를 반영하기 위해 같은 위치에서 재생을 갱신
      wavesurfer.play(current, region.end);
    }
  });

  wavesurfer.on("audioprocess", (t) => {
    updateTimeDisplay(t);
  });

  wavesurfer.on("interaction", () => {
    updateTimeDisplay(wavesurfer.getCurrentTime());
  });

  wavesurfer.on("play", () => updatePlayIcon(true));
  wavesurfer.on("pause", () => updatePlayIcon(false));
  wavesurfer.on("finish", () => updatePlayIcon(false));

  playBtn.disabled = false;
  resetBtn.disabled = false;
  saveTrimBtn.disabled = false;
  exportBtn.disabled = true;
  updatePlayIcon(false);
}

function togglePlay() {
  if (!wavesurfer) return;
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
  } else {
    const current = wavesurfer.getCurrentTime();
    if (activeRegion) {
      const startFrom = current >= activeRegion.start && current < activeRegion.end
        ? current
        : activeRegion.start;
      wavesurfer.play(startFrom, activeRegion.end);
    } else {
      wavesurfer.play();
    }
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

function handleSeekInput() {
  if (!wavesurfer) return;
  isSeekDragging = true;
  const duration = wavesurfer.getDuration() || 0;
  const t = (seekBar.value / SEEK_BAR_MAX) * duration;
  curTimeEl.textContent = formatTime(t);
}

function handleSeekCommit() {
  if (!wavesurfer) return;
  const duration = wavesurfer.getDuration() || 0;
  let t = (seekBar.value / SEEK_BAR_MAX) * duration;
  if (activeRegion) {
    t = Math.min(Math.max(t, activeRegion.start), activeRegion.end);
  }
  wavesurfer.setTime(t);
  updateTimeDisplay(t);
  isSeekDragging = false;
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
  if (!audioObjectUrl) return;
  exportBtn.disabled = true;
  try {
    const blob = await (await fetch(audioObjectUrl)).blob();

    const filename = fileNameInput.value || "trimmed_audio.mp3";
    const file = new File([blob], filename, { type: "audio/mpeg" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        showToast("공유 시트로 내보냈습니다");
        return;
      } catch (shareErr) {
        if (shareErr.name === "AbortError") {
          return;
        }
      }
    }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("파일을 내보냈습니다");
  } catch (err) {
    showToast(err.message || "내보내기 실패");
  } finally {
    exportBtn.disabled = !audioObjectUrl;
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
    exportBtn.disabled = false;
    showToast("편집 내용을 저장했습니다. 이제 내보내기를 사용할 수 있습니다");
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
  saveBtn.disabled = true;
  try {
    const url = audioObjectUrl || `${API_BASE_URL}/api/audio/${currentJobId}`;
    const blob = audioObjectUrl
      ? await (await fetch(audioObjectUrl)).blob()
      : await (await fetch(url)).blob();

    const filename = fileNameInput.value || currentFilename;
    const file = new File([blob], filename, { type: "audio/mpeg" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        showToast("공유 시트로 저장했습니다");
        return;
      } catch (shareErr) {
        if (shareErr.name === "AbortError") {
          return;
        }
      }
    }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("저장되었습니다");
  } catch (err) {
    showToast("저장 실패");
  } finally {
    saveBtn.disabled = false;
  }
}

extractBtn.addEventListener("click", handleExtract);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleExtract();
});
urlInput.addEventListener("focus", () => urlInput.select());
urlInput.addEventListener("touchend", (e) => {
  if (document.activeElement === urlInput) {
    e.preventDefault();
    urlInput.select();
  }
});
renameBtn.addEventListener("click", handleRename);
saveBtn.addEventListener("click", handleSave);
playBtn.addEventListener("click", togglePlay);
resetBtn.addEventListener("click", resetRegion);
exportBtn.addEventListener("click", handleExport);
saveTrimBtn.addEventListener("click", handleSaveTrim);
seekBar.addEventListener("input", handleSeekInput);
seekBar.addEventListener("change", handleSeekCommit);
