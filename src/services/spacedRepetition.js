'use strict';
const DAY = 86400000;
const BOX_METRICS = Object.freeze(Object.fromEntries([[1, 1, 'Daily'], [2, 3, '3 Days'], [3, 7, 'Weekly'], [4, 14, 'Fortnightly'], [5, 30, 'Mastered']].map(([box, intervalDays, label]) => [box, Object.freeze({ intervalDays, label })])));
function initialReview(now = new Date()) {
  return { box: 1, boxLabel: 'Daily', nextReviewDate: now.toISOString(), reviewCount: 0, streak: 0,
    lastRating: null, lastReviewedAt: null, intervalDays: 1 };
}
function calculateNextReview(reviewData, rating, now = new Date()) {
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) throw new TypeError('Invalid review rating');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('Invalid review date');
  const review = { ...initialReview(now), ...reviewData };
  if (!Number.isInteger(review.box) || review.box < 1 || review.box > 5) throw new TypeError('Invalid review box');
  const box = rating === 'again' ? 1 : Math.min(5, review.box + (rating === 'easy' ? 2 : rating === 'good' ? 1 : 0));
  const { intervalDays, label: boxLabel } = BOX_METRICS[box];
  return { ...review, box, boxLabel,
    intervalDays, nextReviewDate: new Date(now.getTime() + intervalDays * DAY).toISOString(),
    reviewCount: review.reviewCount + 1, streak: rating === 'again' ? 0 : review.streak + 1,
    lastRating: rating, lastReviewedAt: now.toISOString() };
}
function isDueForReview(word, now = new Date()) {
  return Date.parse(word?.review?.nextReviewDate) <= now.getTime();
}
function getDueWordsQueue(words, now = new Date()) {
  return words.filter(word => isDueForReview(word, now))
    .sort((a, b) => Date.parse(a.review.nextReviewDate) - Date.parse(b.review.nextReviewDate));
}
function getReviewStats(words, now = new Date()) {
  const mastered = words.filter(word => word.review.box === 5).length;
  return { total: words.length, due: getDueWordsQueue(words, now).length, mastered, learning: words.length - mastered };
}
module.exports = { BOX_METRICS, initialReview, calculateNextReview, isDueForReview, getDueWordsQueue, getReviewStats };
