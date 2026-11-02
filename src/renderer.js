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
  btnCadenceGuide: document.getElementById('btn-cadence-guide'),
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
  cardFrontInflected: document.getElementById('card-front-inflected'),
  cardFrontPhonetic: document.getElementById('card-front-phonetic'),
  cardFrontAudio: document.getElementById('card-front-audio'),
  cardBackWord: document.getElementById('card-back-word'),
  cardBackInflected: document.getElementById('card-back-inflected'),
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
  modalInflected: document.getElementById('modal-inflected'),
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
  modalDeleteBtn: document.getElementById('modal-delete-btn'),

  // Cadence Guide Modal
  cadenceModal: document.getElementById('cadence-modal'),
  cadenceModalClose: document.getElementById('cadence-modal-close'),
  cadenceBtnDismiss: document.getElementById('cadence-btn-dismiss')
};

// Box Cadence Helper
const BOX_CADENCE_LABELS = {
  1: 'Daily',
  2: '3 Days',
  3: 'Weekly',
  4: 'Fortnightly',
  5: 'Mastered'
};

function getBoxLabel(box) {
  return BOX_CADENCE_LABELS[box] || 'Daily';
}

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
// Audio Playback & State
// ==========================================================================
let currentAudioRequestId = 0;
let currentPlayingButton = null;

function hasAudioRecord(word) {
  if (!word) return false;
  return Boolean(word.audioUrl || word.audioLocalPath);
}

function updateAudioButtonState(button, hasAudio) {
  if (!button) return;
  if (hasAudio) {
    button.disabled = false;
    button.title = 'Listen to pronunciation';
  } else {
    button.disabled = true;
    button.title = 'No audio recording archived';
  }
}

