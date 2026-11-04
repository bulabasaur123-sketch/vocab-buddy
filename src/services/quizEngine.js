'use strict';
const { randomUUID, randomInt } = require('node:crypto');
const { normalizeTag } = require('./storage');
const definitions = `words w, json_each(w.meanings_json) m, json_each(m.value, '$.definitions') d`;
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
class QuizEngine {
  constructor(storage) { this.db = storage.db ?? storage; }
  generateQuiz(mode, { collectionId = null, tag = null, limit = 5 } = {}) {
    if (!['definition', 'cloze', 'missing_letters'].includes(mode)) throw new TypeError('Invalid quiz mode');
    if (!Number.isInteger(limit) || limit < 5 || limit > 10) throw new TypeError('Quiz limit must be between 5 and 10');
    if (collectionId !== null && typeof collectionId !== 'string' || tag !== null && typeof tag !== 'string') throw new TypeError('Invalid quiz filter');
    const rows = this.db.prepare(`SELECT w.id, w.word, w.phonetic, w.meanings_json FROM words w
      WHERE (? IS NULL OR EXISTS (SELECT 1 FROM word_collections c WHERE c.word_id = w.id AND c.collection_id = ?))
      AND (? IS NULL OR EXISTS (SELECT 1 FROM word_tags t WHERE t.word_id = w.id AND t.tag = ?))
      ORDER BY RANDOM()`).iterate(collectionId, collectionId, tag, tag === null ? null : normalizeTag(tag));
    const questions = [];
    for (const row of rows) {
      const meanings = JSON.parse(row.meanings_json);
      const entries = meanings.flatMap(m => m.definitions.map(d => ({ ...d, partOfSpeech: m.partOfSpeech })));
      const entry = entries.find(d => d.definition.trim() && (mode !== 'cloze' || typeof d.example === 'string' && this.cloze(d.example, row.word) !== d.example));
      if (!entry) continue;
      const base = { id: `q_${randomUUID()}`, mode, wordId: row.id };
      if (mode === 'missing_letters') {
        const letters = Array.from(row.word);
        const candidates = letters.map((letter, index) => /\p{L}/u.test(letter) ? index : -1).filter(index => index >= 0);
        if (!candidates.length) continue;
        for (const index of shuffle(candidates).slice(0, Math.max(1, Math.floor(candidates.length / 3)))) letters[index] = '_';
        questions.push({ ...base, maskedWord: letters.join(' '), solution: row.word, definition: entry.definition, phonetic: row.phonetic ?? '' });
      } else {
        const correct = mode === 'definition' ? entry.definition : row.word;
        const query = mode === 'definition'
          ? `SELECT DISTINCT json_extract(d.value, '$.definition') AS option FROM ${definitions}
            WHERE w.id != ? AND trim(json_extract(d.value, '$.definition')) != ''
            AND json_extract(d.value, '$.definition') != ? ORDER BY RANDOM() LIMIT 3`
          : 'SELECT DISTINCT word AS option FROM words WHERE id != ? AND word != ? ORDER BY RANDOM() LIMIT 3';
        const distractors = this.db.prepare(query).all(row.id, correct).map(item => item.option);
        if (distractors.length !== 3) continue;
        const options = shuffle([correct, ...distractors]);
        questions.push({ ...base, ...(mode === 'definition'
          ? { prompt: row.word, phonetic: row.phonetic ?? '', partOfSpeech: entry.partOfSpeech }
          : { promptSentence: this.cloze(entry.example, row.word) }), correctAnswerIndex: options.indexOf(correct), options });
      }
      if (questions.length >= limit) break;
    }
    return questions;
  }
  cloze(sentence, word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return sentence.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu'), '_______');
  }
}
module.exports = { QuizEngine };
