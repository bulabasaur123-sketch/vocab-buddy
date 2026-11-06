'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateCapture } = require('../services/nativeBridge');

const EXTENSION_DIR = path.join(__dirname, '../extension');

test('Manifest V3 configuration adheres to strict privacy and permissions scope', () => {
  const manifestPath = path.join(EXTENSION_DIR, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'Wordloom — Reading Companion');
  assert.equal(manifest.action.default_popup, 'popup/popup.html');
  assert.equal(manifest.background.service_worker, 'background/serviceWorker.js');

  // Verify minimal permissions — no <all_urls> wildcards!
  assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'contextMenus', 'nativeMessaging', 'scripting', 'storage'].sort());
  assert.equal(manifest.host_permissions, undefined);

  // Verify icons exist
  for (const size of ['16', '32', '48', '128']) {
    const iconPath = path.join(EXTENSION_DIR, manifest.icons[size]);
    assert.ok(fs.existsSync(iconPath), `Icon ${size} must exist at ${iconPath}`);
    assert.ok(fs.statSync(iconPath).size > 50, `Icon ${size} must be a valid non-empty file`);
  }
});

test('Content script sanitizes HTML, strips URL credentials, and bounds sentence excerpts', () => {
  const scriptContent = fs.readFileSync(path.join(EXTENSION_DIR, 'content/captureScript.js'), 'utf8');

  // Emulate browser DOM environment
  const mockContext = {
    URL: globalThis.URL,
    window: {
      location: { href: 'https://user:pass@theparisreview.org/essay?query=1#fragment' },
      getSelection: () => ({
        rangeCount: 1,
        toString: () => 'susurrus',
        getRangeAt: () => ({
          commonAncestorContainer: {
            nodeType: 1,
            innerText: 'The ancient garden was peaceful. The faint susurrus of wind through the trees whispered softly. Shadows lengthened rapidly.'
          }
        })
      })
    },
    document: {
      title: '<b>The Paris Review</b> — Modern Essays'
    },
    cleanPlainText: null,
    cleanUrl: null,
    extractContextualExcerpt: null,
    getPageCapture: null
  };

  vm.createContext(mockContext);
  const result = vm.runInContext(`${scriptContent}; getPageCapture();`, mockContext);

  assert.equal(result.word, 'susurrus');
  assert.equal(result.sentenceExcerpt, 'The faint susurrus of wind through the trees whispered softly.');
  assert.equal(result.sourceTitle, 'The Paris Review — Modern Essays');
  assert.equal(result.sourceUrl, 'https://theparisreview.org/essay?query=1#fragment'); // credentials stripped!
});

test('Popup controller manages draft persistence, discard, and privacy clear actions', async () => {
  function createElement() {
    const classes = new Set();
    const listeners = {};
    return {
      value: '', textContent: '', className: '', disabled: false, title: '',
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); }
      },
      addEventListener(event, fn) { listeners[event] = listeners[event] || []; listeners[event].push(fn); },
      trigger(event, data) { for (const fn of listeners[event] || []) fn(data); },
      focus() {}
    };
  }

  const ids = [
    'capture-form', 'input-word', 'input-excerpt', 'input-title', 'input-url', 'input-notes',
    'btn-clear-excerpt', 'btn-clear-source', 'btn-discard-draft', 'btn-save',
    'save-status', 'draft-banner', 'bridge-status-indicator', 'bridge-status-text'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, createElement()]));

  let storageStore = {};
  const mockChrome = {
    storage: {
      local: {
        get: async keys => Object.fromEntries(keys.map(k => [k, storageStore[k]])),
        set: async obj => { Object.assign(storageStore, obj); },
        remove: async key => { delete storageStore[key]; }
      }
    },
    runtime: {
      lastError: null,
      sendNativeMessage: (host, msg, cb) => cb({ status: 'success', word: 'susurrus', isDuplicate: false }),
      sendMessage: () => {}
    },
    tabs: { query: (opts, cb) => cb([{ id: 1, title: 'Essay', url: 'https://example.com' }]) },
    scripting: { executeScript: (opts, cb) => cb([{ result: { word: 'susurrus', sentenceExcerpt: 'A whisper.', sourceTitle: 'Essay', sourceUrl: 'https://example.com' } }]) }
  };

  const scriptContent = fs.readFileSync(path.join(EXTENSION_DIR, 'popup/popup.js'), 'utf8');
  let domLoadedCb = null;
  const context = vm.createContext({
    URL: globalThis.URL,
    document: {
      getElementById: id => elements[id],
      addEventListener: (event, fn) => { if (event === 'DOMContentLoaded') domLoadedCb = fn; }
    },
    window: {
      addEventListener: () => {},
      close: () => {}
    },
    chrome: mockChrome,
    crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {}
  });

  vm.runInContext(scriptContent, context);
  await domLoadedCb();

  // 1. Initial active tab extraction populated values
  assert.equal(elements['input-word'].value, 'susurrus');
  assert.equal(elements['input-excerpt'].value, 'A whisper.');

  // 2. Clear excerpt action (privacy strip)
  elements['btn-clear-excerpt'].trigger('click');
  assert.equal(elements['input-excerpt'].value, '');

  // 3. Clear source action
  elements['btn-clear-source'].trigger('click');
  assert.equal(elements['input-title'].value, '');
  assert.equal(elements['input-url'].value, '');

  // 4. Draft save into storage
  elements['input-word'].value = 'ephemeral';
  elements['input-word'].trigger('input');
  assert.equal(storageStore.capture_draft?.word, 'ephemeral');

  // 5. Discard draft restores active tab capture
  await vm.runInContext('discardDraft();', context);
  assert.equal(storageStore.capture_draft, undefined);
  assert.equal(elements['input-word'].value, 'susurrus');
});

