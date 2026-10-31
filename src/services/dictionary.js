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
  try { const url = new URL(value.startsWith('//') ? `https:${value}` : value); return url.protocol === 'https:' && /\.mp3$/i.test(url.pathname) ? url.href : ''; }
  catch { return ''; }
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
function createDictionaryService(fetchImpl = globalThis.fetch) {
  return { async lookupWord(rawWord, bookSource = '') {
    if (typeof rawWord !== 'string' || !rawWord.trim() || rawWord.trim().length > 100 || /[\u0000-\u001f]/.test(rawWord)) throw new TypeError('Enter a word of 1–100 characters');
    if (typeof bookSource !== 'string' || bookSource.length > 1000) throw new TypeError('Invalid book source');
    const word = rawWord.trim().toLowerCase();
    const [dictionary, wiki] = await Promise.allSettled([
      requestJson(fetchImpl, `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
      requestJson(fetchImpl, `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json`)
    ]);
    if (dictionary.status === 'rejected') throw dictionary.reason;
    const entries = dictionary.value;
    if (!Array.isArray(entries) || !entries.length) throw Object.assign(new Error('Word not found. Check the spelling.'), { code: 'NOT_FOUND' });
    const html = wiki.status === 'fulfilled' ? wiki.value?.parse?.text?.['*'] || '' : '';
    const phonetics = entries.flatMap(entry => entry.phonetics || []);
    const audios = phonetics.map(item => safeAudio(item.audio || '')).filter(Boolean);
    const meanings = entries.flatMap(entry => entry.meanings || []);
    const related = key => [...new Set(meanings.flatMap(meaning => [...(meaning[key] || []), ...(meaning.definitions || []).flatMap(def => def[key] || [])]).filter(value => typeof value === 'string'))].slice(0, key === 'synonyms' ? 8 : 5);
    const now = new Date();
    return { id: `${word}_${randomUUID()}`, word, displayWord: word[0].toUpperCase() + word.slice(1),
      phonetic: entries.find(entry => entry.phonetic)?.phonetic || phonetics.find(item => item.text)?.text || englishSection(html)('.IPA').first().text(),
      audioUrl: audios.find(url => /-(us|uk)\.mp3(?:\?|$)/i.test(url)) || audios[0] || '',
      etymology: extractWiktionaryEtymology(html) || cleanHtmlText(entries.find(entry => entry.origin)?.origin || ''),
      meanings: meanings.map(meaning => ({ partOfSpeech: meaning.partOfSpeech || '', definitions: (meaning.definitions || []).map(def => ({ definition: def.definition || '', example: def.example || '' })) })),
      synonyms: related('synonyms'), antonyms: related('antonyms'), bookSource: bookSource.trim(), createdAt: now.toISOString(), review: initialReview(now) };
  } };
}
module.exports = { cleanHtmlText, extractWiktionaryEtymology, createDictionaryService, lookupWord: (...args) => createDictionaryService().lookupWord(...args) };
