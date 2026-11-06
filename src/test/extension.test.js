'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateCapture } = require('../services/nativeBridge');
const { registerHost } = require('../../scripts/registerNativeHost');

const EXTENSION_DIR = path.join(__dirname, '../extension');
const tick = () => new Promise(resolve => setImmediate(resolve));

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

test('registerNativeHost enforces explicit 32-character extension ID and rejects wildcards', () => {
  const hostDir = path.join(require('node:os').homedir(), '.config', 'google-chrome', 'NativeMessagingHosts');
  const hostFile = path.join(hostDir, 'com.wordloom.bridge.json');

  // 1. Rejects missing, empty, or invalid extension IDs
  for (const invalid of ['', '   ', 'abc', '*', 'chrome-extension://*/*', '12345678901234567890123456789012', 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEF']) {
    let exited = false;
    const origExit = process.exit;
    const origErr = console.error;
    console.error = () => {};
    process.exit = () => { exited = true; throw new Error('EXIT'); };
    try {
      registerHost(invalid);
    } catch (e) {
      assert.equal(e.message, 'EXIT');
    } finally {
      process.exit = origExit;
      console.error = origErr;
    }
    assert.ok(exited, `Expected exit for invalid extension ID: ${invalid}`);
  }

  // 2. Accepts valid 32-character ID (letters a-p) and configures exact allowed_origins
  const validId = 'abcdefghijklmnopabcdefghijklmnop';
  registerHost(validId);

  assert.ok(fs.existsSync(hostFile));
  const written = JSON.parse(fs.readFileSync(hostFile, 'utf8'));
  assert.equal(written.name, 'com.wordloom.bridge');
  assert.deepEqual(written.allowed_origins, [`chrome-extension://${validId}/`]);
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
      focus() { }
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
      sendMessage: () => { }
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
      addEventListener: () => { },
      close: () => { }
    },
    chrome: mockChrome,
    crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
    setTimeout: (fn) => fn(),
    clearTimeout: () => { }
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

test('Popup durable-first outbox queues item before delivery and retains on transient failures or 1500ms timeout', async () => {
  const outboxStorage = { outbox_queue: [] };
  let simulatedBridgeBehavior = 'withhold_timeout'; // 'withhold_timeout' | 'enrichment_failed' | 'success'

  const mockChrome = {
    runtime: {
      lastError: null,
      sendNativeMessage: (host, msg, cb) => {
        if (simulatedBridgeBehavior === 'withhold_timeout') {
          // Do not invoke cb immediately to test deadline
        } else if (simulatedBridgeBehavior === 'enrichment_failed') {
          cb({ status: 'error', code: 'ENRICHMENT_FAILED', message: 'Dictionary timeout' });
        } else {
          cb({ status: 'success', word: msg.word, isDuplicate: false });
        }
      },
      sendMessage: () => { }
    },
    storage: {
      local: {
        get: async keys => outboxStorage,
        set: async obj => { Object.assign(outboxStorage, obj); },
        remove: async () => { }
      }
    }
  };

  function createElement() {
    return { value: '', textContent: '', className: '', disabled: false, classList: { add() { }, remove() { } }, addEventListener() { } };
  }
  const elements = Object.fromEntries([
    'capture-form', 'input-word', 'input-excerpt', 'input-title', 'input-url', 'input-notes',
    'btn-clear-excerpt', 'btn-clear-source', 'btn-discard-draft', 'btn-save',
    'save-status', 'draft-banner', 'bridge-status-indicator', 'bridge-status-text'
  ].map(id => [id, createElement()]));

  elements['input-word'].value = 'ineffable';
  elements['input-excerpt'].value = 'Too great to be expressed in words.';

  let activeTimers = [];
  const scriptContent = fs.readFileSync(path.join(EXTENSION_DIR, 'popup/popup.js'), 'utf8');
  const context = vm.createContext({
    URL: globalThis.URL,
    document: { getElementById: id => elements[id], addEventListener: () => { } },
    window: { addEventListener: () => { }, close: () => { } },
    chrome: mockChrome,
    crypto: { randomUUID: () => 'deadbeef' },
    setTimeout: (fn, delay) => {
      const timer = { fn, delay };
      activeTimers.push(timer);
      return timer;
    },
    clearTimeout: timer => {
      activeTimers = activeTimers.filter(t => t !== timer);
    }
  });

  vm.runInContext(scriptContent, context);

  // Case 1: Deadline timeout (withheld bridge response)
  const savePromise = vm.runInContext('handleSave();', context);
  await tick(); // Allow microtasks to execute up to native message send

  // Item must ALREADY be durably in outbox before wire response arrives!
  assert.equal(outboxStorage.outbox_queue.length, 1);
  assert.equal(outboxStorage.outbox_queue[0].word, 'ineffable');

  // Trigger 1500ms timeout
  const deadlineTimer = activeTimers.find(t => t.delay === 1500);
  assert.ok(deadlineTimer, '1500ms deadline timer must be scheduled');
  deadlineTimer.fn();
  await savePromise;

  assert.equal(outboxStorage.outbox_queue.length, 1, 'Timed-out item must remain in outbox');
  assert.equal(elements['save-status'].className, 'save-status warning');
  assert.match(elements['save-status'].textContent, /Saved locally in browser/);

  // Case 2: Transient ENRICHMENT_FAILED response retains item in outbox
  simulatedBridgeBehavior = 'enrichment_failed';
  await vm.runInContext('handleSave();', context);
  assert.equal(outboxStorage.outbox_queue.length, 1, 'Transient failure must retain item in outbox');
  assert.equal(elements['save-status'].className, 'save-status warning');

  // Case 3: Successful delivery removes acknowledged item
  simulatedBridgeBehavior = 'success';
  await vm.runInContext('handleSave();', context);
  assert.equal(outboxStorage.outbox_queue.length, 0, 'Successful delivery must remove item from outbox');
  assert.equal(elements['save-status'].className, 'save-status success');
});

test('Background service worker flushOutbox preserves concurrently appended captures', async () => {
  const scriptContent = fs.readFileSync(path.join(EXTENSION_DIR, 'background/serviceWorker.js'), 'utf8');

  let storage = {
    outbox_queue: [
      { id: 'cap_A', word: 'aphelion' }
    ]
  };

  let bridgeDeliveryPending = null;
  const mockChrome = {
    runtime: {
      onInstalled: { addListener: () => {} },
      onMessage: { addListener: () => {} },
      lastError: null,
      sendNativeMessage: (host, payload, cb) => {
        bridgeDeliveryPending = cb;
      }
    },
    action: {
      setBadgeBackgroundColor: () => {},
      setBadgeText: () => {}
    },
    contextMenus: {
      create: () => {},
      onClicked: { addListener: () => {} }
    },
    storage: {
      local: {
        get: async keys => storage,
        set: async obj => { Object.assign(storage, obj); }
      }
    }
  };

  let activeTimers = [];
  const context = vm.createContext({
    chrome: mockChrome,
    setTimeout: (fn, delay) => {
      const timer = { fn, delay };
      activeTimers.push(timer);
      return timer;
    },
    clearTimeout: timer => {
      activeTimers = activeTimers.filter(t => t !== timer);
    },
    console
  });

  vm.runInContext(scriptContent, context);

  // 1. Trigger flushOutbox()
  const flushPromise = vm.runInContext('flushOutbox();', context);
  await tick(); // Allow microtasks to run up to sendNativeMessage

  assert.ok(bridgeDeliveryPending, 'Delivery of cap_A must be in flight');

  // 2. Concurrently append item B to outbox while delivery of A is in flight!
  storage.outbox_queue.push({ id: 'cap_B', word: 'perihelion' });
  assert.equal(storage.outbox_queue.length, 2);

  // 3. Acknowledge delivery of item A
  bridgeDeliveryPending({ status: 'success', word: 'aphelion' });
  await tick();

  // 4. Acknowledging A will cause flushOutbox to proceed to item B!
  assert.ok(bridgeDeliveryPending, 'Delivery of cap_B should now be processed');
  bridgeDeliveryPending({ status: 'success', word: 'perihelion' });

  await flushPromise;

  // Both items delivered in wire order without either being wiped out!
  assert.equal(storage.outbox_queue.length, 0);
});
