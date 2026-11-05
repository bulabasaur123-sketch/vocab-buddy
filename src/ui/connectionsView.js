'use strict';

/**
 * Vocab Buddy — Connections & Word Map View (FEAT-005)
 * Force-directed neighborhood graph & accessible companion list.
 */

const connectionsState = {
  centerWordId: null,
  centerWord: null,
  neighborhood: null, // { centerId, nodes: [], links: [] }
  viewMode: 'graph',  // 'graph' | 'list'

  // Simulation & rendering
  simNodes: [],
  simLinks: [],
  panX: 0,
  panY: 0,
  zoom: 1.0,
  isDraggingCanvas: false,
  dragStartX: 0,
  dragStartY: 0,
  panStartX: 0,
  panStartY: 0,
  draggedNode: null,
  hoveredNode: null,
  hasDragged: false,
  animId: null,
  stepCount: 0,
  isSettled: false
};

// ==========================================================================
// Initialization & Event Wiring
// ==========================================================================

function initConnectionsView() {
  const wordSelect = document.getElementById('connection-word-select');
  if (wordSelect) {
    wordSelect.addEventListener('change', (e) => {
      const wordId = e.target.value;
      if (wordId) {
        loadConnectionsForWord(wordId);
      } else {
        connectionsState.centerWordId = null;
        connectionsState.centerWord = null;
        connectionsState.neighborhood = null;
        renderConnectionsUI();
      }
    });
  }

  const modeGraphBtn = document.getElementById('map-mode-graph');
  const modeListBtn = document.getElementById('map-mode-list');
  if (modeGraphBtn) {
    modeGraphBtn.addEventListener('click', () => setConnectionsViewMode('graph'));
  }
  if (modeListBtn) {
    modeListBtn.addEventListener('click', () => setConnectionsViewMode('list'));
  }

  const btnFit = document.getElementById('map-btn-fit');
  if (btnFit) {
    btnFit.addEventListener('click', fitConnectionsView);
  }

  const btnZoomIn = document.getElementById('map-btn-zoom-in');
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => zoomConnections(1.25));
  }

  const btnZoomOut = document.getElementById('map-btn-zoom-out');
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => zoomConnections(1 / 1.25));
  }

  const btnFullscreen = document.getElementById('map-btn-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (typeof toggleFullScreen === 'function') toggleFullScreen();
    });
  }

  setupConnectionsCanvas();
  setupModalAssociationForm();
}

function setConnectionsViewMode(mode) {
  connectionsState.viewMode = mode;
  const isGraph = mode === 'graph';

  const modeGraphBtn = document.getElementById('map-mode-graph');
  const modeListBtn = document.getElementById('map-mode-list');
  if (modeGraphBtn) {
    modeGraphBtn.classList.toggle('active', isGraph);
    modeGraphBtn.setAttribute('aria-pressed', String(isGraph));
  }
  if (modeListBtn) {
    modeListBtn.classList.toggle('active', !isGraph);
    modeListBtn.setAttribute('aria-pressed', String(!isGraph));
  }

  const canvasContainer = document.getElementById('connections-canvas-container');
  const companionList = document.getElementById('connections-companion-list');

  if (connectionsState.centerWordId) {
    if (canvasContainer) canvasContainer.classList.toggle('hidden', !isGraph);
    if (companionList) companionList.classList.toggle('hidden', isGraph);
    if (!isGraph) {
      renderCompanionList();
    } else {
      resizeConnectionsCanvas();
      startSimulation();
    }
  }
}

// ==========================================================================
// Loading & View Rendering
// ==========================================================================

async function renderConnectionsView() {
  populateConnectionsWordSelect();

  if (!connectionsState.centerWordId) {
    if (typeof state !== 'undefined' && state.selectedWord?.id) {
      connectionsState.centerWordId = state.selectedWord.id;
    } else if (typeof state !== 'undefined' && state.words && state.words.length > 0) {
      connectionsState.centerWordId = state.words[0].id;
    }
  }

  if (connectionsState.centerWordId) {
    const wordSelect = document.getElementById('connection-word-select');
    if (wordSelect) wordSelect.value = connectionsState.centerWordId;
    await loadConnectionsForWord(connectionsState.centerWordId);
  } else {
    renderConnectionsUI();
  }
}

