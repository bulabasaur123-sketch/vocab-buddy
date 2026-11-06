'use strict';

/**
 * Wordloom Popup Controller
 * Manages capture form state, durable-first draft persistence, 1500ms bridge deadlines,
 * and serialized offline outbox queueing.
 */

const NATIVE_HOST = 'com.wordloom.bridge';
const NATIVE_DEADLINE_MS = 1500;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// DOM Elements
const form = document.getElementById('capture-form');
const inputWord = document.getElementById('input-word');
const inputExcerpt = document.getElementById('input-excerpt');
const inputTitle = document.getElementById('input-title');
const inputUrl = document.getElementById('input-url');
const inputNotes = document.getElementById('input-notes');
const btnClearExcerpt = document.getElementById('btn-clear-excerpt');
const btnClearSource = document.getElementById('btn-clear-source');
const btnDiscardDraft = document.getElementById('btn-discard-draft');
const btnSave = document.getElementById('btn-save');
const saveStatus = document.getElementById('save-status');
const draftBanner = document.getElementById('draft-banner');
const bridgeIndicator = document.getElementById('bridge-status-indicator');
const bridgeStatusText = document.getElementById('bridge-status-text');

let isBridgeAvailable = false;
let draftDebounceTimer = null;

function cleanUrl(href) {
  if (!href || typeof href !== 'string') return '';
  const trimmed = href.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.username = '';
    url.password = '';
    return url.toString().slice(0, 500);
  } catch {
    return '';
  }
}

function setBridgeStatus(available, label) {
  isBridgeAvailable = available;
  bridgeIndicator.classList.remove('checking', 'connected', 'offline');
  bridgeIndicator.classList.add(available ? 'connected' : 'offline');
  bridgeStatusText.textContent = label;
  bridgeIndicator.title = available
    ? 'Connected directly to Wordloom desktop library.'
    : 'Wordloom desktop offline. Saves queue locally and sync when opened.';
}

function checkBridgeConnection() {
  if (!chrome?.runtime?.sendNativeMessage) {
    setBridgeStatus(false, 'Offline (Outbox)');
    return;
  }

  try {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, { version: 1, probe: true }, response => {
      const err = chrome.runtime.lastError;
      if (err || !response || response.code === 'DB_UNAVAILABLE') {
        setBridgeStatus(false, 'Offline (Outbox)');
      } else {
        setBridgeStatus(true, 'Connected');
        // Trigger background outbox flush if connected
        chrome.runtime.sendMessage({ type: 'FLUSH_OUTBOX' }, () => {});
      }
    });
  } catch {
    setBridgeStatus(false, 'Offline (Outbox)');
  }
}

function extractFromActiveTab() {
  return new Promise(resolve => {
    if (!chrome?.tabs?.query) return resolve(null);

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const activeTab = tabs?.[0];
      if (!activeTab?.id) return resolve(null);

      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          files: ['content/captureScript.js']
        },
        results => {
          const err = chrome.runtime.lastError;
          if (err || !results?.[0]?.result) {
            resolve({
              word: '',
              sentenceExcerpt: '',
              sourceTitle: (activeTab.title || '').replace(/<[^>]*>/g, '').trim().slice(0, 200),
              sourceUrl: cleanUrl(activeTab.url || '')
            });
          } else {
            resolve(results[0].result);
          }
        }
      );
    });
  });
}

function scheduleDraftSave() {
  clearTimeout(draftDebounceTimer);
  draftDebounceTimer = setTimeout(async () => {
    const draft = {
      word: inputWord.value.trim(),
      sentenceExcerpt: inputExcerpt.value.trim(),
      sourceTitle: inputTitle.value.trim(),
      sourceUrl: cleanUrl(inputUrl.value.trim()),
      notes: inputNotes.value.trim(),
      updatedAt: Date.now()
    };

    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ capture_draft: draft });
    }
  }, 300);
}

async function discardDraft() {
  clearTimeout(draftDebounceTimer);
  if (chrome?.storage?.local) {
    await chrome.storage.local.remove('capture_draft');
  }
  draftBanner.classList.add('hidden');

  const capture = await extractFromActiveTab();
  if (capture) {
    inputWord.value = capture.word || '';
    inputExcerpt.value = capture.sentenceExcerpt || '';
    inputTitle.value = capture.sourceTitle || '';
    inputUrl.value = cleanUrl(capture.sourceUrl || '');
    inputNotes.value = '';
    if (inputWord.value) {
      inputExcerpt.focus();
    } else {
      inputWord.focus();
    }
  }
}

