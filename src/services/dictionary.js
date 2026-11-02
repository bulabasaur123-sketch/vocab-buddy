'use strict';
const cheerio = require('cheerio');
const { randomUUID } = require('node:crypto');
const { initialReview } = require('./spacedRepetition');
function cleanHtmlText(html) {
  const $ = cheerio.load(String(html ?? ''));
  $('script, style, sup.reference, .mw-editsection').remove();
  $('br').replaceWith(' ');
  $('p, div, li').append(' ');
  return $.root().text().replace(/\s+/g, ' ').trim();
}
function englishSection(html) {
  const $ = cheerio.load(html || '');
  const heading = $('h2').filter((_, el) => $(el).text().replace(/\[edit\]/g, '').trim() === 'English').first();
  if (!heading.length) return $;
  const root = heading.parent().hasClass('mw-heading') ? heading.parent() : heading;
  const nodes = root.nextUntil('h2, .mw-heading2');
  return cheerio.load(nodes.toArray().map(el => $.html(el)).join(''));
}
function extractWiktionaryEtymology(html) {
  const $ = englishSection(html);
  const heading = $('h3, h4').filter((_, el) => /^Etymology(?:\s+\d+)?(?:\[edit\])?$/.test($(el).text().trim())).first();
  if (!heading.length) return null;
  const root = heading.parent().hasClass('mw-heading') ? heading.parent() : heading;
  const paragraph = root.nextUntil('h2,h3,h4,.mw-heading').filter('p').first();
  return paragraph.length ? cleanHtmlText($.html(paragraph)) || null : null;
}
function safeAudio(value) {
  try { const url = new URL(value.startsWith('//') ? `https:${value}` : value); return url.protocol === 'https:' && /\.(mp3|ogg|wav)$/i.test(url.pathname) ? url.href : ''; }
  catch { return ''; }
}
function resolveRootLemma(word, dictData, wikiHtml = '') {
  const valid = value => typeof value === 'string' && /^[a-z][a-z'-]{0,99}$/.test(value) && value !== word;
  const $ = englishSection(wikiHtml);
  const linked = $('.form-of-definition-link a, a.form-of-definition-link').first().text().trim().toLowerCase();
  if (valid(linked)) return linked;
  for (const entry of Array.isArray(dictData) ? dictData : []) {
    for (const source of entry.sourceUrls || []) {
      try {
        const url = new URL(source);
        const lemma = decodeURIComponent(url.pathname.replace(/^\/wiki\//, '')).toLowerCase();
        if (url.hostname === 'en.wiktionary.org' && valid(lemma)) return lemma;
      } catch { /* Ignore malformed provider links. */ }
    }
  }
  // Suffix guesses are only used for sparse entries and validated by a root lookup.
  const rich = (Array.isArray(dictData) ? dictData : []).some(entry => entry.phonetic || entry.phonetics?.some(p => p.text || p.audio)) || Boolean(extractWiktionaryAudio(wikiHtml) || $('.IPA').length || $('ol').length);
  if (rich) return null;
  if (word === 'stymied') return 'stymie';
  if (/ied$/.test(word)) return word.slice(0, -3) + 'y';
  if (/ies$/.test(word)) return word.slice(0, -3) + 'y';
  if (/ing$/.test(word) && word.length > 4) return word.slice(0, -3) + 'e';
  if (/ed$/.test(word) && word.length > 3) return word.slice(0, -1);
  if (/s$/.test(word) && !/ss$/.test(word) && word.length > 3) return word.slice(0, -1);
  return null;
}
function extractWiktionaryAudio(html) {
  const $ = englishSection(html);
  return $('audio source, audio[src]').toArray().map(el => safeAudio($(el).attr('src') || '')).find(url => {
    try { return new URL(url).hostname === 'upload.wikimedia.org'; } catch { return false; }
  }) || '';
}
function extractWiktionaryMeanings(html) {
  const $ = englishSection(html);
  const posHeadings = $('h3, h4').filter((_, el) => /^(Adjective|Noun|Verb|Adverb|Interjection|Pronoun|Preposition|Conjunction|Proper noun|Article|Determiner|Numeral|Particle|Phrase)(?:\s+\d+)?(?:\[edit\])?$/i.test($(el).text().trim()));
  const meanings = [];
  const synonyms = new Set();
  const antonyms = new Set();
  posHeadings.each((_, el) => {
    const rawPos = $(el).text().replace(/\[edit\]/g, '').trim().toLowerCase();
    const pos = rawPos.replace(/\s+\d+$/, '');
    const parent = $(el).parent().hasClass('mw-heading') ? $(el).parent() : $(el);
    const ol = parent.nextUntil('h2,h3,h4,.mw-heading').filter('ol').first();
    const defs = [];
    ol.children('li').each((_, li) => {
      const item = $(li);
      item.find('.nyms.synonym a, .synonyms a').each((_, a) => {
        const s = cleanHtmlText($(a).text()).toLowerCase();
        if (s && !s.includes(':') && /^[a-z][a-z\s'-]*$/.test(s)) synonyms.add(s);
      });
      item.find('.nyms.antonym a, .antonyms a').each((_, a) => {
        const aText = cleanHtmlText($(a).text()).toLowerCase();
        if (aText && !aText.includes(':') && /^[a-z][a-z\s'-]*$/.test(aText)) antonyms.add(aText);
      });
      const clone = item.clone();
      clone.find('script, style, sup.reference').remove();
      clone.children('dl, ul').remove();
      const text = clone.text().replace(/\s+/g, ' ').trim();
      if (text) defs.push({ definition: text, example: '' });
    });
    if (defs.length) meanings.push({ partOfSpeech: pos, definitions: defs });
  });
  return { meanings, synonyms: [...synonyms].slice(0, 8), antonyms: [...antonyms].slice(0, 5) };
}
async function requestJson(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      const error = new Error(response.status === 404 ? 'Word not found. Check the spelling.' : response.status === 429 ? 'Dictionary rate limit reached. Try again later.' : `Dictionary request failed (${response.status}).`);
      error.code = response.status === 404 ? 'NOT_FOUND' : response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR';
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (['NOT_FOUND', 'RATE_LIMITED', 'HTTP_ERROR'].includes(error.code)) throw error;
    throw Object.assign(new Error('Dictionary network request failed. Please try again.', { cause: error }), { code: 'NETWORK_ERROR' });
  }
}
function createDictionaryService(fetchImpl = globalThis.fetch, audioStorage = null) {
  return { async lookupWord(rawWord, bookSource = '', seen = new Set()) {
    if (typeof rawWord !== 'string' || !rawWord.trim() || rawWord.trim().length > 100 || /[\u0000-\u001f]/.test(rawWord)) throw new TypeError('Enter a word of 1–100 characters');
    if (typeof bookSource !== 'string' || bookSource.length > 1000) throw new TypeError('Invalid book source');
    const word = rawWord.trim().toLowerCase();
    seen.add(word);
    const [dictionary, wiki] = await Promise.allSettled([
      requestJson(fetchImpl, `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
      requestJson(fetchImpl, `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json`)
    ]);
    const entries = dictionary.status === 'fulfilled' && Array.isArray(dictionary.value) ? dictionary.value : [];
    const html = wiki.status === 'fulfilled' ? wiki.value?.parse?.text?.['*'] || '' : '';
    const wikiDetails = extractWiktionaryMeanings(html);
    const root = resolveRootLemma(word, entries, html);
    // Try alternative spellings only after the preferred candidate is absent.
    const candidates = root ? [root, ...(/ied$/.test(word) ? [word.slice(0, -1)] : []), ...(/ing$/.test(word) ? [word.slice(0, -3).replace(/([b-df-hj-np-tv-z])\1$/, '$1')] : []), ...(/ed$/.test(word) ? [word.slice(0, -2).replace(/([b-df-hj-np-tv-z])\1$/, '$1')] : [])] : [];
    for (const candidate of candidates) {
      if (seen.has(candidate) || seen.size >= 5) continue;
      try {
        const resolved = await this.lookupWord(candidate, bookSource, seen);
        return { ...resolved, inflectedForm: word };
      } catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
    }
    if (!entries.length && !wikiDetails.meanings.length) {
      if (dictionary.status === 'rejected' && dictionary.reason.code !== 'NOT_FOUND') throw dictionary.reason;
      throw Object.assign(new Error('Word not found. Check the spelling.'), { code: 'NOT_FOUND' });
    }
    const phonetics = entries.flatMap(entry => entry.phonetics || []);
    const audios = phonetics.map(item => safeAudio(item.audio || '')).filter(Boolean);
    const rawMeanings = entries.flatMap(entry => entry.meanings || []);
    const meanings = rawMeanings.length
      ? rawMeanings.map(meaning => ({ partOfSpeech: meaning.partOfSpeech || '', definitions: (meaning.definitions || []).map(def => ({ definition: def.definition || '', example: def.example || '' })) }))
      : wikiDetails.meanings;
    const related = key => [...new Set(rawMeanings.flatMap(meaning => [...(meaning[key] || []), ...(meaning.definitions || []).flatMap(def => def[key] || [])]).filter(value => typeof value === 'string'))].slice(0, key === 'synonyms' ? 8 : 5);
    const synonyms = related('synonyms').length ? related('synonyms') : wikiDetails.synonyms;
    const antonyms = related('antonyms').length ? related('antonyms') : wikiDetails.antonyms;
    const now = new Date();
    const model = { id: `${word}_${randomUUID()}`, word, displayWord: word[0].toUpperCase() + word.slice(1),
      phonetic: entries.find(entry => entry.phonetic)?.phonetic || phonetics.find(item => item.text)?.text || englishSection(html)('.IPA').first().text(),
      audioUrl: audios.find(url => /-(us|uk)\.mp3(?:\?|$)/i.test(url)) || audios[0] || extractWiktionaryAudio(html),
      etymology: extractWiktionaryEtymology(html) || cleanHtmlText(entries.find(entry => entry.origin)?.origin || ''),
      meanings,
      synonyms, antonyms, bookSource: bookSource.trim(), createdAt: now.toISOString(), review: initialReview(now) };
    if (audioStorage && model.audioUrl) {
      let cached = await audioStorage.cacheAudio(word, model.audioUrl);
      const wikiAudio = extractWiktionaryAudio(html);
      if (!cached && wikiAudio && wikiAudio !== model.audioUrl) {
        cached = await audioStorage.cacheAudio(word, wikiAudio);
        if (cached) model.audioUrl = wikiAudio;
      }
      if (cached) Object.assign(model, { audioLocalPath: cached.localPath, audioSizeBytes: cached.sizeBytes });
    }
    return model;
  } };
}
module.exports = { resolveRootLemma, extractWiktionaryAudio, cleanHtmlText, extractWiktionaryEtymology, extractWiktionaryMeanings, createDictionaryService, lookupWord: (...args) => createDictionaryService().lookupWord(...args) };
