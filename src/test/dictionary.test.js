'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanHtmlText, extractWiktionaryEtymology, extractWiktionaryMeanings, createDictionaryService } = require('../services/dictionary');
const { validateWords } = require('../db/wordSchema');
const html = '<h2 id="English">English</h2><h3>Etymology</h3><p>From <a>Serendip</a>, coined by <b>Horace Walpole</b> in 1754.<sup class="reference">[1]</sup></p><h3>Pronunciation</h3><span class="IPA">/test/</span>';
const entries = [{ phonetics: [{ audio: 'https://audio.example/word-au.mp3' }, { text: '/ipa/', audio: 'https://audio.example/word-us.mp3' }], meanings: [{ partOfSpeech: 'noun', synonyms: ['chance', 'chance', 'fortune'], definitions: [{ definition: 'A happy discovery.', example: 'A chance encounter.', synonyms: ['luck'], antonyms: ['misfortune'] }] }] }];
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
function service(dictionary = response(entries), wiki = response({ parse: { text: { '*': html } } })) {
  return createDictionaryService(async url => url.includes('dictionaryapi.dev') ? dictionary : wiki);
}
test('Enriches serendipity acceptance case and produces a valid persisted model', async () => {
  const word = await service().lookupWord('  Serendipity ', 'The Three Princes of Serendip');
  assert.equal(word.word, 'serendipity'); assert.equal(word.displayWord, 'Serendipity'); assert.equal(word.phonetic, '/ipa/');
  assert.match(word.audioUrl, /-us.mp3$/); assert.match(word.etymology, /From Serendip.*Horace Walpole/);
  assert.equal(word.meanings[0].partOfSpeech, 'noun'); assert.equal(word.review.box, 1);
  assert.equal(word.bookSource, 'The Three Princes of Serendip'); assert.deepEqual(word.synonyms, ['chance', 'fortune', 'luck']);
  assert.deepEqual(word.antonyms, ['misfortune']); validateWords([word]);
  assert.notEqual(word.id, (await service().lookupWord('serendipity')).id);
});
test('HTML cleanup decodes entities and removes executable content and references', () => {
  assert.equal(cleanHtmlText('<style>evil</style><script>evil</script><p>A&nbsp;&amp; &#x42; &#67;<br>D</p>'), 'A & B C D');
  assert.equal(extractWiktionaryEtymology(html), 'From Serendip, coined by Horace Walpole in 1754.');
  assert.equal(extractWiktionaryEtymology('<h3>Etymology</h3><h3>Noun</h3><p>Not etymology</p>'), null);
  assert.equal(extractWiktionaryEtymology(''), null);
});
test('Handles modern heading wrappers, numbered etymology, and English language scope', () => {
  const source = '<h2>German</h2><h3>Etymology</h3><p>Wrong</p><div class="mw-heading mw-heading2"><h2>English</h2></div><div class="mw-heading mw-heading3"><h3>Etymology 1</h3><span class="mw-editsection">[edit]</span></div><p>Correct &amp; clean.</p><h2>French</h2><p>Wrong</p>';
  assert.equal(extractWiktionaryEtymology(source), 'Correct & clean.');
});
test('Wiktionary IPA fallback, missing optional data, unsafe audio filtering', async () => {
  const word = await service(response([{ phonetics: [{ audio: 'javascript:alert(1)' }], meanings: [] }])).lookupWord('word');
  assert.equal(word.phonetic, '/test/'); assert.equal(word.audioUrl, ''); assert.deepEqual(word.synonyms, []);
});
test('Optional wiki outage retains dictionary result and origin fallback', async () => {
  const dictionary = [{ ...entries[0], origin: '<b>Old English</b>' }];
  const word = await service(response(dictionary), response({}, 429)).lookupWord('word'); assert.equal(word.etymology, 'Old English');
});
for (const [status, code] of [[404, 'NOT_FOUND'], [429, 'RATE_LIMITED'], [503, 'HTTP_ERROR']]) {
  test(`Dictionary HTTP ${status} has actionable error`, async () => {
    await assert.rejects(service(response({}, status)).lookupWord('word'), error => error.code === code);
  });
}
test('Dictionary HTTP 502/503 falls back to Wiktionary meanings, IPA and audio', async () => {
  const wikiHtml = `
    <h2 id="English">English</h2>
    <h3>Etymology</h3>
    <p>From Latin tumultuosus.</p>
    <h3>Pronunciation</h3>
    <span class="IPA">/tjʊˈmʌl.tjʊ.əs/</span>
    <audio src="https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9f/En-au-tumultuous.ogg/En-au-tumultuous.ogg.mp3"></audio>
    <h3>Adjective</h3>
    <ol>
      <li>Characterized by loud, confused noise.
        <dl><dd><span class="nyms synonym"><span>Synonyms:</span> <a href="/wiki/noisy">noisy</a>, <a href="/wiki/riotous">riotous</a></span></dd></dl>
      </li>
      <li>Causing or characterized by tumult; chaotic, disorderly.</li>
    </ol>
  `;
  const parsed = extractWiktionaryMeanings(wikiHtml);
  assert.equal(parsed.meanings.length, 1);
  assert.equal(parsed.meanings[0].partOfSpeech, 'adjective');
  assert.equal(parsed.meanings[0].definitions.length, 2);
  assert.deepEqual(parsed.synonyms, ['noisy', 'riotous']);

  const word = await service(response({}, 502), response({ parse: { text: { '*': wikiHtml } } })).lookupWord('tumultuous', 'Book of Kyoshi');
  assert.equal(word.word, 'tumultuous');
  assert.equal(word.displayWord, 'Tumultuous');
  assert.equal(word.phonetic, '/tjʊˈmʌl.tjʊ.əs/');
  assert.match(word.audioUrl, /En-au-tumultuous\.ogg\.mp3$/);
  assert.equal(word.etymology, 'From Latin tumultuosus.');
  assert.equal(word.meanings[0].partOfSpeech, 'adjective');
  assert.equal(word.meanings[0].definitions[0].definition, 'Characterized by loud, confused noise.');
  assert.deepEqual(word.synonyms, ['noisy', 'riotous']);
  assert.equal(word.bookSource, 'Book of Kyoshi');
  validateWords([word]);
});
test('Network failures, malformed JSON, empty entries and invalid input reject', async () => {
  await assert.rejects(createDictionaryService(async () => { throw new Error('offline'); }).lookupWord('word'), { code: 'NETWORK_ERROR' });
  await assert.rejects(createDictionaryService(async () => { throw Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' }); }).lookupWord('word'), { code: 'NETWORK_ERROR' });
  await assert.rejects(service({ ok: true, json: async () => { throw new SyntaxError(); } }).lookupWord('word'), { code: 'NETWORK_ERROR' });
  await assert.rejects(service(response([])).lookupWord('word'), { code: 'NOT_FOUND' });
  for (const input of ['', '   ', null, 'a'.repeat(101), 'bad\nword']) await assert.rejects(service().lookupWord(input), TypeError);
  await assert.rejects(service().lookupWord('word', {}), TypeError);
});
test('Both providers start in parallel and query values are encoded', async () => {
  const calls = []; const resolvers = [];
  const dictionary = createDictionaryService((url, options) => {
    calls.push(url); assert.ok(options.signal instanceof AbortSignal);
    return new Promise(resolve => resolvers.push(resolve));
  });
  const result = dictionary.lookupWord('a&b'); assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.includes('a%26b')));
  resolvers[0](response(entries)); resolvers[1](response({})); await result;
});