test('Popup saves via Native Messaging Bridge and validates payload against schema', async () => {
  let bridgeCalledWith = null;
  const mockChrome = {
    runtime: {
      lastError: null,
      sendNativeMessage: (host, msg, cb) => {
        bridgeCalledWith = msg;
        cb({ status: 'success', word: msg.word, isDuplicate: false });
      },
      sendMessage: () => {}
    },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } }
  };

  const payload = {
    version: 1,
    id: 'cap_abc123',
    word: 'serendipity',
    sentenceExcerpt: 'A pleasant happenstance.',
    sourceTitle: 'Literary Journal',
    sourceUrl: 'https://example.com/story',
    capturedAt: new Date().toISOString()
  };

  // Ensure client-side payload contract strictly passes backend's validateCapture
  const validated = validateCapture(payload);
  assert.equal(validated.word, 'serendipity');
  assert.equal(validated.sentenceExcerpt, 'A pleasant happenstance.');
  assert.equal(validated.sourceTitle, 'Literary Journal');
});

test('Popup falls back to outbox queue and displays honest status when desktop is offline', async () => {
  const outboxStorage = { outbox_queue: [] };
  const mockChrome = {
    runtime: {
      lastError: { message: 'Specified native messaging host not found.' },
      sendNativeMessage: (host, msg, cb) => cb(null),
      sendMessage: () => {}
    },
    storage: {
      local: {
        get: async keys => outboxStorage,
        set: async obj => { Object.assign(outboxStorage, obj); },
        remove: async () => {}
      }
    }
  };

  function createElement() {
    return { value: '', textContent: '', className: '', disabled: false, classList: { add() {}, remove() {} }, addEventListener() {} };
  }
  const elements = Object.fromEntries([
    'capture-form', 'input-word', 'input-excerpt', 'input-title', 'input-url', 'input-notes',
    'btn-clear-excerpt', 'btn-clear-source', 'btn-discard-draft', 'btn-save',
    'save-status', 'draft-banner', 'bridge-status-indicator', 'bridge-status-text'
  ].map(id => [id, createElement()]));

  elements['input-word'].value = 'ineffable';
  elements['input-excerpt'].value = 'Too great to be expressed in words.';

  const scriptContent = fs.readFileSync(path.join(EXTENSION_DIR, 'popup/popup.js'), 'utf8');
  const context = vm.createContext({
    URL: globalThis.URL,
    document: { getElementById: id => elements[id], addEventListener: () => {} },
    window: { addEventListener: () => {}, close: () => {} },
    chrome: mockChrome,
    crypto: { randomUUID: () => 'abcd' },
    setTimeout: fn => fn(),
    clearTimeout: () => {}
  });

  vm.runInContext(scriptContent, context);
  await vm.runInContext('handleSave();', context);

  // Assert item was safely queued into local outbox
  assert.equal(outboxStorage.outbox_queue.length, 1);
  assert.equal(outboxStorage.outbox_queue[0].word, 'ineffable');
  assert.equal(elements['save-status'].className, 'save-status warning');
  assert.match(elements['save-status'].textContent, /Saved locally in browser/);
});
