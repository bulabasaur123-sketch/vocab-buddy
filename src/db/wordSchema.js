'use strict';
const { BOX_METRICS } = require('../services/spacedRepetition');
const isDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
function validateWords(words) {
  if (!Array.isArray(words) || words.length > 100000) throw new TypeError('Expected a word array (maximum 100000 entries)');
  const ids = new Set();
  for (const word of words) {
    const strings = ['id', 'word', 'displayWord', 'phonetic', 'audioUrl', 'etymology', 'bookSource'];
    if (!word || strings.some(key => typeof word[key] !== 'string') || !word.id || !word.word.trim() || word.word !== word.word.trim().toLowerCase() || ids.has(word.id) || !isDate(word.createdAt)) throw new TypeError('Invalid or duplicate word');
    ids.add(word.id);
    if (!Array.isArray(word.meanings) || word.meanings.some(meaning => !meaning || typeof meaning.partOfSpeech !== 'string' || !Array.isArray(meaning.definitions) || meaning.definitions.some(def => !def || typeof def.definition !== 'string' || typeof def.example !== 'string'))) throw new TypeError('Invalid meanings');
    for (const [key, max] of [['synonyms', 8], ['antonyms', 5]]) {
      if (!Array.isArray(word[key]) || word[key].length > max || word[key].some(value => typeof value !== 'string')) throw new TypeError(`Invalid ${key}`);
    }
    if (word.audioUrl) {
      let url;
      try { url = new URL(word.audioUrl); } catch { throw new TypeError('Invalid audio URL'); }
      if (url.protocol !== 'https:' || !/\.(mp3|ogg|wav)$/i.test(url.pathname)) throw new TypeError('Invalid audio URL');
    }
    if (word.inflectedForm !== undefined && (typeof word.inflectedForm !== 'string' || !word.inflectedForm.trim() || word.inflectedForm.length > 100)) throw new TypeError('Invalid inflected form');
    if (word.audioLocalPath !== undefined && word.audioLocalPath !== `${word.word}.mp3`) throw new TypeError('Invalid local audio path');
    if (word.audioSizeBytes !== undefined && (!Number.isSafeInteger(word.audioSizeBytes) || word.audioSizeBytes <= 0 || word.audioSizeBytes > 102400)) throw new TypeError('Invalid audio size');
    if (word.isFavorite !== undefined && typeof word.isFavorite !== 'boolean') throw new TypeError('Invalid favorite');
    for (const key of ['collections', 'tags']) if (word[key] !== undefined && (!Array.isArray(word[key]) || word[key].some(value => typeof value !== 'string'))) throw new TypeError(`Invalid ${key}`);
    const review = word.review;
    if (!review || !Number.isInteger(review.box) || review.box < 1 || review.box > 5 || !isDate(review.nextReviewDate) || !['reviewCount', 'streak'].every(key => Number.isSafeInteger(review[key]) && review[key] >= 0) || ![null, 'again', 'hard', 'good', 'easy'].includes(review.lastRating) || !(review.lastReviewedAt === null || isDate(review.lastReviewedAt)) || !(review.intervalDays === undefined || Number.isFinite(review.intervalDays) && review.intervalDays > 0)) throw new TypeError('Invalid review data');
    if (review.boxLabel !== undefined && review.boxLabel !== BOX_METRICS[review.box].label) throw new TypeError('Invalid box label');
  }
  return words;
}
module.exports = { validateWords };