function sendNativeMessage(payload, timeoutMs = NATIVE_DEADLINE_MS) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendNativeMessage) {
      return reject(new Error('Native messaging not supported in this environment'));
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Native delivery timed out (${timeoutMs}ms deadline exceeded)`));
      }
    }, timeoutMs);

    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, response => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message || 'Host unavailable'));
        resolve(response);
      });
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(e);
      }
    }
  });
}

async function removeAcknowledgedOutboxItem(captureId) {
  if (!chrome?.storage?.local) return;
  const { outbox_queue = [] } = (await chrome.storage.local.get(['outbox_queue'])) || {};
  const remaining = outbox_queue.filter(item => item.id !== captureId);
  await chrome.storage.local.set({ outbox_queue: remaining });
  chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }, () => {});
}

async function handleSave(event) {
  if (event) event.preventDefault();

  const word = inputWord.value.trim();
  if (!word) {
    inputWord.focus();
    return;
  }

  btnSave.disabled = true;
  saveStatus.className = 'save-status';
  saveStatus.textContent = 'Recording…';

  const payload = {
    version: 1,
    id: `cap_${crypto.randomUUID().replace(/-/g, '')}`,
    word: word.toLowerCase(),
    sentenceExcerpt: inputExcerpt.value.trim().slice(0, 300),
    sourceTitle: inputTitle.value.trim().slice(0, 200),
    sourceUrl: cleanUrl(inputUrl.value.trim()),
    capturedAt: new Date().toISOString()
  };

  const notes = inputNotes.value.trim().slice(0, 2000);
  if (notes) payload.notes = notes;

  try {
    // 1. DURABLE-FIRST: Persist directly into local outbox queue before wire transit.
    // This ensures no capture is lost if the popup closes, times out, or crashes.
    if (chrome?.storage?.local) {
      const { outbox_queue = [] } = (await chrome.storage.local.get(['outbox_queue'])) || {};
      if (!outbox_queue.some(entry => entry.id === payload.id)) {
        outbox_queue.push(payload);
        await chrome.storage.local.set({ outbox_queue });
      }
      // Draft has been durably preserved; clear the input draft
      await chrome.storage.local.remove('capture_draft');
    }

    // 2. Deliver via bridge with 1500ms deadline
    let result = null;
    try {
      result = await sendNativeMessage(payload, NATIVE_DEADLINE_MS);
    } catch {
      // Bridge timeout or unavailable; capture remains in outbox
      result = null;
    }

    // 3. Process outcome
    if (result && result.status === 'success') {
      // Delivered: acknowledge and remove from outbox
      await removeAcknowledgedOutboxItem(payload.id);

      saveStatus.className = 'save-status success';
      if (result.isDuplicate) {
        saveStatus.textContent = `Added context to '${result.word}' (Box ${result.existingBox || 1}).`;
      } else {
        saveStatus.textContent = `Saved '${result.word}' to Wordloom.`;
      }

      setTimeout(() => { window.close(); }, 1200);
    } else if (result && result.code === 'INVALID_PAYLOAD') {
      // Non-retryable validation error: remove from outbox to prevent poison pill
      await removeAcknowledgedOutboxItem(payload.id);
      throw new Error(result.message || 'Invalid capture data');
    } else {
      // Transient error (ENRICHMENT_FAILED, DB_UNAVAILABLE, timeout, or closed host):
      // Capture remains safely in outbox_queue for future retry.
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }, () => {});
      }

      saveStatus.className = 'save-status warning';
      saveStatus.textContent = 'Saved locally in browser (Desktop offline / pending sync).';

      setTimeout(() => { window.close(); }, 1600);
    }
  } catch (error) {
    saveStatus.className = 'save-status error';
    saveStatus.textContent = error.message || 'Failed to save';
    btnSave.disabled = false;
  }
}

// Event Listeners
[inputWord, inputExcerpt, inputTitle, inputUrl, inputNotes].forEach(el => {
  el.addEventListener('input', scheduleDraftSave);
});

btnClearExcerpt.addEventListener('click', () => {
  inputExcerpt.value = '';
  scheduleDraftSave();
  inputExcerpt.focus();
});

btnClearSource.addEventListener('click', () => {
  inputTitle.value = '';
  inputUrl.value = '';
  scheduleDraftSave();
});

btnDiscardDraft.addEventListener('click', discardDraft);
form.addEventListener('submit', handleSave);

// Keyboard shortcuts: Ctrl+Enter or Cmd+Enter submits, Escape closes
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSave();
  } else if (e.key === 'Escape') {
    window.close();
  }
});

// Initialization
async function init() {
  checkBridgeConnection();

  let restoredFromDraft = false;
  if (chrome?.storage?.local) {
    const { capture_draft } = await chrome.storage.local.get(['capture_draft']);
    if (capture_draft && capture_draft.word && Date.now() - (capture_draft.updatedAt || 0) < DRAFT_MAX_AGE_MS) {
      inputWord.value = capture_draft.word || '';
      inputExcerpt.value = capture_draft.sentenceExcerpt || '';
      inputTitle.value = capture_draft.sourceTitle || '';
      inputUrl.value = cleanUrl(capture_draft.sourceUrl || '');
      inputNotes.value = capture_draft.notes || '';
      draftBanner.classList.remove('hidden');
      restoredFromDraft = true;
    }
  }

  if (!restoredFromDraft) {
    const capture = await extractFromActiveTab();
    if (capture) {
      inputWord.value = capture.word || '';
      inputExcerpt.value = capture.sentenceExcerpt || '';
      inputTitle.value = capture.sourceTitle || '';
      inputUrl.value = cleanUrl(capture.sourceUrl || '');
    }
  }

  if (inputWord.value) {
    inputExcerpt.focus();
  } else {
    inputWord.focus();
  }
}

document.addEventListener('DOMContentLoaded', init);
