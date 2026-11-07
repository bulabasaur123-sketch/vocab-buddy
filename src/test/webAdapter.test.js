'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const cheerio = require('cheerio');
const { validateWords } = require('../db/wordSchema');
const { calculateNextReview } = require('../services/spacedRepetition');
const source = fs.readFileSync(path.join(__dirname, '../services/webAdapter.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const reply = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });

// Only the standard DOM surface used by the inert parser is mocked. Cheerio
// supplies HTML parsing/entity decoding; no adapter parsing logic is mocked.
class DOMParserMock {
  parseFromString(html) {
    const $ = cheerio.load(html);
    function wrap(selection) {
      if (!selection.length) return null;
      return {
        get textContent() { return selection.text(); },
        get children() { return selection.children().toArray().map(n => wrap($(n))); },
        get parentElement() { return wrap(selection.parent()); },
        get nextElementSibling() { return wrap(selection.next()); },
        classList: { contains: name => selection.hasClass(name) },
        querySelectorAll(selector) { return selection.find(selector).toArray().map(n => wrap($(n))); },
        querySelector(selector) { return wrap(selection.find(selector).first()); },
        getAttribute(name) { return selection.attr(name) ?? null; },
        matches(selector) { return selection.is(selector); },
        cloneNode() { return wrap(selection.clone()); },
        remove() { selection.remove(); },
        replaceWith(value) { selection.replaceWith(value); },
        append(value) { selection.append(value?.selection ?? value); },
        selection
      };
    }
    return { body: wrap($('body')), querySelectorAll: selector => $(selector).toArray().map(n => wrap($(n))),
      createElement: tag => wrap($(`<${tag}></${tag}>`)) };
  }
}
function storage() {
  const data = new Map();
  return { data, fail: false, getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (this.fail) throw new Error('QuotaExceededError'); data.set(key, value); } };
}
function browser({ localStorage = storage(), fetch = async () => reply({}, 404), Audio, existing, navigator = {} } = {}) {
  const window = { localStorage, fetch, crypto: webcrypto, DOMParser: DOMParserMock, AbortSignal, Audio, navigator };
  if (existing) window.vocabAPI = existing;
  const context = vm.createContext({ window, URL, setTimeout, clearTimeout, console });
  vm.runInContext(source, context);
  // Mirror the structured-clone boundary of a browser client when comparing
  // results from separate VM realms in node:assert/strict.
  const api = existing ? window.vocabAPI : Object.fromEntries(Object.entries(window.vocabAPI).map(([name, fn]) =>
    [name, async (...args) => { const value = await fn(...args); return value === undefined ? value : plain(value); }]));
  return { api, window, context, localStorage, reload: () => browser({ localStorage, fetch, Audio, navigator }) };
}
const entry = word => [{ phonetic: '/ipa/', phonetics: [{ audio: `https://audio.example/${word}-au.mp3` }, { audio: `https://audio.example/${word}-us.mp3` }],
  meanings: [{ partOfSpeech: 'noun', synonyms: ['chance', 'chance'], definitions: [{ definition: `Meaning of ${word}.`, example: `A ${word} appears.`, antonyms: ['misfortune'] }] }] }];
function dictionaryFetch(calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    return url.includes('dictionaryapi.dev') ? reply(entry(decodeURIComponent(url.split('/').at(-1)))) : reply({});
  };
}
class AudioMock {
  static checked = [];
  static bad = new Set();
  constructor(src) { this.src = src ?? ''; }
  pause() {}
  removeAttribute() { this.src = ''; }
  load() {
    if (!this.src) return;
    const src = this.src; AudioMock.checked.push(src);
    queueMicrotask(() => (AudioMock.bad.has(src) ? this.onerror : this.oncanplay)?.());
  }
  async play() { return true; }
}

test('web adapter stands down in Electron and Node; exposes the exact preload facade and seeds five validated words', async () => {
  const existing = { desktop: true }; assert.equal(browser({ existing }).api, existing);
  vm.runInNewContext(source); // Node/SSR without window performs no work.
  let desktop;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../preload.js'), 'utf8'), {
    require: () => ({ contextBridge: { exposeInMainWorld(_name, value) { desktop = value; } } })
  });
  const { api, reload } = browser();
  assert.deepEqual(Object.keys(api).sort(), Object.keys(desktop).sort());
  assert.equal(Object.keys(api).length, 27); // The current preload actually has 27, not the spec's stated 28.
  const words = await api.loadWords(); assert.equal(words.length, 5); validateWords(words);
  assert.deepEqual(await reload().api.loadWords(), words);
  words[0].review.box = 5; assert.equal((await api.loadWords())[0].review.box, 1);
});

