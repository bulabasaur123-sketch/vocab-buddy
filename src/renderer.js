/**
 * Vocab Buddy — Renderer Controller
 * Modern Editorial Lexicon (Stage 3 Frontend Integration)
 */

'use strict';

// Global state
const state = {
  words: [],
  activeView: 'lexicon', // 'lexicon' | 'review'
  searchQuery: '',
  statusFilter: 'all', // 'all' | 'due' | 'learning' | 'mastered'
  deckQueue: [],
  deckIndex: 0,
  isFlipped: false,
  selectedWord: null,
  activeAudio: null,
  theme: 'paper' // 'paper' | 'dark'
};

// DOM Elements
const el = {
  // Masthead & Nav
  navLexiconBtn: document.getElementById('nav-lexicon-btn'),
  navReviewBtn: document.getElementById('nav-review-btn'),
  navCountLexicon: document.getElementById('nav-count-lexicon'),
  navCountDue: document.getElementById('nav-count-due'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  btnExport: document.getElementById('btn-export'),

  // Entry Strip
  entryForm: document.getElementById('entry-form'),
  inputWord: document.getElementById('input-word'),
  inputSource: document.getElementById('input-source'),
  btnSubmit: document.getElementById('btn-submit'),
  btnSpinner: document.querySelector('.btn-spinner'),
  btnText: document.querySelector('.btn-text'),
  entryFeedback: document.getElementById('entry-feedback'),

  // Views
  viewLexicon: document.getElementById('view-lexicon'),
  viewReview: document.getElementById('view-review'),

  // Lexicon View
  searchInput: document.getElementById('search-input'),
  filterStatus: document.getElementById('filter-status'),
  lexiconGrid: document.getElementById('lexicon-grid'),
  lexiconEmpty: document.getElementById('lexicon-empty'),

  // Deck View
  deckProgressText: document.getElementById('deck-progress-text'),
  deckProgressBar: document.getElementById('deck-progress-bar'),
  indexCard: document.getElementById('index-card'),
  cardFrontBox: document.getElementById('card-front-box'),
  cardFrontSource: document.getElementById('card-front-source'),
  cardFrontWord: document.getElementById('card-front-word'),
  cardFrontPhonetic: document.getElementById('card-front-phonetic'),
  cardFrontAudio: document.getElementById('card-front-audio'),
  cardBackWord: document.getElementById('card-back-word'),
  cardBackPhonetic: document.getElementById('card-back-phonetic'),
  cardBackAudio: document.getElementById('card-back-audio'),
  cardBackEtymology: document.getElementById('card-back-etymology'),
  cardBackDefinitions: document.getElementById('card-back-definitions'),
  reviewActions: document.getElementById('review-actions'),
  deckComplete: document.getElementById('deck-complete'),
  completeSummary: document.getElementById('complete-summary'),
  btnReturnLexicon: document.getElementById('btn-return-lexicon'),

  // Colophon
  colophonTally: document.getElementById('colophon-tally'),

  // Detail Modal
  detailModal: document.getElementById('detail-modal'),
  modalWord: document.getElementById('modal-word'),
  modalPhonetic: document.getElementById('modal-phonetic'),
  modalAudioBtn: document.getElementById('modal-audio-btn'),
  modalSource: document.getElementById('modal-source'),
  modalClose: document.getElementById('modal-close'),
  modalEtymology: document.getElementById('modal-etymology'),
  modalMeanings: document.getElementById('modal-meanings'),
  modalSynonymsSection: document.getElementById('modal-synonyms-section'),
  modalSynonyms: document.getElementById('modal-synonyms'),
  modalBoxStamp: document.getElementById('modal-box-stamp'),
  modalScheduleStamp: document.getElementById('modal-schedule-stamp'),
  modalDeleteBtn: document.getElementById('modal-delete-btn')
};

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme() {
  const saved = localStorage.getItem('vocab_theme') || 'paper';
  setTheme(saved);
}

function setTheme(theme) {
  state.theme = theme;
  if (theme === 'dark') {
    document.body.classList.remove('theme-paper');
    document.body.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-paper');
  }
  localStorage.setItem('vocab_theme', theme);
}

el.btnThemeToggle.addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'paper' : 'dark');
});