function populateConnectionsWordSelect() {
  const wordSelect = document.getElementById('connection-word-select');
  if (!wordSelect || typeof state === 'undefined' || !state.words) return;

  const currentVal = wordSelect.value || connectionsState.centerWordId || '';
  wordSelect.replaceChildren();

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Select a word to explore...';
  wordSelect.appendChild(defaultOpt);

  const sortedWords = [...state.words].sort((a, b) =>
    (a.displayWord || a.word).localeCompare(b.displayWord || b.word)
  );

  for (const word of sortedWords) {
    const opt = document.createElement('option');
    opt.value = word.id;
    opt.textContent = word.displayWord || word.word;
    wordSelect.appendChild(opt);
  }

  if (currentVal && sortedWords.some(w => w.id === currentVal)) {
    wordSelect.value = currentVal;
  }
}

async function loadConnectionsForWord(wordId) {
  if (!wordId || !window.vocabAPI || !window.vocabAPI.getConnectionsNeighborhood) return;

  try {
    const neighborhood = await window.vocabAPI.getConnectionsNeighborhood(wordId, 15);
    connectionsState.centerWordId = wordId;
    connectionsState.centerWord = (typeof state !== 'undefined' && state.words)
      ? state.words.find(w => w.id === wordId) || null
      : null;
    connectionsState.neighborhood = neighborhood;

    const wordSelect = document.getElementById('connection-word-select');
    if (wordSelect && wordSelect.value !== wordId) {
      wordSelect.value = wordId;
    }

    buildSimulationGraph(neighborhood);
    renderConnectionsUI();

    if (connectionsState.viewMode === 'list') {
      renderCompanionList();
    } else {
      fitConnectionsView();
      startSimulation();
    }
  } catch (err) {
    if (typeof announce === 'function') {
      announce('Could not load connections for this word.', true);
    }
  }
}

function renderConnectionsUI() {
  const promptEl = document.getElementById('connections-prompt');
  const canvasContainer = document.getElementById('connections-canvas-container');
  const companionList = document.getElementById('connections-companion-list');

  const hasCenter = Boolean(connectionsState.centerWordId && connectionsState.neighborhood);

  if (promptEl) promptEl.classList.toggle('hidden', hasCenter);

  if (!hasCenter) {
    if (canvasContainer) canvasContainer.classList.add('hidden');
    if (companionList) companionList.classList.add('hidden');
    stopSimulation();
    return;
  }

  if (connectionsState.viewMode === 'graph') {
    if (canvasContainer) canvasContainer.classList.remove('hidden');
    if (companionList) companionList.classList.add('hidden');
  } else {
    if (canvasContainer) canvasContainer.classList.add('hidden');
    if (companionList) companionList.classList.remove('hidden');
  }
}

// ==========================================================================
// Force-Directed Graph Simulation
// ==========================================================================

function buildSimulationGraph(graphData) {
  if (!graphData || !graphData.nodes) {
    connectionsState.simNodes = [];
    connectionsState.simLinks = [];
    return;
  }

  const nodes = [];
  const nodeMap = new Map();
  const count = graphData.nodes.length;

  graphData.nodes.forEach((rawNode, index) => {
    const isCenter = rawNode.id === graphData.centerId;
    let radius = 22;
    let width = 60;
    let height = 28;

    if (isCenter) {
      radius = 34;
      width = 80;
      height = 40;
    } else if (rawNode.type === 'word') {
      radius = 24;
      width = 64;
      height = 32;
    } else {
      // Hub nodes (source, tag, shelf)
      radius = 20;
      const labelLen = (rawNode.label || '').length;
      width = Math.max(68, labelLen * 7.5 + 32);
      height = 26;
    }

    // Initial radial layout around origin
    let initialX = 0;
    let initialY = 0;
    if (!isCenter && count > 1) {
      const angle = ((index - 1) / (count - 1)) * (Math.PI * 2) - (Math.PI / 2);
      const dist = rawNode.type === 'word' ? 140 : 170;
      initialX = Math.cos(angle) * dist + (Math.random() - 0.5) * 10;
      initialY = Math.sin(angle) * dist + (Math.random() - 0.5) * 10;
    }

    const simNode = {
      id: rawNode.id,
      type: rawNode.type,
      label: rawNode.label,
      isCenter,
      x: initialX,
      y: initialY,
      vx: 0,
      vy: 0,
      radius,
      width,
      height,
      totalCount: rawNode.totalCount || rawNode.data?.memberCount || 0,
      sampleWords: rawNode.sampleWords || [],
      raw: rawNode
    };

    nodes.push(simNode);
    nodeMap.set(simNode.id, simNode);
  });

  const links = [];
  (graphData.links || []).forEach(rawLink => {
    const sourceNode = nodeMap.get(rawLink.source);
    const targetNode = nodeMap.get(rawLink.target);
    if (sourceNode && targetNode) {
      links.push({
        source: rawLink.source,
        target: rawLink.target,
        sourceNode,
        targetNode,
        type: rawLink.type,
        note: rawLink.note || ''
      });
    }
  });

  connectionsState.simNodes = nodes;
  connectionsState.simLinks = links;
  connectionsState.stepCount = 0;
  connectionsState.isSettled = false;
}