test('all preload methods succeed in a browser; full library metadata and mutations survive reload and export/import', async () => {
  const env = browser({ fetch: dictionaryFetch(), Audio: AudioMock }), called = new Set();
  const api = Object.fromEntries(Object.entries(env.api).map(([name, fn]) => [name, (...args) => { called.add(name); return fn(...args); }]));
  const seed = await api.loadWords();
  const fresh = await api.lookupWord('Aurora', 'Source'); await api.addWord(fresh);
  const shelf = await api.createCollection({ name: 'Reading', description: 'Essays', colorAccent: '#852B3B' });
  assert.equal(await api.assignWordToCollection(fresh.id, shelf.id), true);
  assert.equal(await api.assignWordToCollection(fresh.id, shelf.id), false);
  await api.setWordTags(fresh.id, ['#Atmosphere', ' atmosphere ', 'Nature']);
  assert.ok((await api.getAllTags()).some(t => t.tag === 'atmosphere' && t.count === 1));
  assert.equal(await api.toggleFavorite(fresh.id), true);
  const link = await api.addAssociation(fresh.id, seed[0].id, 'Related'); assert.equal(link.success, true);
  assert.equal((await api.getAssociations(seed[0].id))[0].associatedWordId, fresh.id);
  const graph = await api.getConnectionsNeighborhood(fresh.id, 1);
  assert.ok(graph.nodes.some(n => n.type === 'shelf')); assert.ok(graph.links.some(l => l.type === 'association'));
  for (const mode of ['definition', 'cloze', 'missing_letters']) assert.ok((await api.generateQuiz(mode)).length >= 5);
  await api.reviewWord(fresh.id, 'good'); await api.submitQuiz(fresh.id, true, true);
  assert.equal((await api.getReviewStats()).total, 6); await api.getDueWordsQueue();
  assert.equal((await api.getCollections())[0].wordCount, 1);
  assert.equal(await api.getAudioDataUrl(fresh.word), fresh.audioUrl);
  assert.equal((await api.ensurePronunciation(fresh.word)).status, 'ready');
  assert.equal((await api.repairPronunciations()).checked, 6);
  const before = await api.exportData();
  assert.deepEqual(await env.reload().api.exportData(), before);
  assert.equal(before.quizHistory.length, 1); assert.equal(before.associations.length, 1);
  await api.saveWords([]); assert.deepEqual(await env.reload().api.loadWords(), []);
  await api.importData(before); assert.deepEqual(await api.exportData(), before);
  await api.removeAssociation(seed[0].id, fresh.id); assert.deepEqual(await api.getAssociations(fresh.id), []);
  await api.removeWordFromCollection(fresh.id, shelf.id); await api.deleteCollection(shelf.id);
  await api.removeWord(fresh.id); assert.equal((await env.reload().api.loadWords()).length, 5);
  assert.deepEqual([...called].sort(), Object.keys(env.api).sort());
});

test('mutations use fresh storage across instances, cascade removals, and never resurrect an intentionally empty library', async () => {
  const env = browser(), first = env.api, second = env.reload().api;
  const [a, b] = await first.loadWords(); const c = await first.createCollection({ name: 'Shelf' });
  await second.assignWordToCollection(a.id, c.id); await first.setWordTags(a.id, ['marked']);
  await second.addAssociation(a.id, b.id); await first.submitQuiz(a.id, false, false);
  await second.removeWord(a.id);
  assert.deepEqual(await first.getAssociations(b.id), []);
  assert.equal((await first.getCollections())[0].wordCount, 0);
  assert.ok(!(await first.getAllTags()).some(t => t.tag === 'marked'));
  assert.equal((await first.exportData()).quizHistory.length, 0);
  for (const w of await first.loadWords()) await first.removeWord(w.id);
  assert.deepEqual(await env.reload().api.loadWords(), []);
});