// ==========================================================================
// Audio Playback
// ==========================================================================
function playAudio(audioUrl, wordText, buttonEl) {
  if (state.activeAudio) {
    state.activeAudio.pause();
    state.activeAudio = null;
  }

  if (buttonEl) buttonEl.classList.add('playing');

  const onEnd = () => {
    if (buttonEl) buttonEl.classList.remove('playing');
  };

  if (audioUrl && audioUrl.startsWith('http')) {
    const audio = new Audio(audioUrl);
    state.activeAudio = audio;
    audio.play()
      .then(() => { audio.onended = onEnd; })
      .catch(() => { fallbackSpeech(wordText, onEnd); });
  } else {
    fallbackSpeech(wordText, onEnd);
  }
}

function fallbackSpeech(wordText, callback) {
  if ('speechSynthesis' in window && wordText) {
    const utterance = new SpeechSynthesisUtterance(wordText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    utterance.onend = callback;
    utterance.onerror = callback;
    window.speechSynthesis.speak(utterance);
  } else {
    if (callback) callback();
  }
}

// ==========================================================================
// Data Layer Bridge
// ==========================================================================
async function fetchWords() {
  if (window.vocabAPI && window.vocabAPI.loadWords) {
    return window.vocabAPI.loadWords();
  }
  const raw = localStorage.getItem('vocab_fallback');
  return raw ? JSON.parse(raw) : [];
}

async function fetchStats() {
  if (window.vocabAPI && window.vocabAPI.getReviewStats) {
    return window.vocabAPI.getReviewStats();
  }
  return { total: state.words.length, due: 0, mastered: 0, learning: state.words.length };
}

async function fetchDueQueue() {
  if (window.vocabAPI && window.vocabAPI.getDueWordsQueue) {
    return window.vocabAPI.getDueWordsQueue();
  }
  return state.words.slice(0, 10);
}

async function refreshAll() {
  state.words = await fetchWords();
  const stats = await fetchStats();

  el.navCountLexicon.textContent = stats.total;
  el.navCountDue.textContent = stats.due;
  el.colophonTally.textContent = `${stats.total} entries in personal lexicon · ${stats.due} due for review · ${stats.mastered} mastered`;

  renderLexicon();
}

// ==========================================================================
// Entry Strip: Adding Words
// ==========================================================================
el.entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawWord = el.inputWord.value.trim();
  const source = el.inputSource.value.trim();

  if (!rawWord) return;

  // Check duplicate
  const exists = state.words.find(w => w.word.toLowerCase() === rawWord.toLowerCase());
  if (exists) {
    showFeedback(`"${exists.displayWord}" is already recorded in your lexicon.`);
    openDetailModal(exists);
    el.inputWord.value = '';
    el.inputSource.value = '';
    return;
  }

  // Loading state
  setEntryLoading(true);
  hideFeedback();

  try {
    let enriched;
    if (window.vocabAPI && window.vocabAPI.lookupWord) {
      enriched = await window.vocabAPI.lookupWord(rawWord, source);
      await window.vocabAPI.addWord(enriched);
    } else {
      throw new Error('Desktop service is unavailable.');
    }

    el.inputWord.value = '';
    el.inputSource.value = '';
    await refreshAll();
    showFeedback(`Recorded "${enriched.displayWord}".`);
    openDetailModal(enriched);
  } catch (err) {
    showFeedback(err.message || 'Lookup failed. Check word spelling.', true);
  } finally {
    setEntryLoading(false);
    el.inputWord.focus();
  }
});

function setEntryLoading(isLoading) {
  el.btnSubmit.disabled = isLoading;
  el.btnSpinner.classList.toggle('hidden', !isLoading);
  el.btnText.classList.toggle('hidden', isLoading);
}

function showFeedback(msg, isError = false) {
  el.entryFeedback.textContent = msg;
  el.entryFeedback.className = `entry-feedback ${isError ? 'error' : ''}`;
  el.entryFeedback.classList.remove('hidden');
}

function hideFeedback() {
  el.entryFeedback.classList.add('hidden');
}

