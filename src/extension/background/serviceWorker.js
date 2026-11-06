'use strict';

/**
 * Wordloom Background Service Worker (Manifest V3)
 * Authoritative owner of outbox queue mutations, context menu capture,
 * 1500ms delivery deadlines, and serialized outbox synchronization.
 */

const NATIVE_HOST = 'com.wordloom.bridge';
const NATIVE_DEADLINE_MS = 1500;

let isFlushing = false;
let queueMutationPromise = Promise.resolve();

/**
 * Serializes all queue mutations through a promise chain to prevent race conditions
 * and detached-snapshot overwrites between concurrent popup saves and background flushes.
 */
function mutateQueue(fn) {
  const next = queueMutationPromise.then(async () => {
    const data = await chrome.storage.local.get(['outbox_queue']);
    const currentQueue = Array.isArray(data?.outbox_queue) ? JSON.parse(JSON.stringify(data.outbox_queue)) : [];
    const updated = await fn(currentQueue);
    if (updated !== undefined) {
      await chrome.storage.local.set({ outbox_queue: updated });
    }
    await refreshBadge();
    return updated;
  });

  queueMutationPromise = next.catch(err => {
    console.error('Wordloom outbox mutation error:', err);
  });

  return next;
}

function enqueueItem(payload) {
  return mutateQueue(queue => {
    if (!queue.some(entry => entry.id === payload.id)) {
      return [...queue, payload];
    }
    return queue;
  });
}

function dequeueItem(captureId) {
  return mutateQueue(queue => {
    return queue.filter(entry => entry.id !== captureId);
  });
}

function sendNativeMessage(payload, timeoutMs = NATIVE_DEADLINE_MS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Native message delivery timed out (${timeoutMs}ms deadline exceeded)`));
      }
    }, timeoutMs);

    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, response => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message || 'Native host unavailable'));
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

async function refreshBadge() {
  try {
    const { outbox_queue = [] } = (await chrome.storage.local.get(['outbox_queue'])) || {};
    const count = outbox_queue.length;
    if (chrome?.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    }
  } catch {
    // Non-fatal badge update
  }
}

async function flushOutbox() {
  if (isFlushing) {
    const { outbox_queue = [] } = (await chrome.storage.local.get(['outbox_queue'])) || {};
    return { flushing: true, remaining: outbox_queue.length };
  }

  isFlushing = true;
  let flushedCount = 0;

  try {
    while (true) {
      // Safely inspect the current head of the queue through the mutation serializer
      let currentItem = null;
      await mutateQueue(queue => {
        if (queue.length > 0) currentItem = queue[0];
        return undefined; // Read-only inspection
      });

      if (!currentItem) break;

      let res;
      try {
        res = await sendNativeMessage(currentItem);
      } catch {
        // Native host unavailable or deadline timed out: pause flush
        break;
      }

      if (res && res.status === 'success') {
        flushedCount++;
        // Remove only this acknowledged capture ID, preserving any items appended concurrently
        await dequeueItem(currentItem.id);
      } else if (res && res.code === 'INVALID_PAYLOAD') {
        // Non-retryable input error: dequeue to avoid blocking the remainder of the outbox
        await dequeueItem(currentItem.id);
      } else {
        // Transient error (ENRICHMENT_FAILED, DB_UNAVAILABLE): retain in outbox and halt flush
        break;
      }
    }
  } finally {
    isFlushing = false;
    await refreshBadge();
  }

  const { outbox_queue = [] } = (await chrome.storage.local.get(['outbox_queue'])) || {};
  return { flushed: flushedCount, remaining: outbox_queue.length };
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'wordloom-capture-selection',
      title: 'Capture to Wordloom',
      contexts: ['selection']
    });

    if (chrome.action?.setBadgeBackgroundColor) {
      chrome.action.setBadgeBackgroundColor({ color: '#852B3B' });
    }
    refreshBadge();
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'wordloom-capture-selection' || !tab?.id) return;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/captureScript.js']
      });

      const capture = results?.[0]?.result;
      if (capture) {
        await chrome.storage.local.set({
          capture_draft: {
            ...capture,
            updatedAt: Date.now()
          }
        });
      }

      if (chrome.action?.openPopup) {
        await chrome.action.openPopup();
      }
    } catch (err) {
      console.error('Wordloom context capture error:', err);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'ENQUEUE_OUTBOX') {
      enqueueItem(message.payload)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }
    if (message?.type === 'ACK_OUTBOX_ITEM') {
      dequeueItem(message.captureId)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }
    if (message?.type === 'FLUSH_OUTBOX') {
      flushOutbox()
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }
    if (message?.type === 'REFRESH_BADGE') {
      refreshBadge().then(() => sendResponse({ success: true }));
      return true;
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendNativeMessage,
    refreshBadge,
    mutateQueue,
    enqueueItem,
    dequeueItem,
    flushOutbox
  };
}