test('quota, blocked storage, corrupt data, invalid imports, duplicate IDs/headwords, and bad relationships fail without replacing data', async () => {
  const env = browser(), api = env.api; const words = await api.loadWords(), original = env.localStorage.getItem('wordloom_words');
  for (const invalid of [null, {}, [words[0], words[0]], [{ ...words[0], audioUrl: 'javascript:evil()' }], [{ ...words[0], review: { ...words[0].review, box: 6 } }]]) {
    await assert.rejects(api.importData(invalid)); assert.equal(env.localStorage.getItem('wordloom_words'), original);
  }
  const exported = await api.exportData(); exported.words[0].collections = ['missing']; await assert.rejects(api.importData(exported));
  await assert.rejects(api.addWord({ ...words[0], id: 'other' }), /duplicate/);
  await assert.rejects(api.setWordTags(words[0].id, [3]), /tag/);
  await assert.rejects(api.assignWordToCollection(words[0].id, 'missing'), /Collection/);
  await assert.rejects(api.reviewWord('missing', 'good'), /not found/);
  await assert.rejects(api.reviewWord(words[0].id, 'bad'), /rating/);
  await assert.rejects(api.addAssociation(words[0].id, words[0].id), /itself/);
  await assert.rejects(api.getConnectionsNeighborhood(words[0].id, 101), /limit/);
  env.localStorage.fail = true; await assert.rejects(api.toggleFavorite(words[0].id), /Quota/);
  assert.equal(env.localStorage.getItem('wordloom_words'), original);
  env.localStorage.fail = false; env.localStorage.data.set('wordloom_words', '{bad');
  await assert.rejects(env.reload().api.loadWords()); assert.equal(env.localStorage.getItem('wordloom_words'), '{bad');
  await assert.rejects(browser({ localStorage: { getItem() { throw new Error('SecurityError'); } } }).api.loadWords(), /SecurityError/);
});

test('review cadence and stats match desktop rules, including immediate linked quiz failures and independent quiz history', async () => {
  const { api } = browser(); const words = await api.loadWords();
  words[0].review = { ...words[0].review, box: 4, boxLabel: 'Fortnightly' };
  words[1].review.nextReviewDate = '2099-01-01T00:00:00.000Z'; await api.saveWords(words);
  const before = Date.now(); await api.reviewWord(words[0].id, 'easy');
  const reviewed = (await api.loadWords())[0], expected = calculateNextReview(words[0].review, 'easy', new Date(before));
  assert.equal(reviewed.review.box, expected.box); assert.equal(reviewed.review.intervalDays, expected.intervalDays);
  assert.ok(Math.abs(Date.parse(reviewed.review.nextReviewDate) - Date.parse(expected.nextReviewDate)) < 1000);
  assert.equal((await api.getReviewStats()).mastered, 1);
  const due = await api.getDueWordsQueue(); assert.ok(!due.some(w => w.id === words[1].id));
  await api.submitQuiz(words[0].id, false, false); assert.deepEqual((await api.loadWords())[0].review, reviewed.review);
  await api.submitQuiz(words[0].id, false, true); assert.ok((await api.getDueWordsQueue()).some(w => w.id === words[0].id));
});

test('quizzes use distinct correct options, token-bounded cloze, intersecting filters, and skip undersized/sparse decks', async () => {
  const { api } = browser(), words = await api.loadWords();
  const shelf = await api.createCollection({ name: 'One' }); await api.assignWordToCollection(words[0].id, shelf.id);
  await api.toggleFavorite(words[0].id); await api.setWordTags(words[0].id, ['#Quiz']);
  for (const mode of ['definition', 'cloze', 'missing_letters']) {
    const deck = await api.generateQuiz(mode, { collectionId: shelf.id, tag: 'QUIZ', favoritesOnly: true }); assert.equal(deck.length, 1);
    const q = deck[0]; assert.equal(q.wordId, words[0].id);
    if (mode === 'missing_letters') { assert.equal(q.solution, words[0].word); assert.match(q.maskedWord, /_/); }
    else { assert.equal(new Set(q.options).size, 4); assert.equal(q.options[q.correctAnswerIndex], mode === 'definition' ? words[0].meanings[0].definitions[0].definition : words[0].word); }
  }
  await assert.rejects(api.generateQuiz('invalid'), /mode/); await assert.rejects(api.generateQuiz('cloze', { limit: 100 }), /limit/);
  await api.saveWords([words[0]]); assert.deepEqual(await api.generateQuiz('definition'), []);
  words[0].meanings[0].definitions[0].example = 'Serendipityish is not a whole word.'; await api.saveWords([words[0]]);
  assert.deepEqual(await api.generateQuiz('cloze'), []);
});