// ==========================================================================
// Lexicon View: Render Cards & Filter
// ==========================================================================
function renderLexicon() {
  const query = state.searchQuery.toLowerCase().trim();
  const filter = state.statusFilter;
  const now = new Date();

  const filtered = state.words.filter(w => {
    if (query) {
      const matchWord = w.word.toLowerCase().includes(query);
      const matchSource = (w.bookSource || '').toLowerCase().includes(query);
      const matchDef = (w.meanings || []).some(m =>
        (m.definitions || []).some(d => (d.definition || '').toLowerCase().includes(query))
      );
      if (!matchWord && !matchSource && !matchDef) return false;
    }

    const box = w.review?.box || 1;
    const isDue = w.review?.nextReviewDate ? new Date(w.review.nextReviewDate) <= now : true;

    if (filter === 'due') return isDue;
    if (filter === 'learning') return box < 5;
    if (filter === 'mastered') return box >= 5;
    return true;
  });

  el.lexiconGrid.innerHTML = '';

  if (filtered.length === 0) {
    el.lexiconEmpty.classList.remove('hidden');
    el.lexiconGrid.classList.add('hidden');
    return;
  }

  el.lexiconEmpty.classList.add('hidden');
  el.lexiconGrid.classList.remove('hidden');

  filtered.forEach(word => {
    const card = document.createElement('article');
    card.className = 'lexicon-card';

    const firstMeaning = word.meanings?.[0] || { partOfSpeech: 'word', definitions: [{ definition: '' }] };
    const pos = firstMeaning.partOfSpeech || '';
    const def = firstMeaning.definitions?.[0]?.definition || '';
    const example = firstMeaning.definitions?.[0]?.example || '';
    const box = word.review?.box || 1;
    const isMastered = box >= 5;

    card.innerHTML = `
      <div class="card-mast">
        <h3 class="card-title-serif">${escapeHtml(word.displayWord)}</h3>
        <div class="card-meta-stamps">
          ${pos ? `<span class="pos-stamp">${escapeHtml(pos)}</span>` : ''}
          <span class="box-stamp ${isMastered ? 'mastered' : ''}">Box ${box}</span>
        </div>
      </div>

      <div class="phonetic-row">
        <span class="phonetic-mono">${escapeHtml(word.phonetic || '')}</span>
        <button type="button" class="btn-icon-audio btn-card-audio" title="Listen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <p class="card-definition">${escapeHtml(def)}</p>

      ${example ? `<div class="card-quote-preview">"${escapeHtml(example)}"</div>` : ''}

      <div class="card-foot">
        <span class="card-source-cite">${word.bookSource ? `Ref: ${escapeHtml(word.bookSource)}` : ''}</span>
        <span>${formatNextReview(word.review?.nextReviewDate)}</span>
      </div>
    `;

    // Audio button click
    const audioBtn = card.querySelector('.btn-card-audio');
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playAudio(word.audioUrl, word.word, audioBtn);
    });

    // Card click opens modal
    card.addEventListener('click', () => {
      openDetailModal(word);
    });

    el.lexiconGrid.appendChild(card);
  });
}

function formatNextReview(dateStr) {
  if (!dateStr) return 'Due today';
  const target = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

el.searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderLexicon();
});

el.filterStatus.addEventListener('change', (e) => {
  state.statusFilter = e.target.value;
  renderLexicon();
});

