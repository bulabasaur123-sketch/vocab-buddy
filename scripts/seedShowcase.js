'use strict';

const path = require('node:path');
const os = require('node:os');
const { StorageService } = require('../src/services/storage');
const { applyShowcaseToStorage } = require('../src/db/showcase');

const userDataDir = process.env.VOCAB_USER_DATA_DIR || path.join(os.homedir(), '.config', 'vocab-buddy');
console.log('Target database directory:', userDataDir);

const storage = new StorageService(userDataDir, false);
try {
  const result = applyShowcaseToStorage(storage);
  console.log('Successfully cleaned the slate and seeded the showcase library:');
  console.log(`- ${result.wordCount} words added with definitions, citations, phonetics, and Leitner review schedules.`);
  console.log(`- ${result.shelfCount} curated shelves created.`);
  console.log(`- ${result.assocCount} mutual personal associations linked.`);
} finally {
  storage.close();
}
