'use strict';

/**
 * Wordloom On-Demand Content Script
 * Extracts selected vocabulary, bounded sentence context, and document provenance.
 * Preserves reader privacy: sanitizes to plain text and injects zero persistent DOM elements.
 */

function cleanPlainText(str, limit) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function cleanUrl(href) {
  if (!href || typeof href !== 'string') return '';
  try {
    const url = new URL(href);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.username = '';
    url.password = '';
    return url.toString().slice(0, 500);
  } catch {
    return '';
  }
}

function extractContextualExcerpt(selection) {
  if (!selection || selection.rangeCount === 0) return '';
  try {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const parent = container.nodeType === 3 /* Node.TEXT_NODE */ ? container.parentElement : container;
    const fullText = (parent?.innerText || parent?.textContent || '').replace(/\r\n/g, '\n');
    const selectedText = selection.toString().trim();

    if (!selectedText || !fullText) return cleanPlainText(selectedText, 300);

    const index = fullText.indexOf(selectedText);
    if (index === -1) return cleanPlainText(selectedText, 300);

    // Expand backwards to sentence start
    let start = index;
    while (start > 0 && !/[.!?\n]/.test(fullText[start - 1])) {
      start--;
    }
    while (start < index && /\s/.test(fullText[start])) {
      start++;
    }

    // Expand forwards to sentence end
    let end = index + selectedText.length;
    while (end < fullText.length && !/[.!?\n]/.test(fullText[end])) {
      end++;
    }
    if (end < fullText.length && /[.!?]/.test(fullText[end])) {
      end++;
    }

    const sentence = fullText.slice(start, end).replace(/\s+/g, ' ').trim();
    return cleanPlainText(sentence, 300);
  } catch {
    return cleanPlainText(selection.toString().trim(), 300);
  }
}

function getPageCapture() {
  const selection = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
  const rawWord = selection ? selection.toString().trim() : '';
  const excerpt = selection ? extractContextualExcerpt(selection) : '';

  return {
    word: cleanPlainText(rawWord, 100),
    sentenceExcerpt: cleanPlainText(excerpt, 300),
    sourceTitle: cleanPlainText(document.title || '', 200),
    sourceUrl: cleanUrl(window.location.href)
  };
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'GET_SELECTION_CAPTURE') {
      sendResponse(getPageCapture());
    }
  });
}

// When injected via chrome.scripting.executeScript, the last expression is returned
getPageCapture();