// ==========================================================================
// Word Detail Modal
// ==========================================================================
function openDetailModal(word) {
  state.selectedWord = word;
  el.modalWord.textContent = word.displayWord;
  el.modalPhonetic.textContent = word.phonetic || '';
  el.modalSource.textContent = word.bookSource ? `Citation source: ${word.bookSource}` : '';
  el.modalEtymology.textContent = word.etymology || 'Etymology records not available.';

  // Meanings
  el.modalMeanings.innerHTML = '';
  if (word.meanings && word.meanings.length > 0) {
    word.meanings.forEach(m => {
      const group = document.createElement('div');
      group.className = 'def-row';
      const pos = m.partOfSpeech ? `<span class="pos-tag">[${escapeHtml(m.partOfSpeech)}]</span>` : '';
      group.innerHTML = `
        ${(m.definitions || []).map(d => `
          <div style="margin-bottom: 0.5rem;">
            ${pos} ${escapeHtml(d.definition)}
            ${d.example ? `<div class="def-example-quote">"${escapeHtml(d.example)}"</div>` : ''}
          </div>
        `).join('')}
      `;
      el.modalMeanings.appendChild(group);
    });
  } else {
    el.modalMeanings.innerHTML = '<p class="text-secondary">No definitions found.</p>';
  }

  // Synonyms
  if (word.synonyms && word.synonyms.length > 0) {
    el.modalSynonymsSection.classList.remove('hidden');
    el.modalSynonyms.innerHTML = word.synonyms.map(s => `<span class="text-chip">${escapeHtml(s)}</span>`).join('');
  } else {
    el.modalSynonymsSection.classList.add('hidden');
  }

  const box = word.review?.box || 1;
  el.modalBoxStamp.textContent = `Box ${box}${box >= 5 ? ' (Mastered)' : ''}`;
  el.modalScheduleStamp.textContent = formatNextReview(word.review?.nextReviewDate);

  el.detailModal.classList.remove('hidden');
}

el.modalClose.addEventListener('click', () => {
  el.detailModal.classList.add('hidden');
});

el.detailModal.addEventListener('click', (e) => {
  if (e.target === el.detailModal) el.detailModal.classList.add('hidden');
});

el.modalAudioBtn.addEventListener('click', () => {
  if (state.selectedWord) {
    playAudio(state.selectedWord.audioUrl, state.selectedWord.word, el.modalAudioBtn);
  }
});

el.modalDeleteBtn.addEventListener('click', async () => {
  if (!state.selectedWord) return;
  const ok = confirm(`Remove "${state.selectedWord.displayWord}" from your lexicon?`);
  if (!ok) return;

  if (window.vocabAPI && window.vocabAPI.removeWord) {
    await window.vocabAPI.removeWord(state.selectedWord.id);
  }
  el.detailModal.classList.add('hidden');
  await refreshAll();
});

// ==========================================================================
// Review Deck Mode (Flashcards)
// ==========================================================================
async function startReviewSession() {
  const dueQueue = await fetchDueQueue();
  state.deckQueue = dueQueue;
  state.deckIndex = 0;
  state.isFlipped = false;

  if (state.deckQueue.length === 0) {
    el.indexCard.parentElement.classList.add('hidden');
    el.reviewActions.classList.add('hidden');
    el.deckComplete.classList.remove('hidden');
    el.completeSummary.textContent = 'All scheduled reviews are complete. No cards currently due for review.';
    return;
  }

  el.indexCard.parentElement.classList.remove('hidden');
  el.reviewActions.classList.remove('hidden');
  el.deckComplete.classList.add('hidden');
  el.indexCard.classList.remove('flipped');

  showDeckCard();
}

function showDeckCard() {
  state.isFlipped = false;
  el.indexCard.classList.remove('flipped');

  const current = state.deckQueue[state.deckIndex];
  if (!current) {
    // Session complete
    el.indexCard.parentElement.classList.add('hidden');
    el.reviewActions.classList.add('hidden');
    el.deckComplete.classList.remove('hidden');
    el.completeSummary.textContent = `Completed review of ${state.deckQueue.length} vocabulary slips today.`;
    return;
  }

  const total = state.deckQueue.length;
  const step = state.deckIndex + 1;
  el.deckProgressText.textContent = `Card ${step} of ${total}`;
  el.deckProgressBar.style.width = `${Math.round((step / total) * 100)}%`;

  // Front
  el.cardFrontBox.textContent = `Box ${current.review?.box || 1}`;
  el.cardFrontSource.textContent = current.bookSource ? `Ref: ${current.bookSource}` : '';
  el.cardFrontWord.textContent = current.displayWord;
  el.cardFrontPhonetic.textContent = current.phonetic || '';

  // Back
  el.cardBackWord.textContent = current.displayWord;
  el.cardBackPhonetic.textContent = current.phonetic || '';
  el.cardBackEtymology.textContent = current.etymology || 'Origin notes not available.';

  // Back Definitions
  el.cardBackDefinitions.innerHTML = '';
  if (current.meanings && current.meanings.length > 0) {
    current.meanings.slice(0, 2).forEach(m => {
      const def = m.definitions?.[0];
      if (def) {
        const div = document.createElement('div');
        div.className = 'def-row';
        div.innerHTML = `
          <span class="pos-tag">[${escapeHtml(m.partOfSpeech || 'word')}]</span> ${escapeHtml(def.definition)}
          ${def.example ? `<div class="def-example-quote">"${escapeHtml(def.example)}"</div>` : ''}
        `;
        el.cardBackDefinitions.appendChild(div);
      }
    });
  }
}