function stepSimulation() {
  const nodes = connectionsState.simNodes;
  const links = connectionsState.simLinks;
  if (!nodes || nodes.length <= 1) {
    connectionsState.isSettled = true;
    return;
  }

  const repulsionK = 6500;
  const springK = 0.045;
  const gravity = 0.02;
  const damping = 0.82;

  // 1. Coulomb Repulsion between all pairs
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const n2 = nodes[j];
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const distSq = dx * dx + dy * dy + 1;
      const dist = Math.sqrt(distSq);

      if (dist < 400) {
        const force = repulsionK / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (n1 !== connectionsState.draggedNode && !n1.isCenter) {
          n1.vx -= fx;
          n1.vy -= fy;
        }
        if (n2 !== connectionsState.draggedNode && !n2.isCenter) {
          n2.vx += fx;
          n2.vy += fy;
        }
      }
    }
  }

  // 2. Spring Hooke forces along links
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const s = link.sourceNode;
    const t = link.targetNode;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
    const targetDist = link.type === 'association' ? 125 : 155;
    const force = (dist - targetDist) * springK;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (s !== connectionsState.draggedNode && !s.isCenter) {
      s.vx += fx;
      s.vy += fy;
    }
    if (t !== connectionsState.draggedNode && !t.isCenter) {
      t.vx -= fx;
      t.vy -= fy;
    }
  }

  // 3. Weak centering gravity & integration
  let totalKineticEnergy = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node === connectionsState.draggedNode) continue;

    if (node.isCenter) {
      // Center node gently drifts towards (0, 0)
      node.vx = (node.vx - node.x * 0.08) * 0.65;
      node.vy = (node.vy - node.y * 0.08) * 0.65;
      node.x += node.vx;
      node.y += node.vy;
      continue;
    }

    node.vx = (node.vx - node.x * gravity) * damping;
    node.vy = (node.vy - node.y * gravity) * damping;

    node.x += node.vx;
    node.y += node.vy;

    totalKineticEnergy += node.vx * node.vx + node.vy * node.vy;
  }

  connectionsState.stepCount++;

  // Anti-slop check: Halts when settled to ensure ZERO background CPU loop!
  if (totalKineticEnergy < 0.005 || connectionsState.stepCount > 180) {
    connectionsState.isSettled = true;
    stopSimulation();
    drawConnectionsCanvas();
  }
}

function startSimulation() {
  stopSimulation();
  connectionsState.isSettled = false;
  connectionsState.stepCount = 0;

  function loop() {
    stepSimulation();
    drawConnectionsCanvas();
    if (!connectionsState.isSettled) {
      connectionsState.animId = requestAnimationFrame(loop);
    }
  }
  connectionsState.animId = requestAnimationFrame(loop);
}

function stopSimulation() {
  if (connectionsState.animId) {
    cancelAnimationFrame(connectionsState.animId);
    connectionsState.animId = null;
  }
}

// ==========================================================================
// Canvas Rendering Engine (Theme-aware, HiDPI)
// ==========================================================================