async function playAudio(audioUrl, wordText, buttonEl) {
  // 1. Cancel and pause any active audio playback immediately
  if (state.activeAudio) {
    try {
      state.activeAudio.pause();
    } catch { /* ignore */ }
    state.activeAudio = null;
  }

  // 2. Clear playing state from previous button
  if (currentPlayingButton) {
    currentPlayingButton.classList.remove('playing');
    currentPlayingButton = null;
  }

  // 3. Increment request ID to supersede any in-flight requests
  const requestId = ++currentAudioRequestId;
  if (buttonEl) {
    currentPlayingButton = buttonEl;
    buttonEl.classList.add('playing');
  }

  const cleanup = () => {
    if (requestId === currentAudioRequestId) {
      if (buttonEl) buttonEl.classList.remove('playing');
      if (currentPlayingButton === buttonEl) currentPlayingButton = null;
      state.activeAudio = null;
    }
  };

  // 4. Try local cached lightweight audio from backend IPC
  let dataUrl = null;
  try {
    if (window.vocabAPI && window.vocabAPI.getAudioDataUrl && wordText) {
      dataUrl = await window.vocabAPI.getAudioDataUrl(wordText);
    }
  } catch (err) {
    console.debug('Local audio cache retrieval failed, checking remote URL:', err);
  }

  // If a newer audio request was made while awaiting IPC, abort!
  if (requestId !== currentAudioRequestId) {
    return;
  }

  // 5. If local cached audio found, play it
  if (dataUrl) {
    if (state.activeAudio) {
      try { state.activeAudio.pause(); } catch {}
      state.activeAudio = null;
    }
    const audio = new Audio(dataUrl);
    state.activeAudio = audio;
    audio.onended = cleanup;
    audio.onerror = cleanup;
    try {
      await audio.play();
    } catch {
      cleanup();
    }
    return;
  }

  // 6. Try remote audio URL
  if (audioUrl && audioUrl.startsWith('http')) {
    if (state.activeAudio) {
      try { state.activeAudio.pause(); } catch {}
      state.activeAudio = null;
    }
    const audio = new Audio(audioUrl);
    state.activeAudio = audio;
    audio.onended = cleanup;
    audio.onerror = cleanup;
    try {
      await audio.play();
    } catch {
      cleanup();
    }
    return;
  }

  // 7. No audio recording available
  cleanup();
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
      const matchWord = (w.word || '').toLowerCase().includes(query);
      const matchDisplay = (w.displayWord || '').toLowerCase().includes(query);
      const matchInflected = (w.inflectedForm || '').toLowerCase().includes(query);
      const matchSource = (w.bookSource || '').toLowerCase().includes(query);
      const matchDef = (w.meanings || []).some(m =>
        (m.definitions || []).some(d => (d.definition || '').toLowerCase().includes(query))
      );
      if (!matchWord && !matchDisplay && !matchInflected && !matchSource && !matchDef) return false;
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
    const boxLabel = word.review?.boxLabel || getBoxLabel(box);
    const isMastered = box >= 5;
    const isInflected = word.inflectedForm && word.inflectedForm.toLowerCase() !== word.word.toLowerCase();
    const hasAudio = hasAudioRecord(word);

    card.innerHTML = `
      <div class="card-mast">
        <h3 class="card-title-serif">${escapeHtml(word.displayWord)}</h3>
        <button type="button" class="box-stamp btn-stamp-trigger ${isMastered ? 'mastered' : ''}" title="View Leitner cadence guide">Box ${box} · ${escapeHtml(boxLabel)}</button>
      </div>

      <div class="phonetic-row">
        ${pos ? `<span class="pos-stamp">${escapeHtml(pos)}</span>` : ''}
        ${pos && word.phonetic ? `<span class="pos-divider" aria-hidden="true">·</span>` : ''}
        <span class="phonetic-mono">${escapeHtml(word.phonetic || '')}</span>
        <button type="button" class="btn-icon-audio btn-card-audio" ${hasAudio ? '' : 'disabled'} title="${hasAudio ? 'Listen to pronunciation' : 'No audio recording archived'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      ${isInflected ? `<p class="card-inflected-cite">Encountered as: <em>${escapeHtml(word.inflectedForm)}</em></p>` : ''}

      <p class="card-definition">${escapeHtml(def)}</p>

      ${example ? `<div class="card-quote-preview">"${escapeHtml(example)}"</div>` : ''}

      <div class="card-foot">
        <span class="card-source-cite">${word.bookSource ? `Ref: ${escapeHtml(word.bookSource)}` : ''}</span>
        <span>${formatNextReview(word.review?.nextReviewDate)}</span>
      </div>
    `;

    // Box cadence stamp trigger
    const stampBtn = card.querySelector('.btn-stamp-trigger');
    if (stampBtn) {
      stampBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCadenceModal(stampBtn);
      });
    }

    // Audio button click
    const audioBtn = card.querySelector('.btn-card-audio');
    if (!hasAudio && window.vocabAPI && window.vocabAPI.getAudioDataUrl && word.word) {
      window.vocabAPI.getAudioDataUrl(word.word).then(dataUrl => {
        if (dataUrl) updateAudioButtonState(audioBtn, true);
      }).catch(() => {});
    }
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!audioBtn.disabled) {
        playAudio(word.audioUrl, word.word, audioBtn);
      }
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

  // Inflected reading citation
  if (word.inflectedForm && word.inflectedForm.toLowerCase() !== word.word.toLowerCase()) {
    el.modalInflected.innerHTML = `Encountered in reading as: <em>${escapeHtml(word.inflectedForm)}</em>`;
    el.modalInflected.classList.remove('hidden');
  } else {
    el.modalInflected.classList.add('hidden');
    el.modalInflected.textContent = '';
  }

  const hasAudio = hasAudioRecord(word);
  updateAudioButtonState(el.modalAudioBtn, hasAudio);
  if (!hasAudio && window.vocabAPI && window.vocabAPI.getAudioDataUrl && word.word) {
    window.vocabAPI.getAudioDataUrl(word.word).then(dataUrl => {
      if (dataUrl && state.selectedWord === word) {
        updateAudioButtonState(el.modalAudioBtn, true);
      }
    }).catch(() => {});
  }

  const box = word.review?.box || 1;
  const boxLabel = word.review?.boxLabel || getBoxLabel(box);
  el.modalBoxStamp.textContent = `Box ${box} · ${boxLabel}`;
  el.modalScheduleStamp.textContent = formatNextReview(word.review?.nextReviewDate);

  el.detailModal.classList.remove('hidden');
}

el.modalBoxStamp.addEventListener('click', () => {
  openCadenceModal(el.modalBoxStamp);
});

function closeDetailModal() {
  if (el.detailModal) el.detailModal.classList.add('hidden');
}

el.modalClose.addEventListener('click', closeDetailModal);

el.detailModal.addEventListener('click', (e) => {
  if (e.target === el.detailModal) closeDetailModal();
});

