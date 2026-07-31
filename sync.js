(() => {
  "use strict";

  const ACCESS_KEY = "computer-org-map-access-key";
  const GITEE_TOKEN_KEY = "computer-org-map-gitee-token";
  const GITEE_CONFIG = window.GITEE_CONFIG || {};
  const giteeMode = Boolean(
    GITEE_CONFIG.dataOwner &&
    GITEE_CONFIG.dataRepo &&
    GITEE_CONFIG.branch &&
    GITEE_CONFIG.progressPath &&
    GITEE_CONFIG.studyPath
  );

  function readKeyFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const key = (params.get("key") || "").trim();
      if (!key) {
        return "";
      }
      try {
        localStorage.setItem(ACCESS_KEY, key);
      } catch (error) {
        // Keep the key usable for this page when storage is unavailable.
      }
      params.delete("key");
      const query = params.toString();
      const next = window.location.pathname + (query ? "?" + query : "") + window.location.hash;
      window.history.replaceState(window.history.state, "", next);
      return key;
    } catch (error) {
      return "";
    }
  }

  function storedKey() {
    try {
      return localStorage.getItem(ACCESS_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function getKey() {
    return readKeyFromUrl() || storedKey();
  }

  function setKey(key) {
    const clean = String(key || "").trim();
    try {
      if (clean) {
        localStorage.setItem(ACCESS_KEY, clean);
      } else {
        localStorage.removeItem(ACCESS_KEY);
      }
    } catch (error) {
      // Ignore storage failures; the current page still works in memory.
    }
    return clean;
  }

  function getGiteeToken() {
    try {
      return localStorage.getItem(GITEE_TOKEN_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function setGiteeToken(token) {
    const clean = String(token || "").trim();
    try {
      if (clean) {
        localStorage.setItem(GITEE_TOKEN_KEY, clean);
      } else {
        localStorage.removeItem(GITEE_TOKEN_KEY);
      }
    } catch (error) {
      // Ignore storage failures.
    }
    return clean;
  }

  function isPrivateHost(hostname) {
    const host = String(hostname || "").split(":")[0].toLowerCase();
    if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true;
    }
    if (/^(10\.|192\.168\.|169\.254\.)/.test(host)) {
      return true;
    }
    return /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  }

  function isPublicPage() {
    return !isPrivateHost(window.location.hostname);
  }

  function headers(extra = {}) {
    const key = getKey();
    const base = { "X-Sync-Client": "knowledge-map" };
    if (key) {
      base["X-Sync-Key"] = key;
    }
    return Object.assign({}, base, extra || {});
  }

  function encodePath(path) {
    return String(path)
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  function giteeContentsUrl(path) {
    const cfg = GITEE_CONFIG;
    return (
      "https://gitee.com/api/v5/repos/" +
      encodeURIComponent(cfg.dataOwner) +
      "/" +
      encodeURIComponent(cfg.dataRepo) +
      "/contents/" +
      encodePath(path) +
      "?access_token=" +
      encodeURIComponent(getGiteeToken()) +
      "&ref=" +
      encodeURIComponent(cfg.branch)
    );
  }

  function base64ToUtf8(value) {
    const binary = atob(String(value).replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function utf8ToBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  }

  async function giteeGet(path) {
    const token = getGiteeToken();
    if (!giteeMode || !token) {
      throw new Error("Gitee sync is not configured");
    }
    const response = await fetch(giteeContentsUrl(path), { cache: "no-store" });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("Gitee read failed: " + response.status);
    }
    const entry = await response.json();
    return {
      data: JSON.parse(base64ToUtf8(entry.content)),
      sha: entry.sha || "",
    };
  }

  async function giteeWrite(path, payload, sha) {
    const token = getGiteeToken();
    if (!giteeMode || !token) {
      throw new Error("Gitee sync is not configured");
    }
    const body = {
      access_token: token,
      content: utf8ToBase64(JSON.stringify(payload)),
      message: "sync " + new Date().toISOString(),
      branch: GITEE_CONFIG.branch,
    };
    if (sha) {
      body.sha = sha;
    }
    const url =
      "https://gitee.com/api/v5/repos/" +
      encodeURIComponent(GITEE_CONFIG.dataOwner) +
      "/" +
      encodeURIComponent(GITEE_CONFIG.dataRepo) +
      "/contents/" +
      encodePath(path);
    const response = await fetch(url, {
      method: sha ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error("Gitee write failed: " + response.status + " " + detail.slice(0, 160));
    }
    const entry = await response.json();
    if (entry && entry.content) {
      return JSON.parse(base64ToUtf8(entry.content));
    }
    return payload;
  }

  async function getProgress() {
    if (giteeMode) {
      const entry = await giteeGet(GITEE_CONFIG.progressPath);
      return entry ? entry.data : { version: 0, map: {} };
    }
    const response = await fetch("/api/progress", {
      cache: "no-store",
      headers: headers(),
    });
    if (!response.ok) {
      throw new Error("progress read failed");
    }
    return response.json();
  }

  function isStaleGiteeError(error) {
    const message = String((error && error.message) || "");
    return message.indexOf("sha is missing") >= 0 || message.indexOf("sha is empty") >= 0 || message.indexOf("sha is invalid") >= 0;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function saveProgress(map) {
    if (giteeMode) {
      const path = GITEE_CONFIG.progressPath;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const entry = await giteeGet(path);
        const currentMap = entry && entry.data && entry.data.map ? entry.data.map : {};
        const mergedMap = Object.assign({}, currentMap, map || {});
        const data = {
          version: (Number(entry && entry.data && entry.data.version) || 0) + 1,
          map: mergedMap,
          updatedAt: Date.now() / 1000,
        };
        try {
          return await giteeWrite(path, data, entry && entry.sha ? entry.sha : "");
        } catch (error) {
          if (attempt < 3 && isStaleGiteeError(error)) {
            await delay(300 * (attempt + 1));
            continue;
          }
          throw error;
        }
      }
    }
    const response = await fetch("/api/progress", {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(map || {}),
    });
    if (!response.ok) {
      throw new Error("progress save failed");
    }
    return response.json();
  }

  async function resetProgress() {
    if (giteeMode) {
      return saveProgress({});
    }
    const response = await fetch("/api/progress/reset", {
      method: "POST",
      headers: headers(),
    });
    if (!response.ok) {
      throw new Error("progress reset failed");
    }
    return response.json();
  }

  async function getStudy() {
    if (giteeMode) {
      const entry = await giteeGet(GITEE_CONFIG.studyPath);
      return entry ? entry.data : { version: 0, sessions: [] };
    }
    const response = await fetch("/api/study", {
      cache: "no-store",
      headers: headers(),
    });
    if (!response.ok) {
      throw new Error("study read failed");
    }
    return response.json();
  }

  async function addStudySession(session) {
    if (giteeMode) {
      const path = GITEE_CONFIG.studyPath;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const entry = await giteeGet(path);
        const data = entry && entry.data ? entry.data : { version: 0, sessions: [] };
        if (!Array.isArray(data.sessions)) {
          data.sessions = [];
        }
        data.sessions.push(session);
        data.version = (Number(data.version) || 0) + 1;
        data.updatedAt = Date.now() / 1000;
        try {
          return await giteeWrite(path, data, entry && entry.sha ? entry.sha : "");
        } catch (error) {
          if (attempt < 3 && isStaleGiteeError(error)) {
            await delay(300 * (attempt + 1));
            continue;
          }
          throw error;
        }
      }
    }
    const response = await fetch("/api/study/session", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(session),
    });
    if (!response.ok) {
      throw new Error("study save failed");
    }
    return response.json();
  }

  window.SyncClient = {
    mode: giteeMode ? "gitee" : "local",
    config: GITEE_CONFIG,
    getKey,
    setKey,
    headers,
    isPublicPage,
    getGiteeToken,
    setGiteeToken,
    getProgress,
    saveProgress,
    resetProgress,
    getStudy,
    addStudySession,
  };
})();
