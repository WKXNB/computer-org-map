(() => {
  "use strict";

  function syncHeaders(extra = {}) {
    return window.SyncClient
      ? window.SyncClient.headers(extra)
      : { "X-Sync-Client": "knowledge-map", ...extra };
  }
  const ACTIVE_KEY = "computer-org-study-active";
  const PENDING_KEY = "computer-org-study-pending";

  const els = {
    syncState: document.getElementById("syncState"),
    clockStatus: document.getElementById("clockStatus"),
    flipClock: document.getElementById("flipClock"),
    startButton: document.getElementById("startButton"),
    pauseButton: document.getElementById("pauseButton"),
    endButton: document.getElementById("endButton"),
    fullscreenButton: document.getElementById("fullscreenButton"),
    fullscreenStage: document.getElementById("fullscreenStage"),
    todayTotal: document.getElementById("todayTotal"),
    weekTotal: document.getElementById("weekTotal"),
    allTotal: document.getElementById("allTotal"),
    sessionList: document.getElementById("sessionList"),
    refreshButton: document.getElementById("refreshButton"),
  };

  let sessions = [];
  let pendingSessions = loadPendingSessions();
  let activeSession = loadActiveSession();
  let displayedSeconds = Math.floor(activeSeconds());
  let serverVersion = 0;

  function loadActiveSession() {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveActiveSession() {
    try {
      if (activeSession) {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeSession));
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    } catch (error) {
      // Timer still works in memory when storage is unavailable.
    }
  }

  function loadPendingSessions() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function savePendingSessions() {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pendingSessions));
    } catch (error) {
      // Keep pending sessions in memory when storage is unavailable.
    }
  }

  function activeSeconds() {
    if (!activeSession) {
      return 0;
    }
    const base = activeSession.accumulated || 0;
    if (!activeSession.startedAt) {
      return base;
    }
    return base + (Date.now() - activeSession.startedAt) / 1000;
  }

  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((value) => String(value).padStart(2, "0")).join("");
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    if (seconds < 60) {
      return `${seconds} 秒`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} 分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`;
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function allSessions() {
    return [...sessions, ...pendingSessions];
  }

  function renderClock() {
    const text = formatClock(displayedSeconds);
    const units = els.flipClock.querySelectorAll(".flip-unit");
    units.forEach((unit, index) => {
      const nextChar = text[index];
      const number = unit.querySelector(".flip-number");
      if (number.textContent !== nextChar) {
        number.textContent = nextChar;
        unit.classList.remove("flip");
        void unit.offsetWidth;
        unit.classList.add("flip");
      }
    });
  }

  function renderStats() {
    const todayKey = localDateKey();
    const now = Date.now();
    const weekStart = now - 6 * 24 * 60 * 60 * 1000;
    const list = allSessions();
    let todaySeconds = 0;
    let weekSeconds = 0;
    let totalSeconds = 0;

    list.forEach((session) => {
      const duration = Number(session.duration) || 0;
      totalSeconds += duration;
      if (session.date === todayKey) {
        todaySeconds += duration;
      }
      if (Number(session.endedAt) >= weekStart) {
        weekSeconds += duration;
      }
    });

    if (activeSession) {
      todaySeconds += displayedSeconds;
      totalSeconds += displayedSeconds;
      weekSeconds += displayedSeconds;
    }

    els.todayTotal.textContent = formatDuration(todaySeconds);
    els.weekTotal.textContent = formatDuration(weekSeconds);
    els.allTotal.textContent = formatDuration(totalSeconds);
  }

  function renderHistory() {
    const list = allSessions()
      .slice()
      .sort((a, b) => Number(b.endedAt) - Number(a.endedAt))
      .slice(0, 10);
    if (!list.length) {
      els.sessionList.innerHTML = `<li class="session-empty">暂无学习记录</li>`;
      return;
    }
    els.sessionList.innerHTML = list
      .map((session) => {
        const ended = new Date(Number(session.endedAt));
        const timeLabel = `${String(ended.getMonth() + 1).padStart(2, "0")}-${String(ended.getDate()).padStart(2, "0")} ${String(ended.getHours()).padStart(2, "0")}:${String(ended.getMinutes()).padStart(2, "0")}`;
        const note = session.note ? `<span>${escapeHtml(session.note)}</span>` : "";
        return `
          <li class="session-item">
            <div>
              <strong>${escapeHtml(formatDuration(session.duration))}</strong>
              ${note}
            </div>
            <time>${escapeHtml(timeLabel)}</time>
          </li>
        `;
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function updateControls() {
    const running = Boolean(activeSession && activeSession.startedAt);
    els.startButton.hidden = Boolean(activeSession);
    els.pauseButton.hidden = !running;
    els.endButton.hidden = !activeSession;

    if (running) {
      els.clockStatus.textContent = "学习中";
      els.clockStatus.className = "clock-status running";
    } else if (activeSession) {
      els.clockStatus.textContent = "已暂停";
      els.clockStatus.className = "clock-status paused";
    } else {
      els.clockStatus.textContent = "准备学习";
      els.clockStatus.className = "clock-status";
    }
    renderIcons();
  }

  async function loadStudy() {
    try {
      const data = await window.SyncClient.getStudy();
      sessions = Array.isArray(data.sessions) ? data.sessions : [];
      serverVersion = data.version || 0;
      els.syncState.classList.remove("offline");
      els.syncState.querySelector("span").textContent = "已连接";
    } catch (error) {
      els.syncState.classList.add("offline");
      els.syncState.querySelector("span").textContent = "离线";
    }
    renderStats();
    renderHistory();
    renderIcons();
  }

  async function postSession(session) {
    const data = await window.SyncClient.addStudySession(session);
    sessions = Array.isArray(data.sessions) ? data.sessions : sessions;
    serverVersion = data.version || 0;
  }

  async function flushPendingSessions() {
    if (!pendingSessions.length) {
      return;
    }
    const remaining = [];
    for (const session of pendingSessions) {
      try {
        await postSession(session);
      } catch (error) {
        remaining.push(session);
        break;
      }
    }
    pendingSessions = remaining;
    savePendingSessions();
    renderStats();
    renderHistory();
  }

  function startSession() {
    if (activeSession) {
      return;
    }
    const now = Date.now();
    activeSession = {
      startedAt: now,
      firstStartedAt: now,
      accumulated: 0,
      date: localDateKey(),
      note: "",
    };
    saveActiveSession();
    displayedSeconds = 0;
    renderClock();
    renderStats();
    updateControls();
  }

  function pauseSession() {
    if (!activeSession || !activeSession.startedAt) {
      return;
    }
    activeSession.accumulated = Math.floor(activeSeconds());
    activeSession.startedAt = null;
    saveActiveSession();
    updateControls();
    renderStats();
  }

  function endSession() {
    if (!activeSession) {
      return;
    }
    const endedAt = Date.now();
    const duration = Math.max(1, Math.round(activeSeconds()));
    const session = {
      startedAt: activeSession.firstStartedAt || endedAt - duration * 1000,
      endedAt,
      duration,
      date: activeSession.date || localDateKey(),
      note: activeSession.note || "",
    };
    pendingSessions.push(session);
    savePendingSessions();
    activeSession = null;
    saveActiveSession();
    displayedSeconds = 0;
    renderClock();
    renderStats();
    renderHistory();
    updateControls();
    flushPendingSessions();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await els.fullscreenStage.requestFullscreen();
      }
    } catch (error) {
      // Fullscreen can be unavailable in embedded browsers.
    }
  }

  function updateFullscreenButton() {
    const isFullscreen = Boolean(document.fullscreenElement);
    els.fullscreenButton.innerHTML = `
      <i data-lucide="${isFullscreen ? "minimize" : "maximize"}"></i>
      <span>${isFullscreen ? "退出全屏" : "全屏"}</span>
    `;
    renderIcons();
  }

  function bindEvents() {
    els.startButton.addEventListener("click", startSession);
    els.pauseButton.addEventListener("click", pauseSession);
    els.endButton.addEventListener("click", endSession);
    els.fullscreenButton.addEventListener("click", toggleFullscreen);
    els.refreshButton.addEventListener("click", () => loadStudy().then(flushPendingSessions));
    document.addEventListener("fullscreenchange", updateFullscreenButton);
  }

  function init() {
    bindEvents();
    displayedSeconds = Math.floor(activeSeconds());
    renderClock();
    renderStats();
    renderHistory();
    updateControls();
    renderIcons();
    loadStudy().then(flushPendingSessions);
    setInterval(() => {
      if (!activeSession) {
        return;
      }
      const seconds = Math.floor(activeSeconds());
      if (seconds !== displayedSeconds) {
        displayedSeconds = seconds;
        renderClock();
        renderStats();
      }
    }, 250);
    const studyPollMs = window.SyncClient && window.SyncClient.mode === "gitee" ? 20000 : 10000;
    setInterval(loadStudy, studyPollMs);
  }

  init();
})();
