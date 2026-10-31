'use strict';
const { initialReview } = require('../services/spacedRepetition');
function starterWords(now = new Date()) {
  return [{ id: 'serendipity_starter', word: 'serendipity', displayWord: 'Serendipity', phonetic: '/ˌsɛɹənˈdɪpɪti/', audioUrl: '',
    etymology: 'From Serendip, a historical name for Sri Lanka. Coined by Horace Walpole in 1754.',
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'The occurrence of a fortunate discovery by chance.', example: 'Finding the book was pure serendipity.' }] }],
    synonyms: ['chance', 'fortune'], antonyms: [], bookSource: '', createdAt: now.toISOString(), review: initialReview(now) }];
}
module.exports = { starterWords };