function flipCard() {
  state.isFlipped = !state.isFlipped;
  el.indexCard.classList.toggle('flipped', state.isFlipped);
}

el.indexCard.addEventListener('click', flipCard);

el.cardFrontAudio.addEventListener('click', (e) => {
  e.stopPropagation();
  const word = state.deckQueue[state.deckIndex];
  if (word) playAudio(word.audioUrl, word.word, el.cardFrontAudio);
});

el.cardBackAudio.addEventListener('click', (e) => {
  e.stopPropagation();
  const word = state.deckQueue[state.deckIndex];
  if (word) playAudio(word.audioUrl, word.word, el.cardBackAudio);
});

// Rating Action Handlers
el.reviewActions.querySelectorAll('.btn-rate').forEach(btn => {
  btn.addEventListener('click', () => {
    const rating = btn.getAttribute('data-rating');
    submitRating(rating);
  });
});

async function submitRating(rating) {
  if (state.isSubmittingRating) return;
  state.isSubmittingRating = true;
  try {
    const current = state.deckQueue[state.deckIndex];
    if (!current) return;

    if (window.vocabAPI && window.vocabAPI.reviewWord) {
      await window.vocabAPI.reviewWord(current.id, rating);
    }

    state.deckIndex++;
    showDeckCard();
    await refreshAll();
  } finally {
    state.isSubmittingRating = false;
  }
}

// ==========================================================================
// Keyboard Navigation
// ==========================================================================
window.addEventListener('keydown', (e) => {
  // If an input or editable field is active, do not intercept typing
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
    return;
  }

  if (!el.detailModal.classList.contains('hidden')) {
    if (e.key === 'Escape') el.detailModal.classList.add('hidden');
    return;
  }

  if (state.activeView === 'review' && !el.indexCard.parentElement.classList.contains('hidden')) {
    if (e.code === 'Space') {
      e.preventDefault();
      flipCard();
    } else if (state.isFlipped) {
      if (e.key === '1') submitRating('again');
      if (e.key === '2') submitRating('hard');
      if (e.key === '3') submitRating('good');
      if (e.key === '4') submitRating('easy');
    }
  }
});

// ==========================================================================
// View Switching
// ==========================================================================
el.navLexiconBtn.addEventListener('click', () => switchView('lexicon'));
el.navReviewBtn.addEventListener('click', () => switchView('review'));
el.btnReturnLexicon.addEventListener('click', () => switchView('lexicon'));

function switchView(viewName) {
  state.activeView = viewName;
  if (viewName === 'lexicon') {
    el.navLexiconBtn.classList.add('active');
    el.navReviewBtn.classList.remove('active');
    el.viewLexicon.classList.add('active');
    el.viewLexicon.classList.remove('hidden');
    el.viewReview.classList.remove('active');
    el.viewReview.classList.add('hidden');
    renderLexicon();
  } else if (viewName === 'review') {
    el.navReviewBtn.classList.add('active');
    el.navLexiconBtn.classList.remove('active');
    el.viewReview.classList.add('active');
    el.viewReview.classList.remove('hidden');
    el.viewLexicon.classList.remove('active');
    el.viewLexicon.classList.add('hidden');
    startReviewSession();
  }
}

// ==========================================================================
// Export Backup
// ==========================================================================
el.btnExport.addEventListener('click', async () => {
  let exportData;
  if (window.vocabAPI && window.vocabAPI.exportData) {
    exportData = await window.vocabAPI.exportData();
  } else {
    exportData = state.words;
  }
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocab-lexicon-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  refreshAll();
});
