'use strict';

/**
 * Vocab Buddy — Showcase Dataset
 * Curated entries showcasing Lexicon, Leitner SRS Cadence, Shelves, Tags, and Connections.
 */

function getShowcaseData(now = new Date()) {
  const dayMs = 86400000;

  const shelves = [
    {
      id: 'col_gothic',
      name: 'Gothic & Victorian Classics',
      description: 'Dark romances, moral decay, and atmospheric prose from 19th-century literature.',
      colorAccent: '#852B3B',
      createdAt: new Date(now.getTime() - 10 * dayMs).toISOString()
    },
    {
      id: 'col_stoic',
      name: 'Stoic & Contemplative Philosophy',
      description: 'Meditative inquiries on impermanence, duty, and human character.',
      colorAccent: '#4A5B6C',
      createdAt: new Date(now.getTime() - 8 * dayMs).toISOString()
    },
    {
      id: 'col_sensory',
      name: 'Sensory & Poetic Language',
      description: 'Words evoking atmospheric textures, sounds, and natural phenomena.',
      colorAccent: '#6C584C',
      createdAt: new Date(now.getTime() - 6 * dayMs).toISOString()
    },
    {
      id: 'col_rhetoric',
      name: 'Rhetoric & Discourse',
      description: 'Precision terms for arguments, discussions, and intellectual debate.',
      colorAccent: '#5C6B50',
      createdAt: new Date(now.getTime() - 4 * dayMs).toISOString()
    },
    {
      id: 'col_speculative',
      name: 'Speculative Fiction & Sci-Fi',
      description: 'World-building terms, foresight, and far-future politics.',
      colorAccent: '#70587C',
      createdAt: new Date(now.getTime() - 2 * dayMs).toISOString()
    }
  ];

  const words = [
    {
      id: 'w_ephemeral',
      word: 'ephemeral',
      displayWord: 'Ephemeral',
      inflectedForm: 'ephemerally',
      bookSource: 'Meditations by Marcus Aurelius',
      phonetic: '/ɪˈfɛm(ə)ɹəl/',
      audioUrl: '',
      audioLocalPath: 'ephemeral.mp3',
      audioSizeBytes: 16341,
      etymology: "From Ancient Greek ἐφήμερος (ephēmeros), from ἐπί (epí, 'on') + ἡμέρα (hēméra, 'day').",
      meanings: [{
        partOfSpeech: 'adjective',
        definitions: [{
          definition: 'Lasting for a very short time; fleeting or transient.',
          example: 'Fame in the eyes of men is ephemeral.'
        }]
      }],
      synonyms: ['transient', 'fleeting', 'evanescent'],
      antonyms: ['eternal', 'permanent'],
      createdAt: new Date(now.getTime() - 7 * dayMs).toISOString(),
      isFavorite: true,
      collections: ['col_stoic', 'col_sensory'],
      tags: ['philosophy', 'time', 'aesthetics'],
      review: {
        box: 1,
        boxLabel: 'Daily',
        nextReviewDate: new Date(now.getTime() - 1000).toISOString(), // Due today!
        reviewCount: 1,
        streak: 0,
        lastRating: 'again',
        lastReviewedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
        intervalDays: 1
      }
    },
    {
      id: 'w_mellifluous',
      word: 'mellifluous',
      displayWord: 'Mellifluous',
      inflectedForm: 'mellifluously',
      bookSource: 'The Picture of Dorian Gray',
      phonetic: '/məˈlɪf.lu.əs/',
      audioUrl: '',
      audioLocalPath: 'mellifluous.mp3',
      audioSizeBytes: 22153,
      etymology: "From Late Latin mellifluus ('flowing with honey'), from mel ('honey') + fluere ('to flow').",
      meanings: [{
        partOfSpeech: 'adjective',
        definitions: [{
          definition: 'Having a smooth, rich flow; sweet or musical; pleasant to hear.',
          example: 'Lord Henry spoke in a low, mellifluous voice that held everyone spellbound.'
        }]
      }],
      synonyms: ['dulcet', 'honeyed', 'euphonic'],
      antonyms: ['cacophonous', 'strident'],
      createdAt: new Date(now.getTime() - 6 * dayMs).toISOString(),
      isFavorite: false,
      collections: ['col_gothic', 'col_sensory'],
      tags: ['sensory', 'literature', 'aesthetics'],
      review: {
        box: 1,
        boxLabel: 'Daily',
        nextReviewDate: new Date(now.getTime() - 2000).toISOString(), // Due today!
        reviewCount: 2,
        streak: 0,
        lastRating: 'hard',
        lastReviewedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
        intervalDays: 1
      }
    },
    {
      id: 'w_prescience',
      word: 'prescience',
      displayWord: 'Prescience',
      inflectedForm: 'prescient',
      bookSource: 'Dune',
      phonetic: '/ˈprɛs.i.əns/',
      audioUrl: '',
      etymology: "From Late Latin praescientia, from prae ('before') + sciēns ('knowing').",
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [{
          definition: 'The fact of knowing something before it takes place; foreknowledge.',
          example: 'The spice gave Paul terrible prescience of wars across galaxies.'
        }]
      }],
      synonyms: ['foreknowledge', 'foresight', 'clairvoyance'],
      antonyms: ['hindsight'],
      createdAt: new Date(now.getTime() - 5 * dayMs).toISOString(),
      isFavorite: true,
      collections: ['col_speculative', 'col_rhetoric'],
      tags: ['philosophy', 'literature', 'time'],
      review: {
        box: 1,
        boxLabel: 'Daily',
        nextReviewDate: new Date(now.getTime() - 500).toISOString(), // Due today!
        reviewCount: 0,
        streak: 0,
        lastRating: null,
        lastReviewedAt: null,
        intervalDays: 1
      }
    },
    {
      id: 'w_serendipity',
      word: 'serendipity',
      displayWord: 'Serendipity',
      bookSource: 'The Three Princes of Serendip',
      phonetic: '/ˌsɛɹənˈdɪpɪti/',
      audioUrl: '',
      audioLocalPath: 'serendipity.mp3',
      audioSizeBytes: 37359,
      etymology: "Coined by Horace Walpole in 1754, from the Persian fairy tale 'The Three Princes of Serendip'.",
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [{
          definition: 'The occurrence of a fortunate discovery by chance.',
          example: 'Finding the lost manuscript in the bookstore was pure serendipity.'
        }]
      }],
      synonyms: ['chance', 'fortune', 'providence'],
      antonyms: ['misfortune'],
      createdAt: new Date(now.getTime() - 8 * dayMs).toISOString(),
      isFavorite: true,
      collections: ['col_sensory'],
      tags: ['philosophy', 'aesthetics', 'chance'],
      review: {
        box: 2,
        boxLabel: '3 Days',
        nextReviewDate: new Date(now.getTime() + 2 * dayMs).toISOString(),
        reviewCount: 3,
        streak: 1,
        lastRating: 'good',
        lastReviewedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
        intervalDays: 3
      }
    },
    {
      id: 'w_tumultuous',
      word: 'tumultuous',
      displayWord: 'Tumultuous',
      inflectedForm: 'tumultuously',
      bookSource: 'The Shadow of the Wind',
      phonetic: '/tjuːˈmʌl.tʃu.əs/',
      audioUrl: '',
      audioLocalPath: 'tumultuous.mp3',
      audioSizeBytes: 32959,
      etymology: "From Latin tumultuōsus, from tumultus ('commotion, uproar').",
      meanings: [{
        partOfSpeech: 'adjective',
        definitions: [{
          definition: 'Making a loud, confused noise; uproarious; excited, confused, or disorderly.',
          example: 'He stepped out into the tumultuous streets of the old Gothic Quarter.'
        }]
      }],
      synonyms: ['turbulent', 'chaotic', 'tempestuous'],
      antonyms: ['peaceful', 'tranquil'],
      createdAt: new Date(now.getTime() - 5 * dayMs).toISOString(),
      isFavorite: false,
      collections: ['col_gothic'],
      tags: ['emotion', 'literature', 'sensory'],
      review: {
        box: 2,
        boxLabel: '3 Days',
        nextReviewDate: new Date(now.getTime() + 3 * dayMs).toISOString(),
        reviewCount: 2,
        streak: 1,
        lastRating: 'good',
        lastReviewedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
        intervalDays: 3
      }
    },
    {
      id: 'w_petrichor',
      word: 'petrichor',
      displayWord: 'Petrichor',
      bookSource: 'The Book of Disquiet',
      phonetic: '/ˈpɛt.ɹɪ.kɔː/',
      audioUrl: '',
      etymology: "Coined in 1964 by CSIRO researchers Bear and Thomas, from Ancient Greek πέτρα ('stone') + ἰχώρ ('fluid of the gods').",
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [{
          definition: 'The pleasant, earthy smell that frequently accompanies the first rain after warm weather.',
          example: 'The Lisbon cobblestones steamed with fresh petrichor under the twilight shower.'
        }]
      }],
      synonyms: ['earthiness', 'rain-scent'],
      antonyms: [],
      createdAt: new Date(now.getTime() - 10 * dayMs).toISOString(),
      isFavorite: true,
      collections: ['col_sensory'],
      tags: ['sensory', 'nature', 'aesthetics'],
      review: {
        box: 3,
        boxLabel: 'Weekly',
        nextReviewDate: new Date(now.getTime() + 5 * dayMs).toISOString(),
        reviewCount: 4,
        streak: 2,
        lastRating: 'good',
        lastReviewedAt: new Date(now.getTime() - 2 * dayMs).toISOString(),
        intervalDays: 7
      }
    },
    {
      id: 'w_dalliance',
      word: 'dalliance',
      displayWord: 'Dalliance',
      inflectedForm: 'dallied',
      bookSource: 'The Picture of Dorian Gray',
      phonetic: '/ˈdæl.i.əns/',
      audioUrl: '',
      audioLocalPath: 'dalliance.mp3',
      audioSizeBytes: 15399,
      etymology: "From Anglo-Norman dalier ('to talk, chatter, waste time').",
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [{
          definition: 'A casual romantic relationship; or a period of brief involvement with something frivolous.',
          example: 'Their summer dalliance caused no small scandal in the London drawing rooms.'
        }]
      }],
      synonyms: ['flirtation', 'trifle', 'amusement'],
      antonyms: ['commitment', 'fidelity'],
      createdAt: new Date(now.getTime() - 9 * dayMs).toISOString(),
      isFavorite: false,
      collections: ['col_gothic'],
      tags: ['literature', 'emotion', 'aesthetics'],
      review: {
        box: 3,
        boxLabel: 'Weekly',
        nextReviewDate: new Date(now.getTime() + 6 * dayMs).toISOString(),
        reviewCount: 3,
        streak: 2,
        lastRating: 'good',
        lastReviewedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
        intervalDays: 7
      }
    },
    {
      id: 'w_dulcet',
      word: 'dulcet',
      displayWord: 'Dulcet',
      bookSource: 'The Picture of Dorian Gray',
      phonetic: '/ˈdʌl.sɪt/',
      audioUrl: '',
      etymology: "From Old French doucet, diminutive of doux ('sweet'), from Latin dulcis.",
      meanings: [{
        partOfSpeech: 'adjective',
        definitions: [{
          definition: 'Sweet and soothing to the ear (often used of sound or voice).',
          example: 'The dulcet tones of the piano drifted across the evening terrace.'
        }]
      }],
      synonyms: ['mellifluous', 'melodious', 'harmonious'],
      antonyms: ['jarring', 'grating'],
      createdAt: new Date(now.getTime() - 8 * dayMs).toISOString(),
      isFavorite: false,
      collections: ['col_gothic', 'col_sensory'],
      tags: ['sensory', 'literature', 'aesthetics'],
      review: {
        box: 3,
        boxLabel: 'Weekly',
        nextReviewDate: new Date(now.getTime() + 7 * dayMs).toISOString(),
        reviewCount: 4,
        streak: 2,
        lastRating: 'good',
        lastReviewedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
        intervalDays: 7
      }
    },
    {
      id: 'w_equanimity',
      word: 'equanimity',
      displayWord: 'Equanimity',
      bookSource: 'Meditations by Marcus Aurelius',
      phonetic: '/ˌɛk.wəˈnɪm.ɪ.ti/',
      audioUrl: '',
      etymology: "From Latin aequanimitās, from aequus ('even, equal') + animus ('mind, spirit').",
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [{
          definition: 'Mental calmness, composure, and evenness of temper, especially in a difficult situation.',
          example: 'Accept whatever happens with unwavering equanimity.'
        }]
      }],
      synonyms: ['composure', 'serenity', 'tranquility'],
      antonyms: ['anxiety', 'agitation'],
      createdAt: new Date(now.getTime() - 12 * dayMs).toISOString(),
      isFavorite: false,
      collections: ['col_stoic'],
      tags: ['philosophy', 'emotion', 'stoicism'],
      review: {
        box: 4,
        boxLabel: 'Fortnightly',
        nextReviewDate: new Date(now.getTime() + 12 * dayMs).toISOString(),
        reviewCount: 6,
        streak: 4,
        lastRating: 'good',
        lastReviewedAt: new Date(now.getTime() - 2 * dayMs).toISOString(),
        intervalDays: 14
      }
    },
    {
      id: 'w_apoplectic',
      word: 'apoplectic',
      displayWord: 'Apoplectic',
      bookSource: 'Vanity Fair',
      phonetic: '/ˌæp.əˈplɛk.tɪk/',
      audioUrl: '',
      audioLocalPath: 'apoplectic.mp3',
      audioSizeBytes: 15586,
      etymology: "From Ancient Greek ἀποπληκτικός (apoplēktikós, 'struck down, disabled').",
      meanings: [{
        partOfSpeech: 'adjective',
        definitions: [{
          definition: 'Overcome with anger; extremely furious; liable to or resembling apoplexy.',
          example: 'Sir Pitt turned apoplectic with rage when the carriage was delayed.'
        }]
      }],
      synonyms: ['furious', 'incensed', 'enraged'],
      antonyms: ['calm', 'collected'],
      createdAt: new Date(now.getTime() - 15 * dayMs).toISOString(),
      isFavorite: false,
      collections: ['col_rhetoric'],
      tags: ['emotion', 'literature'],
      review: {
        box: 5,
        boxLabel: 'Mastered',
        nextReviewDate: new Date(now.getTime() + 28 * dayMs).toISOString(),
        reviewCount: 10,
        streak: 5,
        lastRating: 'easy',
        lastReviewedAt: new Date(now.getTime() - 2 * dayMs).toISOString(),
        intervalDays: 30
      }
    }
  ];

  const associations = [
    { wordId1: 'w_ephemeral', wordId2: 'w_petrichor', note: 'Fleeting atmospheric scents in nature and time' },
    { wordId1: 'w_ephemeral', wordId2: 'w_serendipity', note: 'Transient beauty discovered unexpectedly' },
    { wordId1: 'w_ephemeral', wordId2: 'w_equanimity', note: 'Stoic composure before the impermanence of things' },
    { wordId1: 'w_mellifluous', wordId2: 'w_dulcet', note: 'Sweet, honeyed auditory cadence and vocal timbre' },
    { wordId1: 'w_dalliance', wordId2: 'w_mellifluous', note: 'Witty and charming conversation in Victorian drawing rooms' },
    { wordId1: 'w_serendipity', wordId2: 'w_dalliance', note: 'Playful, lighthearted coincidences' },
    { wordId1: 'w_prescience', wordId2: 'w_serendipity', note: 'Fortunate accident versus prophetic foresight' },
    { wordId1: 'w_tumultuous', wordId2: 'w_apoplectic', note: 'Violent inner commotion and explosive anger' }
  ];

  return { shelves, words, associations };
}

