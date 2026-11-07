/* Browser-only implementation of the preload facade. Load before renderer.js. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.vocabAPI) return;

  const KEY = 'wordloom_words';
  const labels = ['Daily', '3 Days', 'Weekly', 'Fortnightly', 'Mastered'];
  const intervals = [1, 3, 7, 14, 30];
  const copy = value => JSON.parse(JSON.stringify(value));
  const uuid = () => window.crypto.randomUUID();
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const tagName = tag => text(tag, 'tag').trim().replace(/^#+/, '').trim().toLowerCase();
  function text(value, name, limit = 10000) {
    if (typeof value !== 'string' || value.length > limit || /\u0000/.test(value)) throw new TypeError(`Invalid ${name}`);
    return value;
  }
  function id(value) {
    if (!text(value, 'ID', 1000).trim()) throw new TypeError('Invalid ID');
    return value;
  }
  function audioUrl(value) {
    try {
      const url = new URL(value?.startsWith('//') ? `https:${value}` : value);
      return url.protocol === 'https:' && !url.username && !url.password && /\.(mp3|ogg|wav)$/i.test(url.pathname) ? url.href : '';
    } catch { return ''; }
  }
  function initialReview(now = new Date()) {
    return { box: 1, boxLabel: labels[0], nextReviewDate: now.toISOString(), reviewCount: 0, streak: 0,
      lastRating: null, lastReviewedAt: null, intervalDays: 1 };
  }
  function nextReview(review, rating) {
    if (!['again', 'hard', 'good', 'easy'].includes(rating)) throw new TypeError('Invalid review rating');
    const box = rating === 'again' ? 1 : Math.min(5, review.box + (rating === 'easy' ? 2 : rating === 'good' ? 1 : 0));
    const now = new Date();
    return { ...review, box, boxLabel: labels[box - 1], intervalDays: intervals[box - 1],
      nextReviewDate: new Date(+now + intervals[box - 1] * 86400000).toISOString(), reviewCount: review.reviewCount + 1,
      streak: rating === 'again' ? 0 : review.streak + 1, lastRating: rating, lastReviewedAt: now.toISOString() };
  }
  function validateWords(words) {
    if (!Array.isArray(words) || words.length > 100000) throw new TypeError('Expected a word array (maximum 100000 entries)');
    const ids = new Set(), headwords = new Set();
    for (const word of words) {
      if (!word || ['id', 'word', 'displayWord', 'phonetic', 'audioUrl', 'etymology', 'bookSource'].some(key => typeof word[key] !== 'string') ||
          !word.id || !word.word.trim() || word.word !== word.word.trim().toLowerCase() || ids.has(word.id) || headwords.has(word.word) || !date(word.createdAt)) throw new TypeError('Invalid or duplicate word');
      id(word.id); ids.add(word.id); headwords.add(word.word);
      if (!Array.isArray(word.meanings) || word.meanings.some(m => !m || typeof m.partOfSpeech !== 'string' || !Array.isArray(m.definitions) || m.definitions.some(d => !d || typeof d.definition !== 'string' || typeof d.example !== 'string'))) throw new TypeError('Invalid meanings');
      for (const [key, max] of [['synonyms', 8], ['antonyms', 5]]) if (!Array.isArray(word[key]) || word[key].length > max || word[key].some(v => typeof v !== 'string')) throw new TypeError(`Invalid ${key}`);
      if (word.audioUrl && !audioUrl(word.audioUrl)) throw new TypeError('Invalid audio URL');
      if (word.isFavorite !== undefined && typeof word.isFavorite !== 'boolean') throw new TypeError('Invalid favorite');
      for (const key of ['tags', 'collections']) if (word[key] !== undefined && (!Array.isArray(word[key]) || word[key].some(v => typeof v !== 'string'))) throw new TypeError(`Invalid ${key}`);
      const r = word.review;
      if (!r || !Number.isInteger(r.box) || r.box < 1 || r.box > 5 || !date(r.nextReviewDate) ||
          !['reviewCount', 'streak'].every(k => Number.isSafeInteger(r[k]) && r[k] >= 0) ||
          ![null, 'again', 'hard', 'good', 'easy'].includes(r.lastRating) || !(r.lastReviewedAt === null || date(r.lastReviewedAt)) ||
          !(r.intervalDays === undefined || Number.isFinite(r.intervalDays) && r.intervalDays > 0) ||
          !(r.boxLabel === undefined || r.boxLabel === labels[r.box - 1])) throw new TypeError('Invalid review data');
    }
    return words.map(w => ({ ...w, isFavorite: w.isFavorite ?? false, tags: [...new Set((w.tags ?? []).map(tagName).filter(Boolean))],
      collections: [...new Set(w.collections ?? [])], review: { ...w.review, boxLabel: labels[w.review.box - 1], intervalDays: w.review.intervalDays ?? 1 } }));
  }
  function starterLibrary() {
    const entries = [
      ['serendipity', 'noun', 'A fortunate discovery made by chance.', 'Finding this book was serendipity.', 'Coined from Serendip by Horace Walpole.'],
      ['ephemeral', 'adjective', 'Lasting for a very short time.', 'The ephemeral bloom faded by evening.', 'From Greek ephemeros, lasting a day.'],
      ['mellifluous', 'adjective', 'Sweet and flowing in sound.', 'Her mellifluous voice filled the room.', 'From Latin mel, honey, and fluere, to flow.'],
      ['susurrus', 'noun', 'A soft whispering or rustling sound.', 'A susurrus rose from the leaves.', 'From Latin susurrus, a whisper.'],
      ['ineffable', 'adjective', 'Too great to be expressed in words.', 'The view inspired ineffable joy.', 'From Latin ineffabilis, unutterable.']
    ];
    return { version: 1, words: entries.map(([word, pos, definition, example, etymology]) => ({
      id: `${word}_starter`, word, displayWord: word[0].toUpperCase() + word.slice(1), phonetic: '', audioUrl: '', etymology,
      meanings: [{ partOfSpeech: pos, definitions: [{ definition, example }] }], synonyms: [], antonyms: [],
      bookSource: 'Wordloom sample library', createdAt: new Date().toISOString(), isFavorite: false, tags: ['showcase'], collections: [], review: initialReview()
    })), collections: [], associations: [], quizHistory: [] };
  }
  function validateLibrary(payload) {
    if (!payload || payload.version !== 1 || !Array.isArray(payload.collections) || !Array.isArray(payload.associations) || !Array.isArray(payload.quizHistory)) throw new TypeError('Invalid library export');
    const state = copy(payload);
    state.words = validateWords(state.words);
    const colIds = new Set(), colNames = new Set();
    for (const c of state.collections) {
      if (!c || !id(c.id) || !text(c.name, 'collection').trim() || !date(c.createdAt) || colIds.has(c.id) || colNames.has(c.name)) throw new TypeError('Invalid or duplicate collection');
      text(c.description, 'description'); text(c.colorAccent, 'color accent'); colIds.add(c.id); colNames.add(c.name);
    }
    const wordIds = new Set(state.words.map(w => w.id)), pairs = new Set();
    for (const w of state.words) if (w.collections.some(c => !colIds.has(c))) throw new TypeError('Collection not found');
    for (const a of state.associations) {
      if (!a || !wordIds.has(a.wordId1) || !wordIds.has(a.wordId2) || a.wordId1 >= a.wordId2 || !date(a.createdAt)) throw new TypeError('Invalid association');
      text(a.note, 'association note'); const pair = JSON.stringify([a.wordId1, a.wordId2]);
      if (pairs.has(pair)) throw new TypeError('Duplicate association'); pairs.add(pair);
    }
    for (const q of state.quizHistory) if (!q || !wordIds.has(q.wordId) || typeof q.success !== 'boolean' || !date(q.submittedAt)) throw new TypeError('Invalid quiz history');
    return state;
  }
  function read() {
    const stored = window.localStorage.getItem(KEY);
    if (stored === null) return starterLibrary();
    const parsed = JSON.parse(stored);
    // Accept earlier word-array backups while keeping an explicit empty library empty.
    return validateLibrary(Array.isArray(parsed) ? { version: 1, words: parsed, collections: [], associations: [], quizHistory: [] } : parsed);
  }
  // A fresh read inside the lock prevents stale per-tab snapshots. A single setItem
  // commits all related state atomically; quota/access errors never publish a cache.
  async function access(action, write = false) {
    const run = () => {
      const state = read();
      const result = action(state);
      if (write || window.localStorage.getItem(KEY) === null) window.localStorage.setItem(KEY, JSON.stringify(validateLibrary(state)));
      return result === undefined ? undefined : copy(result);
    };
    return window.navigator?.locks?.request ? window.navigator.locks.request('wordloom-library', run) : run();
  }
  function requireWord(state, wordId) {
    id(wordId); const word = state.words.find(w => w.id === wordId);
    if (!word) throw new Error('Word not found'); return word;
  }
  function pair(a, b) { id(a); id(b); if (a === b) throw new TypeError('Cannot associate a word with itself'); return [a, b].sort(); }
  function cleanup(state) {
    const ids = new Set(state.words.map(w => w.id));
    state.associations = state.associations.filter(a => ids.has(a.wordId1) && ids.has(a.wordId2));
    state.quizHistory = state.quizHistory.filter(q => ids.has(q.wordId));
  }
  function associations(state, wordId) {
    requireWord(state, wordId);
    return state.associations.filter(a => a.wordId1 === wordId || a.wordId2 === wordId).map(a => {
      const w = requireWord(state, a.wordId1 === wordId ? a.wordId2 : a.wordId1);
      return { associatedWordId: w.id, displayWord: w.displayWord, word: w.word, note: a.note, createdAt: a.createdAt };
    }).sort((a, b) => a.associatedWordId.localeCompare(b.associatedWordId));
  }

  // Provider HTML is parsed only in an inert DOMParser document, never inserted
  // into the live page. Every field returned to the UI is text or an HTTPS URL.
  function parseHtml(html) {
    const document = new window.DOMParser().parseFromString(String(html ?? ''), 'text/html');
    document.querySelectorAll('script,style,sup.reference,.mw-editsection').forEach(n => n.remove());
    document.querySelectorAll('br').forEach(n => n.replaceWith(' '));
    document.querySelectorAll('p,div,li').forEach(n => n.append(' '));
    const headings = [...document.querySelectorAll('h2')];
    const english = headings.find(n => n.textContent.trim() === 'English');
    if (english) {
      const root = document.createElement('section');
      let n = english.parentElement?.classList.contains('mw-heading') ? english.parentElement.nextElementSibling : english.nextElementSibling;
      while (n && !n.matches('h2,.mw-heading2')) { root.append(n.cloneNode(true)); n = n.nextElementSibling; }
      return root;
    }
    return document.body;
  }
  const clean = node => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  function sectionAfter(heading, selector) {
    const wrapper = heading.parentElement?.classList.contains('mw-heading') ? heading.parentElement : heading;
    let next = wrapper.nextElementSibling;
    while (next && !next.matches('h2,h3,h4,.mw-heading')) {
      if (next.matches(selector)) return next;
      next = next.nextElementSibling;
    }
    return null;
  }
  function wikiDetails(html) {
    const root = parseHtml(html), headings = [...root.querySelectorAll('h3,h4')];
    const etymology = clean(sectionAfter(headings.find(h => /^Etymology(?:\s+\d+)?$/.test(clean(h))) ?? root, 'p'));
    const meanings = [], synonyms = [], antonyms = [];
    for (const h of headings) {
      if (!/^(Adjective|Noun|Verb|Adverb|Interjection|Pronoun|Preposition|Conjunction|Proper noun|Article|Determiner|Numeral|Particle|Phrase)(?:\s+\d+)?$/i.test(clean(h))) continue;
      const list = sectionAfter(h, 'ol'), definitions = [];
      for (const li of list?.children ?? []) {
        for (const [selector, values] of [['.nyms.synonym a,.synonyms a', synonyms], ['.nyms.antonym a,.antonyms a', antonyms]]) {
          for (const link of li.querySelectorAll(selector)) { const v = clean(link).toLowerCase(); if (/^[a-z][a-z\s'-]*$/.test(v)) values.push(v); }
        }
        const item = li.cloneNode(true);
        [...item.children].filter(n => n.matches('dl,ul')).forEach(n => n.remove());
        if (clean(item)) definitions.push({ definition: clean(item), example: '' });
      }
      if (definitions.length) meanings.push({ partOfSpeech: clean(h).replace(/\s+\d+$/, '').toLowerCase(), definitions });
    }
    const audios = [...root.querySelectorAll('audio source,audio[src]')].map(n => audioUrl(n.getAttribute('src'))).filter(v => v && new URL(v).hostname === 'upload.wikimedia.org');
    return { meanings, synonyms: [...new Set(synonyms)].slice(0, 8), antonyms: [...new Set(antonyms)].slice(0, 5),
      etymology, phonetic: clean(root.querySelector('.IPA')), audios,
      linked: clean(root.querySelector('.form-of-definition-link a,a.form-of-definition-link')).toLowerCase(),
      rich: Boolean(audios.length || root.querySelector('.IPA,ol')) };
  }
  async function requestJson(url) {
    try {
      const response = await window.fetch(url, { credentials: 'omit', signal: window.AbortSignal.timeout(10000) });
      if (!response.ok) {
        const code = response.status === 404 ? 'NOT_FOUND' : response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR';
        throw Object.assign(new Error(code === 'NOT_FOUND' ? 'Word not found. Check the spelling.' : code === 'RATE_LIMITED' ? 'Dictionary rate limit reached. Try again later.' : `Dictionary request failed (${response.status}).`), { code });
      }
      const result = await response.json();
      if (result?.error) throw Object.assign(new Error('Word not found. Check the spelling.'), { code: 'NOT_FOUND' });
      return result;
    } catch (error) {
      if (['NOT_FOUND', 'RATE_LIMITED', 'HTTP_ERROR'].includes(error.code)) throw error;
      throw Object.assign(new Error('Dictionary network request failed. Please try again.', { cause: error }), { code: 'NETWORK_ERROR' });
    }
  }
  async function providers(word) {
    const [dictionary, wiki] = await Promise.allSettled([
      requestJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
      requestJson(`https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json&origin=*`)
    ]);
    const entries = dictionary.status === 'fulfilled' && Array.isArray(dictionary.value) ? dictionary.value : [];
    const details = wikiDetails(wiki.status === 'fulfilled' ? wiki.value?.parse?.text?.['*'] ?? '' : '');
    return { dictionary, entries, details };
  }
  function candidates(entries, details) {
    const urls = entries.flatMap(e => e.phonetics ?? []).map(p => audioUrl(p.audio)).filter(Boolean);
    urls.sort((a, b) => Number(/-(us|uk)\.mp3(?:\?|$)/i.test(b)) - Number(/-(us|uk)\.mp3(?:\?|$)/i.test(a)));
    return [...new Set([...urls.slice(0, 3), ...details.audios.slice(0, 3)])];
  }
  async function lookupWord(rawWord, bookSource = '', seen = new Set()) {
    if (typeof rawWord !== 'string' || !rawWord.trim() || rawWord.trim().length > 100 || /[\u0000-\u001f]/.test(rawWord)) throw new TypeError('Enter a word of 1–100 characters');
    text(bookSource, 'book source', 1000);
    const word = rawWord.trim().toLowerCase(); seen.add(word);
    const { dictionary, entries, details } = await providers(word);
    const valid = v => typeof v === 'string' && /^[a-z][a-z'-]{0,99}$/.test(v) && v !== word;
    let lemma = valid(details.linked) ? details.linked : null;
    for (const e of entries) for (const source of e.sourceUrls ?? []) {
      if (lemma) break;
      try { const url = new URL(source), value = decodeURIComponent(url.pathname.replace(/^\/wiki\//, '')).toLowerCase(); if (url.hostname === 'en.wiktionary.org' && valid(value)) lemma = value; } catch { /* Malformed provider link. */ }
    }
    const rich = entries.some(e => e.phonetic || e.phonetics?.some(p => p.text || p.audio)) || details.rich;
    if (!lemma && !rich) {
      if (word === 'stymied') lemma = 'stymie';
      else if (/i(?:ed|es)$/.test(word)) lemma = word.slice(0, -3) + 'y';
      else if (/ing$/.test(word) && word.length > 4) lemma = word.slice(0, -3) + 'e';
      else if (/ed$/.test(word) && word.length > 3) lemma = word.slice(0, -1);
      else if (/s$/.test(word) && !/ss$/.test(word) && word.length > 3) lemma = word.slice(0, -1);
    }
    const roots = lemma ? [lemma, ...(/ied$/.test(word) ? [word.slice(0, -1)] : []), ...(/ing$/.test(word) ? [word.slice(0, -3).replace(/([b-df-hj-np-tv-z])\1$/, '$1')] : []), ...(/ed$/.test(word) ? [word.slice(0, -2).replace(/([b-df-hj-np-tv-z])\1$/, '$1')] : [])] : [];
    for (const root of roots) {
      if (seen.has(root) || seen.size >= 5) continue;
      try { return { ...await lookupWord(root, bookSource, seen), inflectedForm: word }; }
      catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    }
    if (!entries.length && !details.meanings.length) {
      if (dictionary.status === 'rejected' && dictionary.reason.code !== 'NOT_FOUND') throw dictionary.reason;
      throw Object.assign(new Error('Word not found. Check the spelling.'), { code: 'NOT_FOUND' });
    }
    const rawMeanings = entries.flatMap(e => e.meanings ?? []), phonetics = entries.flatMap(e => e.phonetics ?? []);
    const related = key => [...new Set(rawMeanings.flatMap(m => [...(m[key] ?? []), ...(m.definitions ?? []).flatMap(d => d[key] ?? [])]).filter(v => typeof v === 'string'))].slice(0, key === 'synonyms' ? 8 : 5);
    const result = { id: `${word}_${uuid()}`, word, displayWord: word[0].toUpperCase() + word.slice(1),
      phonetic: entries.find(e => e.phonetic)?.phonetic || phonetics.find(p => p.text)?.text || details.phonetic,
      audioUrl: candidates(entries, details)[0] ?? '', etymology: details.etymology || clean(parseHtml(entries.find(e => e.origin)?.origin ?? '')),
      meanings: rawMeanings.length ? rawMeanings.map(m => ({ partOfSpeech: m.partOfSpeech || '', definitions: (m.definitions ?? []).map(d => ({ definition: d.definition || '', example: d.example || '' })) })) : details.meanings,
      synonyms: related('synonyms').length ? related('synonyms') : details.synonyms, antonyms: related('antonyms').length ? related('antonyms') : details.antonyms,
      bookSource: bookSource.trim(), createdAt: new Date().toISOString(), review: initialReview() };
    validateWords([result]); return result;
  }
  function shuffle(items) {
    const values = [...items];
    for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
    return values;
  }
  function cloze(sentence, word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return sentence.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu'), '_______');
  }
  const pendingAudio = new Map();
  function verifyAudio(url) {
    if (!audioUrl(url) || typeof window.Audio !== 'function') return Promise.resolve(false);
    return new Promise(resolve => {
      const clip = new window.Audio();
      let settled = false;
      const finish = ready => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); clip.oncanplay = clip.onerror = null; clip.pause(); clip.removeAttribute('src'); clip.load(); resolve(ready);
      };
      const timer = setTimeout(() => finish(false), 10000);
      clip.preload = 'auto'; clip.oncanplay = () => finish(true); clip.onerror = () => finish(false); clip.src = url; clip.load();
    });
  }
  async function resolveAudio(word) {
    if (typeof word !== 'string' || !/^[a-z][a-z'-]{0,99}$/.test(word)) throw new TypeError('Invalid pronunciation word');
    const record = await access(s => s.words.find(w => w.word === word));
    if (!record) throw new Error('Word not found');
    const savedReady = await verifyAudio(record.audioUrl);
    let urls = savedReady ? [record.audioUrl] : [];
    if (!savedReady) { const { entries, details } = await providers(word); urls = candidates(entries, details); }
    for (const url of urls) {
      if (!url || !(savedReady && url === record.audioUrl) && !(await verifyAudio(url))) continue;
      const retained = await access(s => { const w = s.words.find(w => w.id === record.id && w.word === word); if (!w) return false; w.audioUrl = url; return true; }, true);
      return retained ? { status: 'ready', dataUrl: url } : { status: 'unavailable' };
    }
    return { status: 'unavailable' };
  }
  const api = {
    loadWords: () => access(s => s.words),
    saveWords: words => access(s => { s.words = validateWords(copy(words)); cleanup(s); return true; }, true),
    addWord: word => access(s => { const w = validateWords([copy(word)])[0]; s.words.push(w); return s.words; }, true),
    removeWord: wordId => access(s => { id(wordId); s.words = s.words.filter(w => w.id !== wordId); cleanup(s); return s.words; }, true),
    reviewWord: (wordId, rating) => access(s => { const w = requireWord(s, wordId); w.review = nextReview(w.review, rating); return s.words; }, true),
    getDueWordsQueue: () => access(s => s.words.filter(w => Date.parse(w.review.nextReviewDate) <= Date.now()).sort((a, b) => Date.parse(a.review.nextReviewDate) - Date.parse(b.review.nextReviewDate))),
    getReviewStats: () => access(s => { const mastered = s.words.filter(w => w.review.box === 5).length; return { total: s.words.length, due: s.words.filter(w => Date.parse(w.review.nextReviewDate) <= Date.now()).length, mastered, learning: s.words.length - mastered }; }),
    exportData: () => access(s => s),
    importData: payload => access(s => {
      const imported = Array.isArray(payload) ? { version: 1, words: payload, collections: [], associations: [], quizHistory: [] } : payload;
      Object.assign(s, validateLibrary(imported)); return true;
    }, true),
    lookupWord,
    getCollections: () => access(s => s.collections.map(c => ({ ...c, wordCount: s.words.filter(w => w.collections.includes(c.id)).length }))),
    createCollection: ({ name, description = '', colorAccent = '' }) => access(s => {
      if (!text(name, 'collection').trim()) throw new TypeError('Invalid collection'); text(description, 'description'); text(colorAccent, 'color accent');
      const c = { id: `col_${uuid()}`, name: name.trim(), description, colorAccent, createdAt: new Date().toISOString() }; s.collections.push(c); return c;
    }, true),
    deleteCollection: colId => access(s => { id(colId); const found = s.collections.some(c => c.id === colId); s.collections = s.collections.filter(c => c.id !== colId); s.words.forEach(w => { w.collections = w.collections.filter(c => c !== colId); }); return found; }, true),
    assignWordToCollection: (wordId, colId) => access(s => { const w = requireWord(s, wordId); if (!s.collections.some(c => c.id === colId)) throw new Error('Collection not found'); if (w.collections.includes(colId)) return false; w.collections.push(colId); return true; }, true),
    removeWordFromCollection: (wordId, colId) => access(s => { const w = requireWord(s, wordId), found = w.collections.includes(colId); w.collections = w.collections.filter(c => c !== colId); return found; }, true),
    getAllTags: () => access(s => { const counts = new Map(); for (const w of s.words) for (const t of w.tags) counts.set(t, (counts.get(t) ?? 0) + 1); return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => ({ tag, count })); }),
    setWordTags: (wordId, tags) => access(s => { if (!Array.isArray(tags)) throw new TypeError('Invalid tags'); requireWord(s, wordId).tags = [...new Set(tags.map(tagName).filter(Boolean))]; return true; }, true),
    toggleFavorite: wordId => access(s => { const w = requireWord(s, wordId); return (w.isFavorite = !w.isFavorite); }, true),
    addAssociation: (a, b, note = '') => access(s => { const [wordId1, wordId2] = pair(a, b); requireWord(s, a); requireWord(s, b); text(note, 'association note'); const old = s.associations.find(v => v.wordId1 === wordId1 && v.wordId2 === wordId2); if (old) old.note = note; else s.associations.push({ wordId1, wordId2, note, createdAt: new Date().toISOString() }); return { success: true, association: { wordId1, wordId2, note } }; }, true),
    removeAssociation: (a, b) => access(s => { const [x, y] = pair(a, b); s.associations = s.associations.filter(v => v.wordId1 !== x || v.wordId2 !== y); return { success: true }; }, true),
    getAssociations: wordId => access(s => associations(s, wordId)),
    getConnectionsNeighborhood: (wordId, limit = 10) => access(s => {
      if (!Number.isInteger(limit) || limit < 0 || limit > 100) throw new TypeError('Sample limit must be an integer between 0 and 100');
      const center = requireWord(s, wordId), node = w => { const data = { word: w.word, bookSource: w.bookSource, review: w.review }; return { id: w.id, type: 'word', label: w.displayWord, ...data, data }; };
      const nodes = [node(center)], links = [];
      const hub = (hubId, type, label, members) => { const sampleWords = [...members].sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit).map(w => ({ id: w.id, word: w.word, displayWord: w.displayWord })); nodes.push({ id: hubId, type, label, totalCount: members.length, sampleWords, data: { memberCount: members.length, sampleWords } }); links.push({ source: wordId, target: hubId, type }); };
      if (center.bookSource.trim()) hub(`src:${encodeURIComponent(center.bookSource)}`, 'source', center.bookSource, s.words.filter(w => w.bookSource === center.bookSource));
      for (const t of center.tags) hub(`tag:${t}`, 'tag', `#${t}`, s.words.filter(w => w.tags.includes(t)));
      for (const c of s.collections.filter(c => center.collections.includes(c.id))) hub(`shelf:${c.id}`, 'shelf', c.name, s.words.filter(w => w.collections.includes(c.id)));
      for (const a of associations(s, wordId)) { nodes.push(node(requireWord(s, a.associatedWordId))); links.push({ source: wordId, target: a.associatedWordId, type: 'association', note: a.note }); }
      return { centerId: wordId, nodes, links };
    }),
    generateQuiz: (mode, { collectionId = null, tag = null, favoritesOnly = false, limit = 5 } = {}) => access(s => {
      if (!['definition', 'cloze', 'missing_letters'].includes(mode)) throw new TypeError('Invalid quiz mode');
      if (!Number.isInteger(limit) || limit < 5 || limit > 10) throw new TypeError('Quiz limit must be between 5 and 10');
      if (collectionId !== null && typeof collectionId !== 'string' || tag !== null && typeof tag !== 'string' || typeof favoritesOnly !== 'boolean') throw new TypeError('Invalid quiz filter');
      const questions = [];
      for (const w of shuffle(s.words.filter(w => (!collectionId || w.collections.includes(collectionId)) && (tag === null || w.tags.includes(tagName(tag))) && (!favoritesOnly || w.isFavorite)))) {
        const entry = w.meanings.flatMap(m => m.definitions.map(d => ({ ...d, partOfSpeech: m.partOfSpeech }))).find(d => d.definition.trim() && (mode !== 'cloze' || cloze(d.example, w.word) !== d.example));
        if (!entry) continue;
        const base = { id: `q_${uuid()}`, mode, wordId: w.id };
        if (mode === 'missing_letters') {
          const letters = Array.from(w.word), indexes = letters.map((v, i) => /\p{L}/u.test(v) ? i : -1).filter(i => i >= 0); if (!indexes.length) continue;
          for (const i of shuffle(indexes).slice(0, Math.max(1, Math.floor(indexes.length / 3)))) letters[i] = '_';
          questions.push({ ...base, maskedWord: letters.join(' '), solution: w.word, definition: entry.definition, phonetic: w.phonetic });
        } else {
          const correct = mode === 'definition' ? entry.definition : w.word;
          const others = [...new Set(s.words.filter(v => v.id !== w.id).flatMap(v => mode === 'definition' ? v.meanings.flatMap(m => m.definitions.map(d => d.definition)) : [v.word]).filter(v => v.trim() && v !== correct))];
          if (others.length < 3) continue; const options = shuffle([correct, ...shuffle(others).slice(0, 3)]);
          questions.push({ ...base, ...(mode === 'definition' ? { prompt: w.word, phonetic: w.phonetic, partOfSpeech: entry.partOfSpeech } : { promptSentence: cloze(entry.example, w.word) }), options, correctAnswerIndex: options.indexOf(correct) });
        }
        if (questions.length === limit) break;
      }
      return questions;
    }),
    submitQuiz: (wordId, success, linkSrs) => access(s => { if (typeof success !== 'boolean' || typeof linkSrs !== 'boolean') throw new TypeError('Invalid quiz result'); const w = requireWord(s, wordId); s.quizHistory.push({ wordId, success, submittedAt: new Date().toISOString() }); if (linkSrs) { w.review = nextReview(w.review, success ? 'good' : 'again'); if (!success) w.review.nextReviewDate = new Date().toISOString(); } return true; }, true),
    getAudioDataUrl: word => access(s => audioUrl(s.words.find(w => w.word === word)?.audioUrl) || null),
    ensurePronunciation: word => { if (!pendingAudio.has(word)) pendingAudio.set(word, resolveAudio(word).finally(() => pendingAudio.delete(word))); return pendingAudio.get(word); },
    repairPronunciations: async () => {
      const words = await api.loadWords(), result = { checked: words.length, repaired: 0, available: 0, unavailable: 0 };
      for (const w of words) { try { const r = await api.ensurePronunciation(w.word); result[r.status === 'ready' ? (w.audioUrl === r.dataUrl ? 'available' : 'repaired') : 'unavailable']++; } catch { result.unavailable++; } }
      return result;
    }
  };
  // Keep every facade method Promise-based, including synchronous argument errors.
  window.vocabAPI = Object.freeze(Object.fromEntries(Object.entries(api).map(([name, method]) => [name, async (...args) => method(...args)])));
})();