el.modalAudioBtn.addEventListener('click', () => {
  if (state.selectedWord && !el.modalAudioBtn.disabled) {
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
  closeDetailModal();
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

  const box = current.review?.box || 1;
  const boxLabel = current.review?.boxLabel || getBoxLabel(box);

  // Front
  el.cardFrontBox.textContent = `Box ${box} · ${boxLabel}`;
  el.cardFrontBox.title = 'Click to view Leitner memory cadence guide';
  el.cardFrontSource.textContent = current.bookSource ? `Ref: ${current.bookSource}` : '';
  el.cardFrontWord.textContent = current.displayWord;
  el.cardFrontPhonetic.textContent = current.phonetic || '';

  // Inflected Form Citation
  const isInflected = current.inflectedForm && current.inflectedForm.toLowerCase() !== current.word.toLowerCase();
  if (isInflected) {
    el.cardFrontInflected.innerHTML = `Encountered as: <em>${escapeHtml(current.inflectedForm)}</em>`;
    el.cardFrontInflected.classList.remove('hidden');
    el.cardBackInflected.innerHTML = `Encountered as: <em>${escapeHtml(current.inflectedForm)}</em>`;
    el.cardBackInflected.classList.remove('hidden');
  } else {
    el.cardFrontInflected.classList.add('hidden');
    el.cardBackInflected.classList.add('hidden');
  }

  // Audio button state
  const hasAudio = hasAudioRecord(current);
  updateAudioButtonState(el.cardFrontAudio, hasAudio);
  updateAudioButtonState(el.cardBackAudio, hasAudio);
  if (!hasAudio && window.vocabAPI && window.vocabAPI.getAudioDataUrl && current.word) {
    window.vocabAPI.getAudioDataUrl(current.word).then(dataUrl => {
      if (dataUrl && state.deckQueue[state.deckIndex] === current) {
        updateAudioButtonState(el.cardFrontAudio, true);
        updateAudioButtonState(el.cardBackAudio, true);
      }
    }).catch(() => {});
  }

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

el.cardFrontBox.addEventListener('click', (e) => {
  e.stopPropagation();
  openCadenceModal(el.cardFrontBox);
});

function flipCard() {
  state.isFlipped = !state.isFlipped;
  el.indexCard.classList.toggle('flipped', state.isFlipped);
}

el.indexCard.addEventListener('click', flipCard);

el.cardFrontAudio.addEventListener('click', (e) => {
  e.stopPropagation();
  const word = state.deckQueue[state.deckIndex];
  if (word && !el.cardFrontAudio.disabled) playAudio(word.audioUrl, word.word, el.cardFrontAudio);
});

el.cardBackAudio.addEventListener('click', (e) => {
  e.stopPropagation();
  const word = state.deckQueue[state.deckIndex];
  if (word && !el.cardBackAudio.disabled) playAudio(word.audioUrl, word.word, el.cardBackAudio);
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
  // Always handle Escape for open dialogs regardless of focused field
  if (e.key === 'Escape') {
    if (el.cadenceModal && !el.cadenceModal.classList.contains('hidden')) {
      e.preventDefault();
      closeCadenceModal();
      return;
    }

    if (el.detailModal && !el.detailModal.classList.contains('hidden')) {
      e.preventDefault();
      closeDetailModal();
      return;
    }
  }

  // If an input or editable field is active, do not intercept typing
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
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
// Cadence Guide Modal Controller & Focus Management
// ==========================================================================
let cadenceReturnFocusElement = null;

function openCadenceModal(triggerEl = null) {
  if (!el.cadenceModal) return;
  cadenceReturnFocusElement = triggerEl || document.activeElement;
  el.cadenceModal.classList.remove('hidden');

  // Immediately move keyboard focus into the dialog
  const focusTarget = el.cadenceBtnDismiss || el.cadenceModalClose || el.cadenceModal.querySelector('button');
  if (focusTarget) {
    focusTarget.focus();
  }
}

function closeCadenceModal() {
  if (!el.cadenceModal || el.cadenceModal.classList.contains('hidden')) return;
  el.cadenceModal.classList.add('hidden');

  // Restore keyboard focus to the triggering element
  if (cadenceReturnFocusElement && typeof cadenceReturnFocusElement.focus === 'function' && document.contains(cadenceReturnFocusElement)) {
    try {
      cadenceReturnFocusElement.focus();
    } catch { /* ignore */ }
  }
  cadenceReturnFocusElement = null;
}

// Trap keyboard focus inside Cadence modal when open
if (el.cadenceModal) {
  el.cadenceModal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusable = el.cadenceModal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !el.cadenceModal.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !el.cadenceModal.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  el.cadenceModal.addEventListener('click', (e) => {
    if (e.target === el.cadenceModal) closeCadenceModal();
  });
}

if (el.btnCadenceGuide) el.btnCadenceGuide.addEventListener('click', () => openCadenceModal(el.btnCadenceGuide));
if (el.cadenceModalClose) el.cadenceModalClose.addEventListener('click', closeCadenceModal);
if (el.cadenceBtnDismiss) el.cadenceBtnDismiss.addEventListener('click', closeCadenceModal);

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
