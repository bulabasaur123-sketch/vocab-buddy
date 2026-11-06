'use strict';

/**
 * Wordloom Popup Controller
 * Manages capture form state, draft persistence, bridge communication, and offline outbox.
 */

const NATIVE_HOST = 'com.wordloom.bridge';
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

  // Probe bridge with a safe no-op or version check
  try {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, { version: 1, probe: true }, response => {
      const err = chrome.runtime.lastError;
      if (err || !response) {
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

      // Attempt script execution on active tab
      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          files: ['content/captureScript.js']
        },
        results => {
          const err = chrome.runtime.lastError;
          if (err || !results?.[0]?.result) {
            // Fallback: extract title and url directly from tab object
            resolve({
              word: '',
              sentenceExcerpt: '',
              sourceTitle: (activeTab.title || '').slice(0, 200),
              sourceUrl: (activeTab.url || '').slice(0, 500)
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
      sourceUrl: inputUrl.value.trim(),
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

  // Re-extract fresh from active tab
  const capture = await extractFromActiveTab();
  if (capture) {
    inputWord.value = capture.word || '';
    inputExcerpt.value = capture.sentenceExcerpt || '';
    inputTitle.value = capture.sourceTitle || '';
    inputUrl.value = capture.sourceUrl || '';
    inputNotes.value = '';
    if (inputWord.value) {
      inputExcerpt.focus();
    } else {
      inputWord.focus();
    }
  }
}

function sendNativeMessage(payload) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendNativeMessage) {
      return reject(new Error('Native messaging not supported in this environment'));
    }
    chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, response => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message || 'Host unavailable'));
      resolve(response);
    });
  });
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
  saveStatus.textContent = 'Saving capture…';

  const payload = {
    version: 1,
    id: `cap_${crypto.randomUUID().replace(/-/g, '')}`,
    word: word.toLowerCase(),
    sentenceExcerpt: inputExcerpt.value.trim(),
    sourceTitle: inputTitle.value.trim(),
    sourceUrl: inputUrl.value.trim(),
    capturedAt: new Date().toISOString()
  };

  const notes = inputNotes.value.trim();
  if (notes) payload.notes = notes;

  try {
    let result;
    try {
      result = await sendNativeMessage(payload);
    } catch {
      // Bridge unavailable: fallback to outbox queue
      result = null;
    }

    if (result && result.status === 'success') {
      if (result.isDuplicate) {
        saveStatus.className = 'save-status success';
        saveStatus.textContent = `Added context to '${result.word}' (Box ${result.existingBox || 1}).`;
      } else {
        saveStatus.className = 'save-status success';
        saveStatus.textContent = `Saved '${result.word}' to Wordloom.`;
      }
    } else if (result && result.status === 'error') {
      throw new Error(result.message || 'Capture failed');
    } else {
      // Offline fallback: store in local outbox
      const { outbox_queue = [] } = (await chrome.storage.local.get(['outbox_queue'])) || {};
      outbox_queue.push(payload);
      await chrome.storage.local.set({ outbox_queue });

      chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }, () => {});

      saveStatus.className = 'save-status warning';
      saveStatus.textContent = 'Saved locally in browser (Desktop offline).';
    }

    // Clear draft on successful or queued save
    if (chrome?.storage?.local) {
      await chrome.storage.local.remove('capture_draft');
    }

    setTimeout(() => {
      window.close();
    }, 1400);

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

// Keyboard shortcuts: Ctrl+Enter or Cmd+Enter submits
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
      inputUrl.value = capture_draft.sourceUrl || '';
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
      inputUrl.value = capture.sourceUrl || '';
    }
  }

  if (inputWord.value) {
    inputExcerpt.focus();
  } else {
    inputWord.focus();
  }
}

document.addEventListener('DOMContentLoaded', init);