function setupConnectionsCanvas() {
  const canvas = document.getElementById('connections-canvas');
  const container = document.getElementById('connections-canvas-container');
  if (!canvas || !container) return;

  // ResizeObserver for responsive canvas updates
  const ro = new ResizeObserver(() => {
    resizeConnectionsCanvas();
    drawConnectionsCanvas();
  });
  ro.observe(container);

  // Mouse / Pointer Interaction Listeners
  canvas.addEventListener('mousedown', onCanvasMouseDown);
  window.addEventListener('mousemove', onCanvasMouseMove);
  window.addEventListener('mouseup', onCanvasMouseUp);
  canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
  canvas.addEventListener('mouseleave', () => {
    hideTooltip();
    if (connectionsState.hoveredNode) {
      connectionsState.hoveredNode = null;
      drawConnectionsCanvas();
    }
  });
}

function resizeConnectionsCanvas() {
  const canvas = document.getElementById('connections-canvas');
  const container = document.getElementById('connections-canvas-container');
  if (!canvas || !container) return;

  const rect = container.getBoundingClientRect();
  const width = Math.max(300, Math.floor(rect.width));
  const height = Math.max(300, Math.floor(rect.height || 520));

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fitConnectionsView() {
  connectionsState.panX = 0;
  connectionsState.panY = 0;
  connectionsState.zoom = 1.0;
  drawConnectionsCanvas();
}

function zoomConnections(factor) {
  const newZoom = Math.max(0.4, Math.min(2.5, connectionsState.zoom * factor));
  connectionsState.zoom = newZoom;
  drawConnectionsCanvas();
}

function drawConnectionsCanvas() {
  const canvas = document.getElementById('connections-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (width === 0 || height === 0) return;

  const isDark = document.body.classList.contains('theme-dark');

  // Clear canvas
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Transform coordinates: origin at center + pan & zoom
  ctx.translate(width / 2 + connectionsState.panX, height / 2 + connectionsState.panY);
  ctx.scale(connectionsState.zoom, connectionsState.zoom);

  const hovered = connectionsState.hoveredNode;
  const links = connectionsState.simLinks;
  const nodes = connectionsState.simNodes;

  // 1. Draw Links
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const s = link.sourceNode;
    const t = link.targetNode;
    const isLinkedToHovered = hovered && (hovered === s || hovered === t);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);

    if (link.type === 'association') {
      ctx.lineWidth = isLinkedToHovered ? 2.5 : 1.8;
      ctx.strokeStyle = isDark
        ? (isLinkedToHovered ? '#E5A7B1' : 'rgba(229, 167, 177, 0.45)')
        : (isLinkedToHovered ? '#852B3B' : 'rgba(133, 43, 59, 0.45)');
      if (link.note) {
        ctx.setLineDash([4, 3]);
      }
    } else {
      ctx.lineWidth = isLinkedToHovered ? 2.0 : 1.2;
      ctx.strokeStyle = isDark
        ? (isLinkedToHovered ? '#ADA99F' : 'rgba(120, 122, 128, 0.35)')
        : (isLinkedToHovered ? '#686760' : 'rgba(139, 133, 123, 0.38)');
    }

    ctx.stroke();
    ctx.restore();

    // If association has note, draw a small midpoint dot
    if (link.type === 'association' && link.note) {
      const midX = (s.x + t.x) / 2;
      const midY = (s.y + t.y) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(midX, midY, 3, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#E5A7B1' : '#852B3B';
      ctx.fill();
      ctx.restore();
    }
  }

  // 2. Draw Nodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isHovered = hovered === node;
    const isCenter = node.isCenter;

    ctx.save();
    ctx.translate(node.x, node.y);

    if (isCenter) {
      // Center Word Node
      const r = node.radius;

      // Outer gentle pulse/halo ring
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(229, 167, 177, 0.18)' : 'rgba(133, 43, 59, 0.12)';
      ctx.fill();

      // Main circle
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#E5A7B1' : '#852B3B';
      ctx.fill();
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.strokeStyle = isDark ? '#F2C8D0' : '#6A222F';
      ctx.stroke();

      // Label text
      ctx.fillStyle = isDark ? '#141517' : '#FFFFFF';
      ctx.font = '600 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = truncateText(node.label, 14);
      ctx.fillText(label, 0, 0);

    } else if (node.type === 'word') {
      // Personal Association Node
      const r = node.radius;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#2D1E24' : '#F6ECEE';
      ctx.fill();
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.strokeStyle = isDark ? '#E5A7B1' : '#852B3B';
      ctx.stroke();

      ctx.fillStyle = isDark ? '#F7F4EB' : '#2A2723';
      ctx.font = '500 12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = truncateText(node.label, 12);
      ctx.fillText(label, 0, 0);

    } else {
      // Hub Nodes (source, tag, shelf) - Pill shape
      const w = node.width;
      const h = node.height;
      const x = -w / 2;
      const y = -h / 2;
      const r = h / 2;

      ctx.beginPath();
      drawRoundedRect(ctx, x, y, w, h, r);

      if (isDark) {
        ctx.fillStyle = isHovered ? '#26292E' : '#1C1E22';
        ctx.strokeStyle = isHovered ? '#ADA99F' : '#787A80';
      } else {
        ctx.fillStyle = isHovered ? '#F0EBE1' : '#EAE4D7';
        ctx.strokeStyle = isHovered ? '#686760' : '#8B857B';
      }

      ctx.fill();
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();

      // Icon & Label inside pill
      let icon = '';
      if (node.type === 'source') icon = '📖 ';
      else if (node.type === 'tag') icon = '#';
      else if (node.type === 'shelf') icon = '☵ ';

      ctx.fillStyle = isDark ? '#ADA99F' : '#2A2723';
      ctx.font = '500 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const fullText = `${icon}${node.label} (${node.totalCount})`;
      const truncated = truncateText(fullText, 22);
      ctx.fillText(truncated, 0, 0);
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function truncateText(text, maxChars) {
  if (!text) return '';
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

// ==========================================================================
// Canvas Hit Testing & Pointer Interaction
// ==========================================================================

function getCanvasWorldCoords(e) {
  const canvas = document.getElementById('connections-canvas');
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  const worldX = (screenX - rect.width / 2 - connectionsState.panX) / connectionsState.zoom;
  const worldY = (screenY - rect.height / 2 - connectionsState.panY) / connectionsState.zoom;
  return { x: worldX, y: worldY, screenX, screenY };
}

function hitTestNode(worldX, worldY) {
  const nodes = connectionsState.simNodes;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.isCenter || node.type === 'word') {
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      if (dx * dx + dy * dy <= node.radius * node.radius) {
        return node;
      }
    } else {
      // Pill bounding box
      const halfW = node.width / 2;
      const halfH = node.height / 2;
      if (
        worldX >= node.x - halfW &&
        worldX <= node.x + halfW &&
        worldY >= node.y - halfH &&
        worldY <= node.y + halfH
      ) {
        return node;
      }
    }
  }
  return null;
}

function onCanvasMouseDown(e) {
  if (e.button !== 0) return; // Only left click
  const { x, y } = getCanvasWorldCoords(e);
  const hit = hitTestNode(x, y);

  if (hit) {
    connectionsState.draggedNode = hit;
    connectionsState.hasDragged = false;
    startSimulation(); // Wake simulation during drag
  } else {
    connectionsState.isDraggingCanvas = true;
    connectionsState.dragStartX = e.clientX;
    connectionsState.dragStartY = e.clientY;
    connectionsState.panStartX = connectionsState.panX;
    connectionsState.panStartY = connectionsState.panY;
    const canvas = document.getElementById('connections-canvas');
    if (canvas) canvas.style.cursor = 'grabbing';
  }
}

function onCanvasMouseMove(e) {
  const canvas = document.getElementById('connections-canvas');
  if (!canvas) return;

  if (connectionsState.draggedNode) {
    const { x, y } = getCanvasWorldCoords(e);
    const node = connectionsState.draggedNode;
    const moveDist = Math.hypot(x - node.x, y - node.y);
    if (moveDist > 3) connectionsState.hasDragged = true;

    node.x = x;
    node.y = y;
    node.vx = 0;
    node.vy = 0;
    hideTooltip();
    startSimulation();
    return;
  }

  if (connectionsState.isDraggingCanvas) {
    const dx = e.clientX - connectionsState.dragStartX;
    const dy = e.clientY - connectionsState.dragStartY;
    connectionsState.panX = connectionsState.panStartX + dx;
    connectionsState.panY = connectionsState.panStartY + dy;
    hideTooltip();
    drawConnectionsCanvas();
    return;
  }

  // Hover detection
  const { x, y, screenX, screenY } = getCanvasWorldCoords(e);
  const hit = hitTestNode(x, y);

  if (hit !== connectionsState.hoveredNode) {
    connectionsState.hoveredNode = hit;
    canvas.style.cursor = hit ? 'pointer' : 'grab';
    drawConnectionsCanvas();
  }

  if (hit) {
    showTooltip(hit, screenX, screenY);
  } else {
    hideTooltip();
  }
}

function onCanvasMouseUp(e) {
  const canvas = document.getElementById('connections-canvas');
  if (canvas) canvas.style.cursor = connectionsState.hoveredNode ? 'pointer' : 'grab';

  if (connectionsState.draggedNode) {
    const clickedNode = connectionsState.draggedNode;
    const wasDrag = connectionsState.hasDragged;
    connectionsState.draggedNode = null;

    if (!wasDrag) {
      handleNodeClick(clickedNode);
    }
  }

  connectionsState.isDraggingCanvas = false;
}

function onCanvasWheel(e) {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  zoomConnections(zoomFactor);
}

function handleNodeClick(node) {
  if (node.isCenter) {
    // Open detail modal for the centered word
    if (connectionsState.centerWord && typeof openDetailModal === 'function') {
      openDetailModal(connectionsState.centerWord);
    }
  } else if (node.type === 'word') {
    // Re-center connection map around this associated word
    loadConnectionsForWord(node.id);
  } else {
    // Hub node clicked: show info or jump to companion section
    setConnectionsViewMode('list');
  }
}

// Tooltip display
function showTooltip(node, screenX, screenY) {
  const tooltip = document.getElementById('map-tooltip');
  if (!tooltip) return;

  let title = escapeHtml(node.label);
  let subtitle = '';

  if (node.isCenter) {
    const sourceCite = connectionsState.centerWord?.bookSource
      ? `from ${escapeHtml(connectionsState.centerWord.bookSource)}`
      : 'personal lexicon';
    subtitle = `Center word · ${sourceCite}<br><em>Click to view full detail</em>`;
  } else if (node.type === 'word') {
    const assocLink = connectionsState.simLinks.find(
      l => l.type === 'association' && (l.target === node.id || l.source === node.id)
    );
    const noteText = assocLink?.note ? `“${escapeHtml(assocLink.note)}”` : 'Personal connection';
    subtitle = `Mutual association · ${noteText}<br><em>Click to re-center map</em>`;
  } else if (node.type === 'source') {
    subtitle = `Reading provenance · ${node.totalCount} ${node.totalCount === 1 ? 'word' : 'words'} recorded`;
  } else if (node.type === 'tag') {
    subtitle = `Thematic tag · ${node.totalCount} ${node.totalCount === 1 ? 'word' : 'words'} tagged`;
  } else if (node.type === 'shelf') {
    subtitle = `Shelf curation · ${node.totalCount} ${node.totalCount === 1 ? 'word' : 'words'} assigned`;
  }

  tooltip.innerHTML = `<p class="tooltip-title">${title}</p><p class="tooltip-sub">${subtitle}</p>`;
  tooltip.style.left = `${screenX}px`;
  tooltip.style.top = `${screenY - 14}px`;
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  if (tooltip) tooltip.classList.add('hidden');
}

// ==========================================================================
// Companion List View (Semantic Breakdown)
// ==========================================================================

function renderCompanionList() {
  const centerCard = document.getElementById('companion-center-card');
  const sourcesList = document.getElementById('companion-sources-list');
  const tagsList = document.getElementById('companion-tags-list');
  const shelvesList = document.getElementById('companion-shelves-list');
  const assocsList = document.getElementById('companion-associations-list');

  const neighborhood = connectionsState.neighborhood;
  const centerWord = connectionsState.centerWord;

  if (!neighborhood || !centerWord) return;

  // 1. Center Word Card
  if (centerCard) {
    const meaning = centerWord.meanings?.[0];
    const pos = meaning?.partOfSpeech ? `[${escapeHtml(meaning.partOfSpeech)}]` : '';
    const def = meaning?.definitions?.[0]?.definition || 'No definition recorded.';
    const sourceCite = centerWord.bookSource ? `Citation source: ${escapeHtml(centerWord.bookSource)}` : '';

    centerCard.innerHTML = `
      <div class="companion-center-header">
        <h2 class="companion-center-word">${escapeHtml(centerWord.displayWord || centerWord.word)}</h2>
        <span class="phonetic-mono">${escapeHtml(centerWord.phonetic || '')}</span>
      </div>
      <p class="companion-center-def">${pos} ${escapeHtml(def)}</p>
      ${sourceCite ? `<p class="companion-center-source">${sourceCite}</p>` : ''}
      <button type="button" class="btn-subtle companion-btn-open" id="companion-btn-open-detail">
        Open Word Detail
      </button>
    `;

    const openBtn = centerCard.querySelector('#companion-btn-open-detail');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (typeof openDetailModal === 'function') openDetailModal(centerWord);
      });
    }
  }

  // 2. Reading Provenance Hub
  if (sourcesList) {
    sourcesList.replaceChildren();
    const sourceHub = neighborhood.nodes.find(n => n.type === 'source');
    if (sourceHub) {
      const card = document.createElement('div');
      card.className = 'companion-card';
      const sampleNames = (sourceHub.sampleWords || [])
        .map(s => escapeHtml(s.displayWord || s.word))
        .join(', ');
      card.innerHTML = `
        <h4 class="companion-item-title">📖 ${escapeHtml(sourceHub.label)}</h4>
        <p class="companion-item-meta">${sourceHub.totalCount} ${sourceHub.totalCount === 1 ? 'word' : 'words'} from this book in your lexicon</p>
        ${sampleNames ? `<p class="companion-item-samples">Sample words: ${sampleNames}</p>` : ''}
      `;
      sourcesList.appendChild(card);
    } else {
      sourcesList.innerHTML = '<p class="text-secondary" style="font-size: 0.85rem;">No reading source citation recorded for this word.</p>';
    }
  }

  // 3. Thematic Tags Hub
  if (tagsList) {
    tagsList.replaceChildren();
    const tagHubs = neighborhood.nodes.filter(n => n.type === 'tag');
    if (tagHubs.length > 0) {
      for (const hub of tagHubs) {
        const chip = document.createElement('div');
        chip.className = 'companion-card';
        const sampleNames = (hub.sampleWords || [])
          .map(s => escapeHtml(s.displayWord || s.word))
          .join(', ');
        chip.innerHTML = `
          <h4 class="companion-item-title">#${escapeHtml(hub.label.replace(/^#+/, ''))}</h4>
          <p class="companion-item-meta">${hub.totalCount} words with this tag</p>
          ${sampleNames ? `<p class="companion-item-samples">Sample words: ${sampleNames}</p>` : ''}
        `;
        tagsList.appendChild(chip);
      }
    } else {
      tagsList.innerHTML = '<p class="text-secondary" style="font-size: 0.85rem;">No thematic tags assigned to this entry.</p>';
    }
  }

  // 4. Shelves Hub
  if (shelvesList) {
    shelvesList.replaceChildren();
    const shelfHubs = neighborhood.nodes.filter(n => n.type === 'shelf');
    if (shelfHubs.length > 0) {
      for (const hub of shelfHubs) {
        const item = document.createElement('div');
        item.className = 'companion-card';
        const sampleNames = (hub.sampleWords || [])
          .map(s => escapeHtml(s.displayWord || s.word))
          .join(', ');
        item.innerHTML = `
          <h4 class="companion-item-title">☵ ${escapeHtml(hub.label)}</h4>
          <p class="companion-item-meta">${hub.totalCount} words curated on this shelf</p>
          ${sampleNames ? `<p class="companion-item-samples">Sample words: ${sampleNames}</p>` : ''}
        `;
        shelvesList.appendChild(item);
      }
    } else {
      shelvesList.innerHTML = '<p class="text-secondary" style="font-size: 0.85rem;">Not added to any shelves yet.</p>';
    }
  }

  // 5. Personal Associations
  if (assocsList) {
    assocsList.replaceChildren();
    const assocNodes = neighborhood.nodes.filter(n => n.type === 'word' && n.id !== neighborhood.centerId);

    if (assocNodes.length > 0) {
      for (const assoc of assocNodes) {
        const link = neighborhood.links.find(
          l => l.type === 'association' && (l.target === assoc.id || l.source === assoc.id)
        );
        const card = document.createElement('div');
        card.className = 'companion-card assoc-card';
        card.innerHTML = `
          <div class="assoc-card-row">
            <button type="button" class="assoc-word-btn" title="Explore connections for ${escapeHtml(assoc.label)}">
              ${escapeHtml(assoc.label)}
            </button>
            <button type="button" class="chip-remove-btn" title="Remove association" aria-label="Remove association">&times;</button>
          </div>
          ${link?.note ? `<p class="assoc-card-note">“${escapeHtml(link.note)}”</p>` : ''}
        `;

        card.querySelector('.assoc-word-btn').addEventListener('click', () => {
          loadConnectionsForWord(assoc.id);
        });

        card.querySelector('.chip-remove-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (window.vocabAPI && window.vocabAPI.removeAssociation) {
            await window.vocabAPI.removeAssociation(neighborhood.centerId, assoc.id);
            await loadConnectionsForWord(neighborhood.centerId);
          }
        });

        assocsList.appendChild(card);
      }
    } else {
      assocsList.innerHTML = '<p class="text-secondary" style="font-size: 0.85rem;">No personal associations created yet. Connect words in the Word Detail panel.</p>';
    }
  }
}

