'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const webHubCode = fs.readFileSync(path.join(__dirname, '../ui/webHub.js'), 'utf8');

function createDOMContext(userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36') {
  const elements = new Map();
  const listeners = new Map();

  function makeElement(id, tag = 'div', classes = ['hidden']) {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      classList: {
        _classes: new Set(classes),
        contains(c) { return this._classes.has(c); },
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this.contains(c)) { this.remove(c); return false; }
            else { this.add(c); return true; }
          }
          if (force) this.add(c); else this.remove(c);
          return force;
        }
      },
      value: '',
      textContent: '',
      className: classes.join(' '),
      disabled: false,
      dataset: {},
      addEventListener(type, fn) {
        if (!listeners.has(this)) listeners.set(this, new Map());
        const elListeners = listeners.get(this);
        if (!elListeners.has(type)) elListeners.set(type, []);
        elListeners.get(type).push(fn);
      },
      dispatchEvent(event) {
        const elListeners = listeners.get(this)?.get(event.type) || [];
        return Promise.all(elListeners.map(fn => fn(event)));
      },
      focus() {}
    };
    elements.set(id, el);
    return el;
  }

  // Pre-create required elements
  makeElement('web-preview-banner', 'aside', ['web-preview-banner', 'hidden']);
  makeElement('btn-floating-feedback', 'button', ['btn-floating-feedback', 'hidden']);
  makeElement('feedback-modal', 'div', ['modal-scrim', 'hidden']);
  makeElement('extension-guide-modal', 'div', ['modal-scrim', 'hidden']);
  makeElement('btn-web-feedback', 'button', ['btn-banner-action']);
  makeElement('feedback-modal-close', 'button', ['modal-btn-close']);
  makeElement('feedback-btn-cancel', 'button', ['btn-subtle']);
  makeElement('feedback-form', 'form', []);
  makeElement('feedback-status', 'div', ['dialog-feedback', 'hidden']);
  makeElement('feedback-comments', 'textarea', []);
  makeElement('feedback-role', 'input', []);
  makeElement('feedback-btn-submit', 'button', ['btn-record']);
  makeElement('btn-web-extension', 'button', ['btn-banner-action']);
  makeElement('ext-guide-close', 'button', ['modal-btn-close']);
  makeElement('ext-guide-done', 'button', ['btn-record']);
  makeElement('btn-web-reset', 'button', ['btn-banner-action']);

  const starBtns = [1, 2, 3, 4, 5].map(v => {
    const btn = makeElement(`star-${v}`, 'button', ['star-btn']);
    btn.dataset.value = String(v);
    return btn;
  });

  const checkedCategory = { value: 'design' };

  let storage = {};
  const mockLocalStorage = {
    getItem: k => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: k => { delete storage[k]; },
    clear: () => { storage = {}; }
  };

  const documentListeners = new Map();
  const mockDocument = {
    readyState: 'complete',
    getElementById: id => elements.get(id) || null,
    querySelector: sel => {
      if (sel === 'input[name="feedback-category"]:checked') return checkedCategory;
      return null;
    },
    querySelectorAll: sel => {
      if (sel === '.star-btn') return starBtns;
      return [];
    },
    addEventListener: (type, fn) => {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(fn);
    },
    dispatchEvent: event => {
      for (const fn of documentListeners.get(event.type) || []) fn(event);
    }
  };

  const mockWindow = {
    crypto: { randomUUID: () => 'fb_mock_uuid_123' },
    innerWidth: 1024,
    innerHeight: 768,
    location: { href: 'https://wordloom.pages.dev/' },
    confirm: () => true,
    vocabAPI: {
      loadWords: async () => []
    }
  };

  const context = vm.createContext({
    navigator: { userAgent },
    document: mockDocument,
    window: mockWindow,
    localStorage: mockLocalStorage,
    fetch: async () => ({ ok: true, json: async () => ({ success: true }) }),
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    console
  });

  return { context, elements, mockLocalStorage, mockDocument };
}

test('webHub displays preview banner and floating pill in browser, but hides them in Electron', () => {
  // 1. Browser mode (e.g. Chrome)
  const browser = createDOMContext('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
  vm.runInContext(webHubCode, browser.context);

  const banner = browser.elements.get('web-preview-banner');
  const floatingBtn = browser.elements.get('btn-floating-feedback');
  assert.equal(banner.classList.contains('hidden'), false, 'Banner should be visible in browser mode');
  assert.equal(floatingBtn.classList.contains('hidden'), false, 'Floating pill should be visible in browser mode');

  // 2. Electron desktop mode
  const electron = createDOMContext('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Wordloom/1.0.0 Chrome/120.0.0.0 Electron/29.0.0 Safari/537.36');
  vm.runInContext(webHubCode, electron.context);

  const electronBanner = electron.elements.get('web-preview-banner');
  const electronFloatingBtn = electron.elements.get('btn-floating-feedback');
  assert.equal(electronBanner.classList.contains('hidden'), true, 'Banner must remain hidden in Electron');
  assert.equal(electronFloatingBtn.classList.contains('hidden'), true, 'Floating pill must remain hidden in Electron');
});

test('webHub opens and submits peer feedback form with draft persistence and category data', async () => {
  const dom = createDOMContext();
  vm.runInContext(webHubCode, dom.context);

  const btnFeedback = dom.elements.get('btn-web-feedback');
  const modal = dom.elements.get('feedback-modal');
  const form = dom.elements.get('feedback-form');
  const commentsInput = dom.elements.get('feedback-comments');
  const roleInput = dom.elements.get('feedback-role');
  const status = dom.elements.get('feedback-status');

  // Open modal
  btnFeedback.dispatchEvent({ type: 'click' });
  assert.equal(modal.classList.contains('hidden'), false, 'Feedback modal should be visible after click');

  // Fill in form
  commentsInput.value = 'The editorial serif headings look exceptional on desktop and mobile.';
  roleInput.value = 'Typography Reviewer';

  // Submit form
  let defaultPrevented = false;
  await form.dispatchEvent({
    type: 'submit',
    preventDefault() { defaultPrevented = true; }
  });

  assert.equal(defaultPrevented, true);
  assert.match(status.textContent, /Thank you/);

  // Check persisted draft in localStorage
  const saved = JSON.parse(dom.mockLocalStorage.getItem('wordloom_feedback_drafts'));
  assert.equal(Array.isArray(saved), true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].category, 'design');
  assert.equal(saved[0].rating, 5);
  assert.equal(saved[0].roleOrContext, 'Typography Reviewer');
  assert.match(saved[0].comments, /editorial serif headings/);
});

test('webHub opens and closes the extension guide modal', () => {
  const dom = createDOMContext();
  vm.runInContext(webHubCode, dom.context);

  const btnExt = dom.elements.get('btn-web-extension');
  const modal = dom.elements.get('extension-guide-modal');
  const btnClose = dom.elements.get('ext-guide-close');

  btnExt.dispatchEvent({ type: 'click' });
  assert.equal(modal.classList.contains('hidden'), false, 'Extension guide modal should open on click');

  btnClose.dispatchEvent({ type: 'click' });
  assert.equal(modal.classList.contains('hidden'), true, 'Extension guide modal should close on click');
});