function applyShowcaseToStorage(storageService) {
  const { shelves, words, associations } = getShowcaseData();

  // Clean the slate
  storageService.db.exec(`
    DELETE FROM word_associations;
    DELETE FROM word_tags;
    DELETE FROM word_collections;
    DELETE FROM collections;
    DELETE FROM words;
  `);

  // 1. Insert Shelves
  for (const shelf of shelves) {
    storageService.createCollection(shelf.name, shelf.description, shelf.colorAccent);
  }
  const createdShelves = storageService.getCollections();
  const shelfIdMap = new Map();
  for (const s of createdShelves) {
    const match = shelves.find(orig => orig.name === s.name);
    if (match) shelfIdMap.set(match.id, s.id);
  }

  // 2. Insert Words
  for (const word of words) {
    const { collections, tags, isFavorite, ...coreWord } = word;
    storageService.addWord(coreWord);

    if (isFavorite) {
      storageService.toggleFavorite(word.id);
    }

    if (tags && tags.length > 0) {
      storageService.setWordTags(word.id, tags);
    }

    if (collections && collections.length > 0) {
      for (const colKey of collections) {
        const actualColId = shelfIdMap.get(colKey);
        if (actualColId) {
          storageService.assignWordToCollection(word.id, actualColId);
        }
      }
    }
  }

  // 3. Insert Mutual Personal Associations
  for (const assoc of associations) {
    storageService.addAssociation(assoc.wordId1, assoc.wordId2, assoc.note);
  }

  return {
    wordCount: words.length,
    shelfCount: shelves.length,
    assocCount: associations.length
  };
}

module.exports = { getShowcaseData, applyShowcaseToStorage };
