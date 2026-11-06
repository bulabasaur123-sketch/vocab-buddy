'use strict';

/**
 * Wordloom Background Service Worker (Manifest V3)
 * Handles context menu capture, offline outbox synchronization, and bridge messaging.
 */

const NATIVE_HOST = 'com.wordloom.bridge';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'wordloom-capture-selection',
    title: 'Capture to Wordloom',
    contexts: ['selection']
  });

  chrome.action.setBadgeBackgroundColor({ color: '#852B3B' });
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

    if (chrome.action.openPopup) {
      await chrome.action.openPopup();
    }
  } catch (err) {
    console.error('Wordloom context capture error:', err);
  }
});

function sendNativeMessage(payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, response => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message || 'Native host unavailable'));
        resolve(response);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function refreshBadge() {
  try {
    const { outbox_queue = [] } = await chrome.storage.local.get(['outbox_queue']);
    const count = outbox_queue.length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  } catch {
    // Non-fatal badge update
  }
}

async function flushOutbox() {
  const { outbox_queue = [] } = await chrome.storage.local.get(['outbox_queue']);
  if (!outbox_queue.length) {
    await refreshBadge();
    return { flushed: 0, remaining: 0 };
  }

  const remaining = [];
  let flushed = 0;

  for (let i = 0; i < outbox_queue.length; i++) {
    const item = outbox_queue[i];
    try {
      const res = await sendNativeMessage(item);
      if (res && res.status === 'success') {
        flushed++;
      } else {
        remaining.push(item, ...outbox_queue.slice(i + 1));
        break;
      }
    } catch {
      remaining.push(item, ...outbox_queue.slice(i + 1));
      break;
    }
  }

  await chrome.storage.local.set({ outbox_queue: remaining });
  await refreshBadge();
  return { flushed, remaining: remaining.length };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'FLUSH_OUTBOX') {
    flushOutbox().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true; // Keep message port open for async response
  }
  if (message?.type === 'REFRESH_BADGE') {
    refreshBadge().then(() => sendResponse({ success: true }));
    return true;
  }
});

