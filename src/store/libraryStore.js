'use strict';
const { calculateNextReview, getReviewStats, getDueWordsQueue } = require('../services/spacedRepetition');
const { validateWords } = require('../db/wordSchema');
class LibraryStore {
  constructor(storage) { this.storage = storage; this.words = storage.loadWords(); }
  getWords() { return structuredClone(this.words); }
  replace(words) {
    const next = structuredClone(validateWords(words));
    this.storage.saveWords(next);
    this.words = next;
    return this.getWords();
  }
  addWord(word) {
    if (this.words.some(existing => existing.word === word.word)) throw new Error('Word already saved');
    return this.replace([...this.words, word]);
  }
  removeWord(id) { return this.replace(this.words.filter(word => word.id !== id)); }
  reviewWord(id, rating, now = new Date()) {
    if (!this.words.some(word => word.id === id)) throw new Error('Word not found');
    return this.replace(this.words.map(word => word.id === id ? { ...word, review: calculateNextReview(word.review, rating, now) } : word));
  }
  getReviewStats(now) { return getReviewStats(this.words, now); }
  getDueWordsQueue(now) { return structuredClone(getDueWordsQueue(this.words, now)); }
}
module.exports = { LibraryStore };
