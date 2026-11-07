/* ==========================================================================
   Wordloom — Web Platform Hub & Peer Feedback Component
   Handles Web Preview Banner, In-App Peer Feedback Modal, Extension Guide,
   and Sample Library Reset for Cloudflare Pages deployment.
   ========================================================================== */

(function () {
  'use strict';

  // Environment check: Running in standard web browser vs Electron desktop
  const isElectron = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);

  function initWebHub() {
    const banner = document.getElementById('web-preview-banner');
    const floatingBtn = document.getElementById('btn-floating-feedback');
    const feedbackModal = document.getElementById('feedback-modal');
    const extGuideModal = document.getElementById('extension-guide-modal');

    // Only activate banner & floating pill in Web browser mode
    if (!isElectron) {
      if (banner) banner.classList.remove('hidden');
      if (floatingBtn) floatingBtn.classList.remove('hidden');
    }

    // --- Feedback Modal Triggers ---
    const btnFeedback = document.getElementById('btn-web-feedback');
    const btnFeedbackClose = document.getElementById('feedback-modal-close');
    const btnFeedbackCancel = document.getElementById('feedback-btn-cancel');
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackStatus = document.getElementById('feedback-status');
    const feedbackComments = document.getElementById('feedback-comments');
    const feedbackRole = document.getElementById('feedback-role');

    let currentRating = 5;

    function openFeedback() {
      if (!feedbackModal) return;
      feedbackModal.classList.remove('hidden');
      if (feedbackStatus) {
        feedbackStatus.classList.add('hidden');
        feedbackStatus.textContent = '';
      }
      setTimeout(() => feedbackComments?.focus(), 50);
    }

    function closeFeedback() {
      if (!feedbackModal) return;
      feedbackModal.classList.add('hidden');
    }

    btnFeedback?.addEventListener('click', openFeedback);
    floatingBtn?.addEventListener('click', openFeedback);
    btnFeedbackClose?.addEventListener('click', closeFeedback);
    btnFeedbackCancel?.addEventListener('click', closeFeedback);

    feedbackModal?.addEventListener('click', (e) => {
      if (e.target === feedbackModal) closeFeedback();
    });

    // Star Rating buttons
    const starBtns = document.querySelectorAll('.star-btn');
    starBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.value, 10) || 5;
        currentRating = val;
        starBtns.forEach(b => {
          const bVal = parseInt(b.dataset.value, 10);
          b.classList.toggle('active', bVal <= val);
        });
      });
    });

    // Feedback Form Submission
    feedbackForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const comments = (feedbackComments?.value || '').trim();
      if (!comments) return;

      const checkedCat = document.querySelector('input[name="feedback-category"]:checked');
      const category = checkedCat ? checkedCat.value : 'impression';
      const role = (feedbackRole?.value || '').trim();

      const payload = {
        id: (window.crypto?.randomUUID && window.crypto.randomUUID()) || `fb_${Date.now()}`,
        submittedAt: new Date().toISOString(),
        category,
        rating: currentRating,
        roleOrContext: role || undefined,
        comments,
        technicalContext: {
          userAgent: navigator.userAgent,
          screenDimensions: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href
        }
      };

      const submitBtn = document.getElementById('feedback-btn-submit');
      if (submitBtn) submitBtn.disabled = true;

      try {
        // Attempt sending to Cloudflare Worker endpoint
        let delivered = false;
        try {
          const res = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) delivered = true;
        } catch {
          // Network endpoint unavailable in static/local preview
          delivered = false;
        }

        // Always store in local feedback drafts for reliability
        try {
          const existing = JSON.parse(localStorage.getItem('wordloom_feedback_drafts') || '[]');
          existing.push(payload);
          localStorage.setItem('wordloom_feedback_drafts', JSON.stringify(existing));
        } catch {
          // LocalStorage quota or unavailable
        }

        if (feedbackStatus) {
          feedbackStatus.className = 'dialog-feedback success';
          feedbackStatus.textContent = delivered
            ? 'Thank you for shaping Wordloom. Your thoughts have been recorded.'
            : 'Thank you! Your feedback has been saved locally.';
          feedbackStatus.classList.remove('hidden');
        }

        if (feedbackComments) feedbackComments.value = '';
        if (feedbackRole) feedbackRole.value = '';

        setTimeout(() => {
          closeFeedback();
          if (submitBtn) submitBtn.disabled = false;
        }, 1600);

      } catch (err) {
        if (feedbackStatus) {
          feedbackStatus.className = 'dialog-feedback error';
          feedbackStatus.textContent = 'Could not record feedback. Please try again.';
          feedbackStatus.classList.remove('hidden');
        }
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    // --- Extension Guide Modal ---
    const btnExtGuide = document.getElementById('btn-web-extension');
    const btnExtClose = document.getElementById('ext-guide-close');
    const btnExtDone = document.getElementById('ext-guide-done');

    function openExtGuide() {
      if (extGuideModal) extGuideModal.classList.remove('hidden');
    }

    function closeExtGuide() {
      if (extGuideModal) extGuideModal.classList.add('hidden');
    }

    btnExtGuide?.addEventListener('click', openExtGuide);
    btnExtClose?.addEventListener('click', closeExtGuide);
    btnExtDone?.addEventListener('click', closeExtGuide);

    extGuideModal?.addEventListener('click', (e) => {
      if (e.target === extGuideModal) closeExtGuide();
    });

    // --- Reset to Sample Library ---
    const btnReset = document.getElementById('btn-web-reset');
    btnReset?.addEventListener('click', async () => {
      const confirmed = window.confirm(
        'Reset library back to the 5 showcase words? Any words added in this browser session will be replaced.'
      );
      if (!confirmed) return;

      try {
        localStorage.removeItem('wordloom_words');
        if (window.vocabAPI && window.vocabAPI.loadWords) {
          await window.vocabAPI.loadWords();
          // Trigger global UI re-render
          if (typeof window.renderLexicon === 'function') {
            window.renderLexicon();
          } else {
            window.location.reload();
          }
        }
      } catch (err) {
        console.error('Reset error:', err);
      }
    });

    // ESC key closes any open modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (feedbackModal && !feedbackModal.classList.contains('hidden')) closeFeedback();
        if (extGuideModal && !extGuideModal.classList.contains('hidden')) closeExtGuide();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebHub);
  } else {
    initWebHub();
  }
})();