// ==========================================================================
// Word Detail Modal: Personal Associations
// ==========================================================================

async function renderModalAssociations(word) {
  const container = document.getElementById('modal-associations-list');
  const selectEl = document.getElementById('modal-assoc-word-select');
  if (!container || !word || !window.vocabAPI || !window.vocabAPI.getAssociations) return;

  container.replaceChildren();

  try {
    const associations = await window.vocabAPI.getAssociations(word.id);

    if (!associations || associations.length === 0) {
      container.innerHTML = '<span class="text-secondary" style="font-size: 0.8rem;">No personal associations created yet.</span>';
    } else {
      for (const assoc of associations) {
        const chip = document.createElement('span');
        chip.className = 'text-chip assoc-chip';
        const noteSpan = assoc.note ? `<span class="assoc-note">(${escapeHtml(assoc.note)})</span>` : '';
        chip.innerHTML = `
          <strong class="assoc-word-name">${escapeHtml(assoc.displayWord)}</strong> ${noteSpan}
          <button type="button" class="chip-remove-btn" title="Remove association" aria-label="Remove association with ${escapeHtml(assoc.displayWord)}">&times;</button>
        `;

        chip.querySelector('.chip-remove-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await window.vocabAPI.removeAssociation(word.id, assoc.associatedWordId);
            await renderModalAssociations(word);
            if (connectionsState.centerWordId === word.id) {
              await loadConnectionsForWord(word.id);
            }
          } catch {
            if (typeof announce === 'function') announce('Could not remove this association.', true);
          }
        });

        container.appendChild(chip);
      }
    }

    // Populate Add Dropdown with remaining words
    if (selectEl && typeof state !== 'undefined' && state.words) {
      const associatedIds = new Set(associations.map(a => a.associatedWordId));
      selectEl.replaceChildren();

      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '+ Associate with word...';
      selectEl.appendChild(defaultOpt);

      const availableWords = state.words
        .filter(w => w.id !== word.id && !associatedIds.has(w.id))
        .sort((a, b) => (a.displayWord || a.word).localeCompare(b.displayWord || b.word));

      for (const w of availableWords) {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.displayWord || w.word;
        selectEl.appendChild(opt);
      }
    }
  } catch (err) {
    container.innerHTML = '<span class="text-secondary" style="font-size: 0.8rem;">Could not load associations.</span>';
  }
}

function setupModalAssociationForm() {
  const form = document.getElementById('modal-association-form');
  const selectEl = document.getElementById('modal-assoc-word-select');
  const noteInput = document.getElementById('modal-assoc-note-input');

  if (!form || !selectEl || !noteInput) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentWord = typeof state !== 'undefined' ? state.selectedWord : null;
    const targetWordId = selectEl.value;
    const note = noteInput.value.trim();

    if (!currentWord || !targetWordId) return;

    try {
      await window.vocabAPI.addAssociation(currentWord.id, targetWordId, note);
      noteInput.value = '';
      selectEl.value = '';
      await renderModalAssociations(currentWord);

      if (connectionsState.centerWordId === currentWord.id || connectionsState.centerWordId === targetWordId) {
        await loadConnectionsForWord(connectionsState.centerWordId);
      }
    } catch {
      if (typeof announce === 'function') {
        announce('Could not save this association. Try again.', true);
      }
    }
  });
}

window.resizeConnectionsCanvas = resizeConnectionsCanvas;
window.drawConnectionsCanvas = drawConnectionsCanvas;
window.fitConnectionsView = fitConnectionsView;


