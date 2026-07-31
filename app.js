(() => {
  "use strict";

  const graph = window.KNOWLEDGE_GRAPH;
  const STORAGE_KEY = "computer-org-map-review-v1";
  const PDF_NAME = "2027计算机组成原理_高清带书签版.pdf";
  const CANVAS_WIDTH = 2380;
  const CANVAS_HEIGHT = 1000;

  let reviewMap = {};
  let serverAvailable = false;
  let serverVersion = 0;
  let lastSavedJson = "";
  let saveTimer = null;
  let syncPollTimer = null;
  let selectedNode = { type: "root", id: "root" };
  let searchQuery = "";
  let statusFilter = "all";
  let zoom = 0.72;

  const nodeMeta = new Map();
  const els = {
    progressFill: document.getElementById("progressFill"),
    progressPercent: document.getElementById("progressPercent"),
    progressCount: document.getElementById("progressCount"),
    resetButton: document.getElementById("resetButton"),
    chapterList: document.getElementById("chapterList"),
    chapterCount: document.getElementById("chapterCount"),
    mobileStrip: document.getElementById("mobileStrip"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
    graphScroll: document.getElementById("graphScroll"),
    graphCanvas: document.getElementById("graphCanvas"),
    edgeLayer: document.getElementById("edgeLayer"),
    nodeLayer: document.getElementById("nodeLayer"),
    graphHint: document.getElementById("graphHint"),
    detailPanel: document.getElementById("detailPanel"),
    detailEmpty: document.getElementById("detailEmpty"),
    detailContent: document.getElementById("detailContent"),
    pointModal: document.getElementById("pointModal"),
    pointModalBody: document.getElementById("pointModalBody"),
    syncButton: document.getElementById("syncButton"),
    syncModal: document.getElementById("syncModal"),
    syncModalBody: document.getElementById("syncModalBody"),
    zoomIn: document.getElementById("zoomIn"),
    zoomOut: document.getElementById("zoomOut"),
    fitGraph: document.getElementById("fitGraph"),
  };

  function loadLocalReviewMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  async function loadInitialProgress() {
    reviewMap = loadLocalReviewMap();
    try {
      const data = await window.SyncClient.getProgress();
      if (data && data.map && typeof data.map === "object") {
        reviewMap = data.map;
        serverAvailable = true;
        serverVersion = data.version || 0;
        lastSavedJson = JSON.stringify(reviewMap);
        localStorage.setItem(STORAGE_KEY, lastSavedJson);
      }
    } catch (error) {
      serverAvailable = false;
    }
  }

  function saveReviewMap() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewMap));
    } catch (error) {
      // Keep in-memory progress when storage is unavailable.
    }
    scheduleServerSave();
  }

  function scheduleServerSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(sendServerSave, 150);
  }

  function syncHeaders(extra = {}) {
    if (window.SyncClient) {
      return window.SyncClient.headers(extra);
    }
    return {
      "X-Sync-Client": "knowledge-map",
      ...extra,
    };
  }

  async function sendServerSave() {
    if (!serverAvailable) {
      return;
    }
    const currentJson = JSON.stringify(reviewMap);
    if (currentJson === lastSavedJson) {
      return;
    }
    lastSavedJson = currentJson;
    try {
      const data = await window.SyncClient.saveProgress(reviewMap);
      serverVersion = data.version || 0;
    } catch (error) {
      serverAvailable = false;
      lastSavedJson = "";
    }
  }

  async function syncFromServer() {
    try {
      const data = await window.SyncClient.getProgress();
      const remoteMap = data && data.map ? data.map : {};
      serverAvailable = true;
      serverVersion = data.version || 0;
      const remoteJson = JSON.stringify(remoteMap);
      if (remoteJson !== JSON.stringify(reviewMap)) {
        reviewMap = remoteMap;
        lastSavedJson = remoteJson;
        localStorage.setItem(STORAGE_KEY, remoteJson);
        refreshProgressUI();
        renderDetail();
      }
    } catch (error) {
      serverAvailable = false;
    }
  }

  function startSyncPolling() {
    clearInterval(syncPollTimer);
    const pollMs = window.SyncClient && window.SyncClient.mode === "gitee" ? 10000 : 4000;
    syncPollTimer = setInterval(syncFromServer, pollMs);
  }

  async function resetServerProgress() {
    try {
      const data = await window.SyncClient.resetProgress();
      serverAvailable = true;
      serverVersion = data.version || 0;
      reviewMap = {};
      lastSavedJson = "{}";
      localStorage.setItem(STORAGE_KEY, "{}");
      refreshProgressUI();
      renderDetail();
    } catch (error) {
      serverAvailable = false;
    }
  }

  function pointId(topic, index) {
    return `${topic.id}-${index}`;
  }

  function getPoints(section) {
    const points = [];
    section.topics.forEach((topic) => {
      topic.points.forEach((text, index) => {
        points.push({ id: pointId(topic, index), text });
      });
    });
    return points;
  }

  function getAllPoints() {
    const points = [];
    graph.chapters.forEach((chapter) => {
      chapter.sections.forEach((section) => {
        points.push(...getPoints(section));
      });
    });
    return points;
  }

  function statsFor(points) {
    let done = 0;
    points.forEach((point) => {
      if (reviewMap[point.id]) {
        done += 1;
      }
    });
    return { total: points.length, done };
  }

  function statusForStats(stats) {
    if (!stats.total) {
      return "todo";
    }
    if (stats.done === stats.total) {
      return "done";
    }
    if (stats.done > 0) {
      return "doing";
    }
    return "todo";
  }

  function percentFor(stats) {
    if (!stats.total) {
      return 0;
    }
    return Math.round((stats.done / stats.total) * 100);
  }

  const PDF_PARTS = [
    { file: "ch1.pdf", start: 13, end: 31 },
    { file: "ch2.pdf", start: 32, end: 88 },
    { file: "ch3.pdf", start: 89, end: 147 },
    { file: "ch4.pdf", start: 148, end: 206 },
    { file: "ch5a.pdf", start: 207, end: 246 },
    { file: "ch5b.pdf", start: 247, end: 285 },
    { file: "ch6.pdf", start: 286, end: 302 },
    { file: "ch7.pdf", start: 303, end: 340 },
  ];

  function pdfUrl(page) {
    if (!page) {
      return "#";
    }
    const part = PDF_PARTS.find((item) => page >= item.start && page <= item.end);
    if (!part) {
      return "#";
    }
    return `./pdf/${part.file}#page=${page - part.start + 1}`;
  }

  function esc(value) {
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

  function updateHeaderProgress() {
    const stats = statsFor(getAllPoints());
    const percent = percentFor(stats);
    els.progressFill.style.width = `${percent}%`;
    els.progressPercent.textContent = `${percent}%`;
    els.progressCount.textContent = `${stats.done} / ${stats.total}`;
  }

  function chapterStats(chapter) {
    const points = [];
    chapter.sections.forEach((section) => {
      points.push(...getPoints(section));
    });
    return statsFor(points);
  }

  function sectionStats(section) {
    return statsFor(getPoints(section));
  }

  function renderSidebar() {
    els.chapterList.innerHTML = "";
    const totalStats = statsFor(getAllPoints());
    els.chapterCount.textContent = `${graph.chapters.length} 章 · ${totalStats.total} 点`;

    graph.chapters.forEach((chapter, index) => {
      const stats = chapterStats(chapter);
      const percent = percentFor(stats);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chapter-item";
      button.style.setProperty("--chapter-color", chapter.color);
      button.classList.toggle("selected", selectedNode.id === chapter.id);
      button.innerHTML = `
        <span class="chapter-number">${index + 1}</span>
        <span class="chapter-item-copy">
          <span class="chapter-item-title">${esc(chapter.title)}</span>
          <span class="chapter-item-progress"><span style="width:${percent}%"></span></span>
        </span>
        <span class="chapter-item-count">${stats.done}/${stats.total}</span>
      `;
      button.addEventListener("click", () => selectNode("chapter", chapter.id));
      els.chapterList.appendChild(button);
    });
  }

  function renderMobileStrip() {
    els.mobileStrip.innerHTML = "";
    graph.chapters.forEach((chapter, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mobile-chip";
      button.style.setProperty("--chapter-color", chapter.color);
      button.classList.toggle("selected", selectedNode.id === chapter.id);
      button.textContent = `${index + 1} ${chapter.short}`;
      button.addEventListener("click", () => selectNode("chapter", chapter.id));
      els.mobileStrip.appendChild(button);
    });
  }

  function edgePath(x1, y1, x2, y2) {
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }

  function addGraphNode(meta) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `graph-node ${meta.kind}-node`;
    el.id = `node-${meta.id}`;
    el.style.left = `${meta.x}px`;
    el.style.top = `${meta.y}px`;
    el.style.setProperty("--chapter-color", meta.chapterColor);
    el.style.setProperty("--node-color", meta.nodeColor || meta.chapterColor);
    el.innerHTML = meta.html;
    el.addEventListener("click", () => selectNode(meta.type, meta.id));
    els.nodeLayer.appendChild(el);
    nodeMeta.set(meta.id, { ...meta, element: el });
  }

  function buildGraph() {
    els.nodeLayer.innerHTML = "";
    els.edgeLayer.innerHTML = "";
    nodeMeta.clear();

    const totalStats = statsFor(getAllPoints());
    addGraphNode({
      id: "root",
      type: "root",
      kind: "root",
      x: 80,
      y: 480,
      chapterColor: "#1f2430",
      nodeColor: "#1f2430",
      html: `
        <span class="root-node-content">
          <span class="node-title">知识图谱</span>
          <span class="node-sub">${totalStats.total} 个知识点</span>
        </span>
      `,
    });

    graph.chapters.forEach((chapter, chapterIndex) => {
      const chapterY = 130 + chapterIndex * 110;
      const chapterStatsValue = chapterStats(chapter);
      const chapterStatus = statusForStats(chapterStatsValue);
      const chapterPercent = percentFor(chapterStatsValue);

      addGraphNode({
        id: chapter.id,
        type: "chapter",
        kind: "chapter",
        x: 290,
        y: chapterY,
        chapter,
        chapterColor: chapter.color,
        nodeColor: chapter.color,
        html: `
          <span class="chapter-node-content">
            <span class="node-kicker">
              <b>第 ${chapterIndex + 1} 章</b>
              <span class="node-status ${chapterStatus}"></span>
            </span>
            <span class="node-title">${esc(chapter.title)}</span>
            <span class="node-sub">
              <span>${chapterStatsValue.done}/${chapterStatsValue.total} 已复习</span>
              <span class="node-progress">${chapterPercent}%</span>
            </span>
          </span>
        `,
      });

      chapter.sections.forEach((section, sectionIndex) => {
        const stats = sectionStats(section);
        const status = statusForStats(stats);
        const percent = percentFor(stats);
        addGraphNode({
          id: section.id,
          type: "section",
          kind: "section",
          x: 570 + sectionIndex * 205,
          y: chapterY,
          chapter,
          section,
          chapterColor: chapter.color,
          nodeColor: chapter.color,
          html: `
            <span class="section-node-content">
              <span class="node-kicker">
                <b>${esc(section.id)}</b>
                <span class="node-status ${status}"></span>
              </span>
              <span class="node-title">${esc(section.title)}</span>
              <span class="node-sub">
                <span>${section.topics.length} 个主题</span>
                <span class="node-progress">${percent}%</span>
              </span>
            </span>
          `,
        });
      });
    });

    const rootMeta = nodeMeta.get("root");
    graph.chapters.forEach((chapter) => {
      const chapterMeta = nodeMeta.get(chapter.id);
      appendEdge(rootMeta, chapterMeta);
      chapter.sections.forEach((section) => {
        appendEdge(chapterMeta, nodeMeta.get(section.id));
      });
    });
  }

  function appendEdge(fromMeta, toMeta) {
    if (!fromMeta || !toMeta) {
      return;
    }
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", edgePath(fromMeta.x, fromMeta.y, toMeta.x, toMeta.y));
    path.classList.add("edge");
    path.dataset.from = fromMeta.id;
    path.dataset.to = toMeta.id;
    els.edgeLayer.appendChild(path);
  }

  function chapterMatches(chapter) {
    const text = [
      chapter.title,
      chapter.short,
      chapter.summary,
      ...chapter.sections.flatMap((section) => sectionText(section)),
    ]
      .join(" ")
      .toLowerCase();
    if (searchQuery && !text.includes(searchQuery)) {
      return false;
    }
    return statusMatchesStats(chapterStats(chapter));
  }

  function sectionMatches(section) {
    const text = sectionText(section).toLowerCase();
    if (searchQuery && !text.includes(searchQuery)) {
      return false;
    }
    return statusMatchesStats(sectionStats(section));
  }

  function chapterSearchMatches(chapter) {
    const text = [
      chapter.title,
      chapter.short,
      chapter.summary,
      ...chapter.sections.flatMap((section) => sectionText(section)),
    ]
      .join(" ")
      .toLowerCase();
    return !searchQuery || text.includes(searchQuery);
  }

  function sectionText(section) {
    return [
      section.id,
      section.title,
      section.summary,
      ...section.topics.flatMap((topic) => [
        topic.id,
        topic.title,
        ...topic.points,
      ]),
    ].join(" ");
  }

  function statusMatchesStats(stats) {
    const status = statusForStats(stats);
    if (statusFilter === "all") {
      return true;
    }
    if (statusFilter === "todo") {
      return status === "todo";
    }
    if (statusFilter === "doing") {
      return status === "doing";
    }
    if (statusFilter === "done") {
      return status === "done";
    }
    return true;
  }

  function applyFilters() {
    let anyVisible = false;
    nodeMeta.forEach((meta) => {
      let visible = false;
      if (meta.type === "root") {
        visible = graph.chapters.some((chapter) => chapterMatches(chapter));
      } else if (meta.type === "chapter") {
        visible = chapterMatches(meta.chapter);
      } else if (meta.type === "section") {
        visible = chapterSearchMatches(meta.chapter) && sectionMatches(meta.section);
      }
      if (visible) {
        anyVisible = true;
      }
      meta.element.classList.toggle("hidden", !visible);
    });

    els.edgeLayer.querySelectorAll(".edge").forEach((edge) => {
      const from = nodeMeta.get(edge.dataset.from);
      const to = nodeMeta.get(edge.dataset.to);
      const hidden =
        !from ||
        !to ||
        from.element.classList.contains("hidden") ||
        to.element.classList.contains("hidden");
      edge.classList.toggle("hidden", hidden);

      const linked =
        isLinkedMeta(from) ||
        isLinkedMeta(to);
      edge.classList.toggle("linked", linked);
      const color = from?.chapter?.color || to?.chapter?.color || "#2f7cf6";
      edge.style.setProperty("--link-color", color);
    });

    if (!anyVisible) {
      els.graphHint.textContent = "没有匹配的知识节点";
    } else {
      updateGraphHint();
    }
  }

  function isLinkedMeta(meta) {
    if (!meta) {
      return false;
    }
    if (selectedNode.type === "chapter") {
      return meta.type === "chapter" && meta.id === selectedNode.id;
    }
    if (selectedNode.type === "section") {
      if (meta.type === "section" && meta.id === selectedNode.id) {
        return true;
      }
      return meta.type === "chapter" && meta.id === meta.chapter?.id && meta.id === selectedNode.chapterId;
    }
    return meta.type === "root";
  }

  function updateSelectedNodeClasses() {
    nodeMeta.forEach((meta) => {
      const selected =
        meta.type === selectedNode.type && meta.id === selectedNode.id;
      meta.element.classList.toggle("selected", selected);
    });
  }

  function updateGraphHint() {
    if (selectedNode.type === "root") {
      els.graphHint.textContent = "全部知识图谱";
    } else if (selectedNode.type === "chapter") {
      const chapter = graph.chapters.find((item) => item.id === selectedNode.id);
      els.graphHint.textContent = chapter ? `第 ${graph.chapters.indexOf(chapter) + 1} 章 · ${chapter.title}` : "知识图谱";
    } else if (selectedNode.type === "section") {
      let section = null;
      graph.chapters.forEach((chapter) => {
        const match = chapter.sections.find((item) => item.id === selectedNode.id);
        if (match) {
          section = match;
        }
      });
      els.graphHint.textContent = section ? `${section.id} · ${section.title}` : "知识图谱";
    }
  }

  function selectNode(type, id) {
    selectedNode = { type, id };
    if (type === "section") {
      graph.chapters.forEach((chapter) => {
        if (chapter.sections.some((section) => section.id === id)) {
          selectedNode.chapterId = chapter.id;
        }
      });
    }
    updateSelectedNodeClasses();
    applyFilters();
    updateGraphHint();
    renderDetail();
    renderSidebar();
    renderMobileStrip();
    renderIcons();
    if (window.matchMedia("(max-width: 1020px)").matches && selectedNode.type !== "root") {
      els.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function detailPointGroups() {
    if (selectedNode.type === "root") {
      return [];
    }
    if (selectedNode.type === "chapter") {
      const chapter = graph.chapters.find((item) => item.id === selectedNode.id);
      return chapter.sections.map((section) => ({
        heading: `${section.id} ${section.title}`,
        page: section.page,
        topics: section.topics,
        section,
      }));
    }
    if (selectedNode.type === "section") {
      let section = null;
      graph.chapters.forEach((chapter) => {
        const match = chapter.sections.find((item) => item.id === selectedNode.id);
        if (match) {
          section = match;
        }
      });
      return section
        ? section.topics.map((topic) => ({
            heading: topic.title,
            page: topic.page || section.page,
            topics: [topic],
            section,
          }))
        : [];
    }
    return [];
  }

  function selectedContext() {
    if (selectedNode.type === "root") {
      const stats = statsFor(getAllPoints());
      return {
        badge: "408",
        title: "全部知识图谱",
        page: "",
        pageNumber: null,
        summary: graph.meta.source,
        color: "#1f2430",
        stats,
        groups: [],
        root: true,
      };
    }
    if (selectedNode.type === "chapter") {
      const chapter = graph.chapters.find((item) => item.id === selectedNode.id);
      const stats = chapterStats(chapter);
      return {
        badge: `第 ${graph.chapters.indexOf(chapter) + 1} 章`,
        title: chapter.title,
        page: `PDF 第 ${chapter.page} 页`,
        pageNumber: chapter.page,
        summary: chapter.summary,
        color: chapter.color,
        stats,
        groups: detailPointGroups(),
      };
    }
    if (selectedNode.type === "section") {
      let chapter = null;
      let section = null;
      graph.chapters.forEach((item) => {
        const match = item.sections.find((entry) => entry.id === selectedNode.id);
        if (match) {
          chapter = item;
          section = match;
        }
      });
      const stats = sectionStats(section);
      return {
        badge: chapter ? `第 ${graph.chapters.indexOf(chapter) + 1} 章` : "",
        title: section.title,
        page: `PDF 第 ${section.page} 页`,
        pageNumber: section.page,
        summary: section.summary,
        color: chapter ? chapter.color : "#1f2430",
        stats,
        groups: detailPointGroups(),
      };
    }
    return null;
  }

  function renderDetail() {
    const context = selectedContext();
    if (!context) {
      els.detailEmpty.hidden = false;
      els.detailContent.hidden = true;
      return;
    }

    els.detailEmpty.hidden = true;
    els.detailContent.hidden = false;
    const percent = percentFor(context.stats);
    let html = `
      <div class="detail-header">
        <div class="detail-kicker">
          <span class="chapter-badge" style="background:${context.color}">${esc(context.badge)}</span>
          <div class="detail-kicker-right">
            <span class="page-tag">${esc(context.page)}</span>
            ${
              context.pageNumber
                ? `<a class="action-button page-jump-button" href="${pdfUrl(context.pageNumber)}" target="_blank" rel="noopener">
                    <i data-lucide="file-down"></i><span>打开 PDF 第 ${context.pageNumber} 页</span>
                  </a>`
                : ""
            }
          </div>
        </div>
        <h2>${esc(context.title)}</h2>
        <p class="detail-summary">${esc(context.summary)}</p>
      </div>
      <div class="detail-stats">
        <div class="stat-box"><strong>${context.stats.total}</strong><span>总知识点</span></div>
        <div class="stat-box"><strong>${context.stats.done}</strong><span>已复习</span></div>
        <div class="stat-box"><strong>${percent}%</strong><span>完成度</span></div>
      </div>
      <div class="detail-actions">
        <button class="action-button" type="button" data-action="mark-all">
          <i data-lucide="check-check"></i><span>全部标记</span>
        </button>
        <button class="action-button" type="button" data-action="clear-all">
          <i data-lucide="eraser"></i><span>全部清除</span>
        </button>
      </div>
    `;

    if (context.root) {
      html += `<div class="chapter-overview">`;
      graph.chapters.forEach((chapter, index) => {
        const stats = chapterStats(chapter);
        html += `
          <div class="overview-section">
            <h3>第 ${index + 1} 章 · ${esc(chapter.title)}</h3>
            <p>${esc(chapter.summary)}</p>
            <button class="action-button" type="button" data-open-chapter="${esc(chapter.id)}">
              <i data-lucide="arrow-right"></i><span>${stats.done}/${stats.total}</span>
            </button>
          </div>
        `;
      });
      html += `</div>`;
    } else {
      context.groups.forEach((group) => {
        html += `
          <div class="topic-group">
            <div class="topic-group-head">
              <h3>${esc(group.heading)}</h3>
              ${
                group.page
                  ? `<span><a class="topic-page-link" href="${pdfUrl(group.page)}" target="_blank" rel="noopener">
                      <i data-lucide="external-link"></i>PDF p.${group.page}
                    </a></span>`
                  : "<span></span>"
              }
            </div>
            <ul class="point-list">
        `;
        group.topics.forEach((topic) => {
          topic.points.forEach((text, index) => {
            const id = pointId(topic, index);
            const checked = Boolean(reviewMap[id]);
            html += `
              <li class="point-item ${checked ? "done" : ""}">
                <label class="point-toggle">
                  <input type="checkbox" data-point-id="${esc(id)}" ${checked ? "checked" : ""} />
                  <span class="point-check"><i data-lucide="check"></i></span>
                  <span>${esc(text)}</span>
                </label>
                <button class="point-detail-button" type="button" data-point-detail="${esc(id)}" aria-label="查看知识点详情" title="查看知识点详情">
                  <i data-lucide="book-open"></i>
                </button>
              </li>
            `;
          });
        });
        html += `</ul></div>`;
      });
    }

    els.detailContent.innerHTML = html;
    bindDetailEvents();
    renderIcons();
  }

  function bindDetailEvents() {
    els.detailContent.querySelectorAll("input[data-point-id]").forEach((input) => {
      input.addEventListener("change", () => {
        const id = input.dataset.pointId;
        reviewMap[id] = input.checked;
        saveReviewMap();
        input.closest(".point-item").classList.toggle("done", input.checked);
        refreshProgressUI();
      });
    });

    els.detailContent.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        const points = currentScopePoints();
        points.forEach((point) => {
          reviewMap[point.id] = action === "mark-all";
        });
        saveReviewMap();
        renderDetail();
        refreshProgressUI();
      });
    });

    els.detailContent.querySelectorAll("[data-point-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        const found = findPointById(button.dataset.pointDetail);
        if (found) {
          openPointModal(found);
        }
      });
    });

    els.detailContent.querySelectorAll("[data-open-chapter]").forEach((button) => {
      button.addEventListener("click", () => {
        selectNode("chapter", button.dataset.openChapter);
      });
    });
  }

  function findPointById(id) {
    for (const chapter of graph.chapters) {
      for (const section of chapter.sections) {
        for (const topic of section.topics) {
          const index = topic.points.findIndex((_, pointIndex) => pointId(topic, pointIndex) === id);
          if (index >= 0) {
            return {
              chapter,
              section,
              topic,
              point: topic.points[index],
              pointId: id,
            };
          }
        }
      }
    }
    return null;
  }

  function openPointModal(found) {
    renderPointModal(found);
    els.pointModal.hidden = false;
    els.pointModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closePointModal() {
    els.pointModal.hidden = true;
    els.pointModal.setAttribute("aria-hidden", "true");
    if (els.syncModal.hidden) {
      document.body.style.overflow = "";
    }
  }

  function renderPointModal(found) {
    const done = Boolean(reviewMap[found.pointId]);
    const chapterIndex = graph.chapters.indexOf(found.chapter);
    const related = found.topic.points
      .map((text, index) => ({ id: pointId(found.topic, index), text }))
      .filter((item) => item.id !== found.pointId);
    const color = found.chapter.color;
    els.pointModalBody.innerHTML = `
      <div class="modal-path">
        <span class="path-chip" style="--detail-color:${color}">
          <i data-lucide="book-marked"></i>
          第 ${chapterIndex + 1} 章 · ${esc(found.chapter.title)}
        </span>
        <span class="path-chip">
          <i data-lucide="folder-tree"></i>
          ${esc(found.section.id)} · ${esc(found.section.title)}
        </span>
        <span class="path-chip">
          <i data-lucide="file-text"></i>
          ${esc(found.topic.title)}
        </span>
      </div>
      <p class="modal-point" style="--detail-color:${color}">${esc(found.point)}</p>
      <div class="modal-section">
        <h3><i data-lucide="sparkles"></i>相关知识</h3>
        <p>${esc(found.section.summary)}</p>
      </div>
      <div class="modal-section">
        <h3><i data-lucide="list"></i>同主题关联知识点</h3>
        <ul class="modal-related-list">
          ${related.length ? related.map((item) => `<li>${esc(item.text)}</li>`).join("") : "<li>当前主题下暂无其他知识点。</li>"}
        </ul>
      </div>
      <div class="modal-actions">
        <a class="action-button page-jump-button" href="${pdfUrl(found.topic.page || found.section.page)}" target="_blank" rel="noopener">
          <i data-lucide="file-down"></i>
          <span>打开 PDF 第 ${found.topic.page || found.section.page} 页</span>
        </a>
        <button class="action-button ${done ? "done" : ""}" type="button" data-point-toggle="${esc(found.pointId)}">
          <i data-lucide="${done ? "check-circle-2" : "circle"}"></i>
          <span>${done ? "已复习" : "标记为已复习"}</span>
        </button>
        <span class="modal-status ${done ? "done" : ""}">${done ? "当前知识点已复习" : "当前知识点未复习"}</span>
      </div>
    `;
    renderIcons();
  }

  function withAccessKey(url, key) {
    if (!url || !key) {
      return url;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return url;
      }
      parsed.searchParams.set("key", key);
      return parsed.href;
    } catch (error) {
      return url;
    }
  }

  function syncUrls(tunnelUrl, key) {
    const configured = window.SERVER_CONFIG && window.SERVER_CONFIG.urls ? window.SERVER_CONFIG.urls : [];
    const urls = [];
    if (tunnelUrl) {
      urls.push(withAccessKey(tunnelUrl, key));
    }
    configured.forEach((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
          urls.push(parsed.href);
        }
      } catch (error) {
        // Ignore malformed configured URLs.
      }
    });
    if (!urls.length) {
      urls.push("http://127.0.0.1:4173/");
    }
    const unique = [];
    urls.forEach((url) => {
      const base = url.split("?")[0];
      if (!unique.some((item) => item.split("?")[0] === base)) {
        unique.push(url);
      }
    });
    return unique;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchTunnelUrl(timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    let tunnelUrl = (window.SERVER_CONFIG && window.SERVER_CONFIG.tunnelUrl) || "";
    while (Date.now() < deadline) {
      if (tunnelUrl) {
        return tunnelUrl;
      }
      try {
        const response = await fetch("/api/tunnel", {
          cache: "no-store",
          headers: syncHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            tunnelUrl = data.url;
            return tunnelUrl;
          }
        }
      } catch (error) {
        // Keep polling so a tunnel that starts late still appears.
      }
      await sleep(1000);
    }
    return tunnelUrl;
  }

  async function fetchAccessKey() {
    try {
      const response = await fetch("/api/access", {
        cache: "no-store",
        headers: syncHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        return data.key || "";
      }
    } catch (error) {
      // Public visitors without a key still get the LAN-friendly modal.
    }
    return "";
  }

  async function openSyncModal() {
    await renderSyncModal();
    els.syncModal.hidden = false;
    els.syncModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeSyncModal() {
    els.syncModal.hidden = true;
    els.syncModal.setAttribute("aria-hidden", "true");
    if (els.pointModal.hidden) {
      document.body.style.overflow = "";
    }
  }

  function giteeSiteUrl() {
    const cfg = window.SyncClient ? window.SyncClient.config : {};
    if (cfg.siteOwner && cfg.siteRepo) {
      return `https://${cfg.siteOwner}.gitee.io/${cfg.siteRepo}/`;
    }
    return window.location.origin + window.location.pathname;
  }

  async function renderSyncModal() {
    if (window.SyncClient && window.SyncClient.mode === "gitee") {
      renderGiteeSyncModal();
      return;
    }
    els.syncModalBody.innerHTML = `
      <h2 class="sync-modal-title">手机同步</h2>
      <p class="sync-modal-subtitle">正在获取可访问地址，请稍候...</p>
      <div class="sync-loading"><i data-lucide="loader-circle"></i><span>正在建立公网隧道</span></div>
    `;
    const tunnelUrl = await fetchTunnelUrl();
    const accessKey = await fetchAccessKey();
    const urls = syncUrls(tunnelUrl, accessKey);
    const qrUrl = urls.find((url) => url.startsWith("https://")) || urls[0];
    const publicReady = urls.some((url) => url.startsWith("https://"));
    els.syncModalBody.innerHTML = `
      <h2 class="sync-modal-title">手机同步</h2>
      <p class="sync-modal-subtitle">${publicReady ? "手机不用连接电脑的 Wi-Fi，扫描公网二维码即可访问并同步；同一 Wi-Fi 也可使用下方局域网地址。" : "公网地址暂未建立，同一 Wi-Fi 下仍可扫码使用。"}</p>
      <div class="sync-qr-wrap"><div id="syncQrBox"></div></div>
      ${accessKey ? `<p class="sync-access-key">访问密钥：<code>${esc(accessKey)}</code></p>` : ""}
      <ul class="sync-url-list">
        ${urls
          .map(
            (url) => `
              <li class="sync-url-item ${url.startsWith("https://") ? "public" : ""}">
                <span class="sync-url-label">${url.startsWith("https://") ? "公网 · 不同 Wi-Fi" : "局域网 · 同一 Wi-Fi"}</span>
                <code>${esc(url)}</code>
                <button class="sync-copy" type="button" data-copy-url="${esc(url)}">
                  <i data-lucide="copy"></i><span>复制</span>
                </button>
              </li>
            `,
          )
          .join("")}
      </ul>
    `;
    const qrBox = els.syncModalBody.querySelector("#syncQrBox");
    if (window.QRCode && qrBox) {
      qrBox.innerHTML = "";
      new window.QRCode(qrBox, {
        text: qrUrl,
        width: 220,
        height: 220,
        colorDark: "#1f2430",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    }
    els.syncModalBody.querySelectorAll("[data-copy-url]").forEach((button) => {
      button.addEventListener("click", async () => {
        const text = button.dataset.copyUrl;
        try {
          await navigator.clipboard.writeText(text);
          button.querySelector("span").textContent = "已复制";
        } catch (error) {
          button.querySelector("span").textContent = text;
        }
      });
    });
    renderIcons();
  }

  function renderGiteeSyncModal() {
    const token = window.SyncClient.getGiteeToken();
    const siteUrl = giteeSiteUrl();
    els.syncModalBody.innerHTML = `
      <h2 class="sync-modal-title">Gitee 云端同步</h2>
      <p class="sync-modal-subtitle">网站已发布到 Gitee Pages，电脑关闭后手机仍可访问和同步。</p>
      <div class="sync-qr-wrap"><div id="syncQrBox"></div></div>
      ${token ? `<p class="sync-access-key">云端令牌：<code>已保存</code></p>` : `<div class="gitee-token-form">
        <label for="giteeTokenInput">Gitee 私人令牌</label>
        <input id="giteeTokenInput" type="password" autocomplete="off" placeholder="粘贴私人令牌" />
        <button class="sync-copy" type="button" data-save-gitee-token><i data-lucide="save"></i><span>保存令牌</span></button>
      </div>`}
      <ul class="sync-url-list">
        <li class="sync-url-item public">
          <span class="sync-url-label">Gitee 页面</span>
          <code>${esc(siteUrl)}</code>
          <button class="sync-copy" type="button" data-copy-url="${esc(siteUrl)}">
            <i data-lucide="copy"></i><span>复制</span>
          </button>
        </li>
      </ul>
    `;
    const qrBox = els.syncModalBody.querySelector("#syncQrBox");
    if (window.QRCode && qrBox) {
      qrBox.innerHTML = "";
      new window.QRCode(qrBox, {
        text: siteUrl,
        width: 220,
        height: 220,
        colorDark: "#1f2430",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    }
    els.syncModalBody.querySelectorAll("[data-copy-url]").forEach((button) => {
      button.addEventListener("click", async () => {
        const text = button.dataset.copyUrl;
        try {
          await navigator.clipboard.writeText(text);
          button.querySelector("span").textContent = "已复制";
        } catch (error) {
          button.querySelector("span").textContent = text;
        }
      });
    });
    const saveButton = els.syncModalBody.querySelector("[data-save-gitee-token]");
    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const input = els.syncModalBody.querySelector("#giteeTokenInput");
        const nextToken = input.value.trim();
        if (!nextToken) {
          input.focus();
          return;
        }
        window.SyncClient.setGiteeToken(nextToken);
        renderGiteeSyncModal();
        syncFromServer().then(() => {
          if (serverAvailable) {
            scheduleServerSave();
          }
        });
      });
    }
    renderIcons();
  }

  function currentScopePoints() {
    if (selectedNode.type === "root") {
      return getAllPoints();
    }
    if (selectedNode.type === "chapter") {
      const chapter = graph.chapters.find((item) => item.id === selectedNode.id);
      const points = [];
      chapter.sections.forEach((section) => {
        points.push(...getPoints(section));
      });
      return points;
    }
    if (selectedNode.type === "section") {
      let section = null;
      graph.chapters.forEach((chapter) => {
        const match = chapter.sections.find((item) => item.id === selectedNode.id);
        if (match) {
          section = match;
        }
      });
      return getPoints(section);
    }
    return [];
  }

  function refreshProgressUI() {
    updateHeaderProgress();
    renderSidebar();
    renderMobileStrip();
    buildGraph();
    applyFilters();
    updateSelectedNodeClasses();
    updateGraphHint();
    renderIcons();
  }

  function applyZoom() {
    const nextWidth = Math.round(CANVAS_WIDTH * zoom);
    const nextHeight = Math.round(CANVAS_HEIGHT * zoom);
    els.graphCanvas.style.width = `${nextWidth}px`;
    els.graphCanvas.style.height = `${nextHeight}px`;
    els.graphCanvas.style.transform = `scale(${zoom})`;
    els.graphCanvas.style.transformOrigin = "0 0";
  }

  function fitGraph() {
    const width = els.graphScroll.clientWidth - 24;
    const height = els.graphScroll.clientHeight - 24;
    zoom = Math.min(1, width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
    zoom = Math.max(0.42, zoom);
    applyZoom();
  }

  function bindGlobalEvents() {
    els.searchInput.addEventListener("input", () => {
      searchQuery = els.searchInput.value.trim().toLowerCase();
      applyFilters();
    });

    els.statusFilter.querySelectorAll(".segment").forEach((button) => {
      button.addEventListener("click", () => {
        els.statusFilter.querySelectorAll(".segment").forEach((item) => {
          item.classList.toggle("active", item === button);
        });
        statusFilter = button.dataset.status;
        applyFilters();
      });
    });

    els.resetButton.addEventListener("click", () => {
      if (window.confirm("确定清空所有复习标记吗？")) {
        reviewMap = {};
        saveReviewMap();
        refreshProgressUI();
        renderDetail();
        resetServerProgress();
      }
    });

    els.syncButton.addEventListener("click", openSyncModal);

    els.syncModal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-sync-modal]")) {
        closeSyncModal();
      }
    });

    els.zoomIn.addEventListener("click", () => {
      zoom = Math.min(1.3, zoom + 0.1);
      applyZoom();
    });
    els.zoomOut.addEventListener("click", () => {
      zoom = Math.max(0.42, zoom - 0.1);
      applyZoom();
    });
    els.fitGraph.addEventListener("click", fitGraph);

    els.pointModal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-point-modal]")) {
        closePointModal();
        return;
      }
      const toggle = event.target.closest("[data-point-toggle]");
      if (toggle) {
        const id = toggle.dataset.pointToggle;
        reviewMap[id] = !reviewMap[id];
        saveReviewMap();
        const found = findPointById(id);
        if (found) {
          renderPointModal(found);
        }
        refreshProgressUI();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!els.pointModal.hidden) {
          closePointModal();
        } else if (!els.syncModal.hidden) {
          closeSyncModal();
        }
      }
    });
  }

  async function init() {
    await loadInitialProgress();
    renderSidebar();
    renderMobileStrip();
    updateHeaderProgress();
    buildGraph();
    applyFilters();
    updateSelectedNodeClasses();
    updateGraphHint();
    renderDetail();
    renderIcons();
    startSyncPolling();
    bindGlobalEvents();
    requestAnimationFrame(() => {
      fitGraph();
      renderIcons();
    });
  }

  init();
})();