test('dictionary requests are parallel HTTPS/CORS requests containing only encoded headwords; normalization matches desktop models', async () => {
  const calls = [], resolvers = [];
  const { api } = browser({ fetch(url, options) { calls.push({ url, options }); return new Promise(r => resolvers.push(r)); } });
  const result = api.lookupWord('  A&B ', 'Private source'); assert.equal(calls.length, 2);
  for (const { url, options } of calls) { assert.ok(url.startsWith('https://')); assert.ok(url.includes('a%26b')); assert.ok(!url.includes('Private')); assert.equal(options.credentials, 'omit'); assert.ok(options.signal instanceof AbortSignal); }
  assert.match(calls[1].url, /origin=\*/);
  resolvers[0](reply(entry('a&b'))); resolvers[1](reply({})); const word = await result;
  validateWords([word]); assert.equal(word.word, 'a&b'); assert.equal(word.displayWord, 'A&b'); assert.equal(word.bookSource, 'Private source');
  assert.equal(word.audioUrl, 'https://audio.example/a&b-us.mp3'); assert.deepEqual(word.synonyms, ['chance']);
});

test('Wiktionary DOM parsing scopes modern English headings, decodes entities and removes executable/reference content', async () => {
  const html = '<h2>German</h2><h3>Etymology</h3><p>Wrong.</p><div class="mw-heading mw-heading2"><h2>English</h2></div>' +
    '<div class="mw-heading mw-heading3"><h3>Etymology 1</h3></div><p>From <b>Latin</b> &amp; Greek.<sup class="reference">[1]</sup><script>evil()</script></p>' +
    '<h3>Pronunciation</h3><span class="IPA">/wiki/</span><audio><source src="//upload.wikimedia.org/test.ogg"></audio>' +
    '<h3>Noun</h3><ol><li>A &lt;quiet&gt; sound.<dl><dd class="nyms synonym"><a>whisper</a></dd></dl></li></ol><h2>French</h2><h3>Noun</h3><ol><li>Wrong.</li></ol>';
  const { api } = browser({ fetch: async url => url.includes('dictionaryapi') ? reply({}, 503) : reply({ parse: { text: { '*': html } } }) });
  const word = await api.lookupWord('susurrus'); validateWords([word]);
  assert.equal(word.etymology, 'From Latin & Greek.'); assert.equal(word.phonetic, '/wiki/');
  assert.equal(word.meanings[0].definitions[0].definition, 'A <quiet> sound.'); assert.equal(word.meanings.length, 1);
  assert.deepEqual(word.synonyms, ['whisper']); assert.equal(word.audioUrl, 'https://upload.wikimedia.org/test.ogg');
});

test('lemma resolution follows English links and provider roots, validates sparse suffix guesses, and preserves inflected form', async () => {
  for (const [input, root] of [['stymied', 'stymie'], ['running', 'run'], ['happies', 'happy']]) {
    const { api } = browser({ fetch: async url => {
      if (!url.includes('dictionaryapi')) return reply({});
      const word = url.split('/').at(-1); return word === root ? reply(entry(root)) : reply({}, 404);
    } });
    const result = await api.lookupWord(input); assert.equal(result.word, root); assert.equal(result.inflectedForm, input); validateWords([result]);
  }
  const { api } = browser({ fetch: async url => {
    if (url.includes('dictionaryapi')) return reply(entry('run'));
    return reply({ parse: { text: { '*': url.includes('page=ran&') ? '<h2>English</h2><span class="form-of-definition-link"><a>run</a></span>' : '' } } });
  } });
  assert.equal((await api.lookupWord('ran')).word, 'run');
});

test('lookup errors remain actionable and malformed/provider outages never mutate the library', async () => {
  for (const [status, code] of [[404, 'NOT_FOUND'], [429, 'RATE_LIMITED'], [503, 'HTTP_ERROR']]) {
    const { api } = browser({ fetch: async () => reply({}, status) }); const before = await api.loadWords();
    await assert.rejects(api.lookupWord('word'), error => error.code === code); assert.deepEqual(await api.loadWords(), before);
  }
  const env = browser({ fetch: async () => { throw new Error('offline'); } });
  await assert.rejects(env.api.lookupWord('word'), e => e.code === 'NETWORK_ERROR');
  for (const bad of ['', null, 'x'.repeat(101), 'bad\nword']) await assert.rejects(env.api.lookupWord(bad));
  await assert.rejects(env.api.lookupWord('word', {}));
});

