(() => {
  "use strict";

  const ACCESS_KEY = "computer-org-map-access-key";
  const CLOUD_TOKEN_KEY = "computer-org-map-cloud-token";
  const CONFIG = window.SYNC_CONFIG || window.GITEE_CONFIG || {};
  const provider = String(CONFIG.provider || "gitee").toLowerCase();
  const cloudMode = Boolean(
    CONFIG.dataOwner &&
    CONFIG.dataRepo &&
    CONFIG.branch &&
    CONFIG.progressPath &&
    CONFIG.studyPath
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

  function getCloudToken() {
    try {
      return localStorage.getItem(CLOUD_TOKEN_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function setCloudToken(token) {
    const clean = String(token || "").trim();
    try {
      if (clean) {
        localStorage.setItem(CLOUD_TOKEN_KEY, clean);
      } else {
        localStorage.removeItem(CLOUD_TOKEN_KEY);
      }
    } catch (error) {
      // Ignore storage failures.
    }
    return clean;
  }

  function getGiteeToken() {
    return getCloudToken();
  }

  function setGiteeToken(token) {
    return setCloudToken(token);
  }

  function providerLabel() {
    return provider === "github" ? "GitHub" : "Gitee";
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

  function cloudContentsUrl(path) {
    const owner = encodeURIComponent(CONFIG.dataOwner);
    const repo = encodeURIComponent(CONFIG.dataRepo);
    const encodedPath = encodePath(path);
    const ref = encodeURIComponent(CONFIG.branch);
    if (provider === "github") {
      return (
        "https://api.github.com/repos/" +
        owner +
        "/" +
        repo +
        "/contents/" +
        encodedPath +
        "?ref=" +
        ref
      );
    }
    return (
      "https://gitee.com/api/v5/repos/" +
      owner +
      "/" +
      repo +
      "/contents/" +
      encodedPath +
      "?access_token=" +
      encodeURIComponent(getCloudToken()) +
      "&ref=" +
      ref
    );
  }

  function cloudHeaders(extra = {}) {
    if (provider !== "github") {
      return Object.assign({}, extra || {});
    }
    return Object.assign(
      {},
      {
        Authorization: "Bearer " + getCloudToken(),
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      extra || {}
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

  function entryData(entry) {
    const raw = entry && entry.content;
    const encoded = typeof raw === "string" ? raw : raw && raw.content;
    if (!encoded) {
      return null;
    }
    return JSON.parse(base64ToUtf8(encoded));
  }

  async function cloudGet(path) {
    const token = getCloudToken();
    if (!cloudMode || !token) {
      throw new Error(providerLabel() + " sync is not configured");
    }
    const response = await fetch(cloudContentsUrl(path), {
      cache: "no-store",
      headers: cloudHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(providerLabel() + " read failed: " + response.status);
    }
    const entry = await response.json();
    return {
      data: entryData(entry),
      sha: entry.sha || (entry.content && entry.content.sha) || "",
    };
  }

  async function cloudWrite(path, payload, sha) {
    const token = getCloudToken();
    if (!cloudMode || !token) {
      throw new Error(providerLabel() + " sync is not configured");
    }
    const content = utf8ToBase64(JSON.stringify(payload));
    const message = "sync " + new Date().toISOString();
    const branch = CONFIG.branch;
    const owner = encodeURIComponent(CONFIG.dataOwner);
    const repo = encodeURIComponent(CONFIG.dataRepo);
    const encodedPath = encodePath(path);

    if (provider === "github") {
      const body = { message, content, branch };
      if (sha) {
        body.sha = sha;
      }
      const response = await fetch(
        "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + encodedPath,
        {
          method: "PUT",
          headers: cloudHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error("GitHub write failed: " + response.status + " " + detail.slice(0, 160));
      }
      const entry = await response.json();
      const next = entryData(entry);
      return next || payload;
    }

    const body = {
      access_token: token,
      content,
      message,
      branch,
    };
    if (sha) {
      body.sha = sha;
    }
    const url =
      "https://gitee.com/api/v5/repos/" +
      owner +
      "/" +
      repo +
      "/contents/" +
      encodedPath;
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
    const next = entryData(entry);
    return next || payload;
  }

  async function getProgress() {
    if (cloudMode) {
      const entry = await cloudGet(CONFIG.progressPath);
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

  function isStaleCloudError(error) {
    const message = String((error && error.message) || "").toLowerCase();
    return (
      message.indexOf("sha is missing") >= 0 ||
      message.indexOf("sha is empty") >= 0 ||
      message.indexOf("sha is invalid") >= 0 ||
      message.indexOf("does not match") >= 0 ||
      message.indexOf("conflict") >= 0 ||
      message.indexOf("409") >= 0
    );
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function saveProgress(map) {
    if (cloudMode) {
      const path = CONFIG.progressPath;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const entry = await cloudGet(path);
        const currentMap = entry && entry.data && entry.data.map ? entry.data.map : {};
        const mergedMap = Object.assign({}, currentMap, map || {});
        const data = {
          version: (Number(entry && entry.data && entry.data.version) || 0) + 1,
          map: mergedMap,
          updatedAt: Date.now() / 1000,
        };
        try {
          return await cloudWrite(path, data, entry && entry.sha ? entry.sha : "");
        } catch (error) {
          if (attempt < 3 && isStaleCloudError(error)) {
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
    if (cloudMode) {
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
    if (cloudMode) {
      const entry = await cloudGet(CONFIG.studyPath);
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
    if (cloudMode) {
      const path = CONFIG.studyPath;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const entry = await cloudGet(path);
        const data = entry && entry.data ? entry.data : { version: 0, sessions: [] };
        if (!Array.isArray(data.sessions)) {
          data.sessions = [];
        }
        data.sessions.push(session);
        data.version = (Number(data.version) || 0) + 1;
        data.updatedAt = Date.now() / 1000;
        try {
          return await cloudWrite(path, data, entry && entry.sha ? entry.sha : "");
        } catch (error) {
          if (attempt < 3 && isStaleCloudError(error)) {
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
    mode: cloudMode ? "cloud" : "local",
    provider,
    config: CONFIG,
    getKey,
    setKey,
    headers,
    isPublicPage,
    getCloudToken,
    setCloudToken,
    getGiteeToken,
    setGiteeToken,
    getProgress,
    saveProgress,
    resetProgress,
    getStudy,
    addStudySession,
  };
})();