test('HTML5 audio verifies links, rejects unsafe schemes, repairs metadata without resetting reviews, and tolerates unavailable words', async () => {
  AudioMock.checked = []; AudioMock.bad = new Set(['https://audio.example/broken.mp3']);
  const { api, reload } = browser({ fetch: dictionaryFetch(), Audio: AudioMock }); const words = await api.loadWords();
  words[0].audioUrl = 'https://audio.example/broken.mp3'; await api.saveWords(words);
  const pending = await Promise.all([api.ensurePronunciation(words[0].word), api.ensurePronunciation(words[0].word)]);
  assert.equal(pending[0].status, 'ready'); assert.match(pending[0].dataUrl, /-us.mp3$/);
  assert.deepEqual((await reload().api.loadWords())[0].review, words[0].review);
  assert.equal(await api.getAudioDataUrl('missing'), null); await assert.rejects(api.ensurePronunciation('missing'), /not found/);
  await assert.rejects(api.ensurePronunciation('javascript:evil()'), /Invalid/);
  const noAudio = browser({ fetch: async () => reply({}), Audio: AudioMock }).api;
  const stats = await noAudio.repairPronunciations(); assert.equal(stats.unavailable, 5);
  assert.ok(AudioMock.checked.every(url => url.startsWith('https://')));
});

test('Web Locks serializes simultaneous clients and releases after a failed storage commit', async () => {
  let chain = Promise.resolve(), locks = 0;
  const navigator = { locks: { request(name, action) {
    assert.equal(name, 'wordloom-library'); locks++;
    const next = chain.then(action); chain = next.catch(() => {}); return next;
  } } };
  const env = browser({ navigator }), other = env.reload().api;
  const words = await env.api.loadWords();
  await Promise.all([env.api.setWordTags(words[0].id, ['first']), other.setWordTags(words[1].id, ['second'])]);
  assert.deepEqual((await env.api.loadWords()).slice(0, 2).map(w => w.tags), [['first'], ['second']]);
  env.localStorage.fail = true; await assert.rejects(other.toggleFavorite(words[0].id), /Quota/);
  env.localStorage.fail = false; assert.equal(await env.api.toggleFavorite(words[0].id), true); assert.ok(locks >= 6);
});

test('all Leitner rating/box combinations match desktop transitions', async () => {
  const { api } = browser(); const [seed] = await api.loadWords();
  const labels = ['Daily', '3 Days', 'Weekly', 'Fortnightly', 'Mastered'];
  for (let box = 1; box <= 5; box++) for (const rating of ['again', 'hard', 'good', 'easy']) {
    const word = { ...seed, review: { ...seed.review, box, boxLabel: labels[box - 1] } };
    await api.saveWords([word]); const now = new Date(); const expected = calculateNextReview(word.review, rating, now);
    const [result] = await api.reviewWord(word.id, rating);
    for (const key of ['box', 'boxLabel', 'intervalDays', 'reviewCount', 'streak', 'lastRating']) assert.equal(result.review[key], expected[key]);
    assert.ok(Math.abs(Date.parse(result.review.nextReviewDate) - Date.parse(expected.nextReviewDate)) < 1000);
  }
});

test('rich entries are not guessed away, provider lemma cycles terminate, and malformed JSON surfaces a network error', async () => {
  const { api } = browser({ fetch: dictionaryFetch() });
  assert.equal((await api.lookupWord('blessing')).word, 'blessing');
  let requests = 0;
  const cyclic = browser({ fetch: async url => {
    requests++;
    if (!url.includes('dictionaryapi')) return reply({});
    const word = url.split('/').at(-1), data = entry(word);
    data[0].sourceUrls = [`https://en.wiktionary.org/wiki/${word === 'went' ? 'go' : 'went'}`]; return reply(data);
  } }).api;
  assert.equal((await cyclic.lookupWord('went')).word, 'go'); assert.equal(requests, 4);
  const malformed = browser({ fetch: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } }) }).api;
  await assert.rejects(malformed.lookupWord('word'), e => e.code === 'NETWORK_ERROR');
});

test('a late pronunciation result never resurrects a deleted word', async () => {
  let clip;
  class DelayedAudio extends AudioMock { constructor() { super(); clip = this; } load() {} }
  const { api } = browser({ Audio: DelayedAudio });
  const words = await api.loadWords(); words[0].audioUrl = 'https://audio.example/word.mp3'; await api.saveWords(words);
  const pending = api.ensurePronunciation(words[0].word);
  await new Promise(setImmediate); assert.ok(clip.oncanplay);
  await api.removeWord(words[0].id); clip.oncanplay();
  assert.equal((await pending).status, 'unavailable'); assert.ok(!(await api.loadWords()).some(w => w.id === words[0].id));
});
