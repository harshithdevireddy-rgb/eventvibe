// Client-side Application Logic for EventVibe

document.addEventListener('DOMContentLoaded', () => {
  // DOM Element References
  const tabFormBtn = document.getElementById('tabFormBtn');
  const tabDashboardBtn = document.getElementById('tabDashboardBtn');
  const formView = document.getElementById('formView');
  const dashboardView = document.getElementById('dashboardView');

  const feedbackForm = document.getElementById('feedbackForm');
  const starButtonsContainer = document.getElementById('starButtons');
  const selectedRatingInput = document.getElementById('selectedRating');
  const ratingTextLabel = document.getElementById('ratingTextLabel');
  const commentInput = document.getElementById('commentInput');
  const charCount = document.getElementById('charCount');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const formErrorBanner = document.getElementById('formErrorBanner');
  const formErrorText = document.getElementById('formErrorText');

  const submissionResultCard = document.getElementById('submissionResultCard');
  const resultRating = document.getElementById('resultRating');
  const resultSentiment = document.getElementById('resultSentiment');
  const resultTopic = document.getElementById('resultTopic');
  const resultComment = document.getElementById('resultComment');
  const resultAiBadge = document.getElementById('resultAiBadge');
  const resultMismatchBanner = document.getElementById('resultMismatchBanner');
  const viewInDashboardBtn = document.getElementById('viewInDashboardBtn');

  // Dashboard Elements
  const metricTotalCount = document.getElementById('metricTotalCount');
  const metricAvgRating = document.getElementById('metricAvgRating');
  const metricPositivePct = document.getElementById('metricPositivePct');
  const metricPositiveCount = document.getElementById('metricPositiveCount');
  const metricMismatchCount = document.getElementById('metricMismatchCount');

  const searchInput = document.getElementById('searchInput');
  const filterSentiment = document.getElementById('filterSentiment');
  const filterTopic = document.getElementById('filterTopic');
  const filterMismatch = document.getElementById('filterMismatch');
  const feedbackListContainer = document.getElementById('feedbackListContainer');

  const seedDataBtn = document.getElementById('seedDataBtn');
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');

  const aiSummaryPanel = document.getElementById('aiSummaryPanel');
  const aiSummaryText = document.getElementById('aiSummaryText');
  const aiPraisesList = document.getElementById('aiPraisesList');
  const aiConcernsList = document.getElementById('aiConcernsList');
  const aiRecommendationsList = document.getElementById('aiRecommendationsList');
  const closeSummaryBtn = document.getElementById('closeSummaryBtn');

  const settingsModal = document.getElementById('settingsModal');
  const openKeyModalBtn = document.getElementById('openKeyModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalApiKeyInput = document.getElementById('modalApiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');

  // Chart instances
  let sentimentChartInstance = null;
  let topicChartInstance = null;

  // Rating descriptors
  const RATING_DESCRIPTIONS = {
    1: '1 Star — Poor Experience',
    2: '2 Stars — Fair / Disappointing',
    3: '3 Stars — Average / Neutral',
    4: '4 Stars — Very Good',
    5: '5 Stars — Outstanding!'
  };

  let currentRating = 0;

  // Load custom API key from LocalStorage if saved
  let storedApiKey = localStorage.getItem('custom_gemini_api_key') || '';
  if (storedApiKey) {
    modalApiKeyInput.value = storedApiKey;
  }

  // --- INITIALIZE RATING STARS ---
  function initRatingStars() {
    starButtonsContainer.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star-btn p-2 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-indigo-950/50 hover:border-indigo-500/50 transition-all group';
      btn.dataset.rating = i;
      btn.innerHTML = `
        <svg class="w-8 h-8 text-slate-600 transition star-svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      `;

      btn.addEventListener('mouseenter', () => highlightStars(i));
      btn.addEventListener('mouseleave', () => highlightStars(currentRating));
      btn.addEventListener('click', () => {
        currentRating = i;
        selectedRatingInput.value = i;
        ratingTextLabel.textContent = RATING_DESCRIPTIONS[i];
        highlightStars(i);
        hideError();
      });

      starButtonsContainer.appendChild(btn);
    }
  }

  function highlightStars(count) {
    const starBtns = starButtonsContainer.querySelectorAll('.star-btn');
    starBtns.forEach((btn, idx) => {
      const starSvg = btn.querySelector('.star-svg');
      if (idx < count) {
        starSvg.classList.remove('text-slate-600');
        starSvg.classList.add('text-amber-400');
        btn.classList.add('selected');
      } else {
        starSvg.classList.remove('text-amber-400');
        starSvg.classList.add('text-slate-600');
        btn.classList.remove('selected');
      }
    });
  }

  initRatingStars();

  // Character Counter
  commentInput.addEventListener('input', () => {
    charCount.textContent = `${commentInput.value.length} / 2000`;
    hideError();
  });

  // Tab Navigation
  tabFormBtn.addEventListener('click', () => switchTab('form'));
  tabDashboardBtn.addEventListener('click', () => switchTab('dashboard'));
  if (viewInDashboardBtn) {
    viewInDashboardBtn.addEventListener('click', () => switchTab('dashboard'));
  }

  function switchTab(tab) {
    if (tab === 'form') {
      tabFormBtn.classList.add('active');
      tabDashboardBtn.classList.remove('active');
      formView.classList.remove('hidden');
      dashboardView.classList.add('hidden');
    } else {
      tabDashboardBtn.classList.add('active');
      tabFormBtn.classList.remove('active');
      dashboardView.classList.remove('hidden');
      formView.classList.add('hidden');
      loadDashboardData();
    }
  }

  // --- FORM SUBMISSION ---
  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const rating = selectedRatingInput.value;
    const comment = commentInput.value.trim();

    if (!rating) {
      showError('Please select a star rating (1 to 5).');
      return;
    }

    if (!comment) {
      showError('Please write a feedback comment before submitting.');
      return;
    }

    // Set Loading state
    setFormLoading(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: Number(rating),
          comment,
          customApiKey: storedApiKey || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      // Display Submission Result Card
      displayResultCard(data.feedback, data.ai_status, data.ai_reason);

      // Reset Form
      feedbackForm.reset();
      currentRating = 0;
      selectedRatingInput.value = '';
      highlightStars(0);
      ratingTextLabel.textContent = 'Select a rating (1 to 5 stars)';
      charCount.textContent = '0 / 2000';

    } catch (err) {
      showError(err.message || 'Error submitting feedback to server.');
    } finally {
      setFormLoading(false);
    }
  });

  function setFormLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      btnText.textContent = 'Analyzing & Saving...';
      btnSpinner.classList.remove('hidden');
    } else {
      btnText.textContent = 'Submit Feedback';
      btnSpinner.classList.add('hidden');
    }
  }

  function showError(msg) {
    formErrorText.textContent = msg;
    formErrorBanner.classList.remove('hidden');
  }

  function hideError() {
    formErrorBanner.classList.add('hidden');
  }

  function displayResultCard(feedback, aiStatus, aiReason) {
    resultRating.innerHTML = generateStarSvgString(feedback.rating);
    resultComment.textContent = feedback.comment;

    // Sentiment badge styling
    const sentiment = feedback.sentiment;
    resultSentiment.textContent = sentiment;
    resultSentiment.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ';

    if (sentiment === 'positive') resultSentiment.classList.add('badge-positive');
    else if (sentiment === 'neutral') resultSentiment.classList.add('badge-neutral');
    else if (sentiment === 'negative') resultSentiment.classList.add('badge-negative');
    else resultSentiment.classList.add('badge-not-analysed');

    resultTopic.textContent = feedback.topic;

    // AI Status Badge
    if (aiStatus === 'success') {
      resultAiBadge.textContent = '✨ Analyzed by Gemini AI';
      resultAiBadge.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
    } else {
      resultAiBadge.textContent = '⚠️ Saved as Not analysed (Graceful Fallback)';
      resultAiBadge.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-300 border-amber-500/30';
    }

    // Mismatch Banner
    if (feedback.is_mismatch) {
      resultMismatchBanner.classList.remove('hidden');
    } else {
      resultMismatchBanner.classList.add('hidden');
    }

    submissionResultCard.classList.remove('hidden');
    submissionResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function generateStarSvgString(rating) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const color = i <= rating ? 'text-amber-400' : 'text-slate-700';
      starsHtml += `
        <svg class="w-4 h-4 ${color}" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      `;
    }
    return `<div class="flex items-center space-x-0.5">${starsHtml} <span class="ml-1 text-xs text-slate-300">(${rating}/5)</span></div>`;
  }

  // --- ORGANIZER DASHBOARD DATA FETCHING & RENDERING ---
  async function loadDashboardData() {
    const sentiment = filterSentiment.value;
    const topic = filterTopic.value;
    const search = searchInput.value.trim();
    const mismatch = filterMismatch.checked;

    const query = new URLSearchParams({
      sentiment,
      topic,
      search,
      mismatch: mismatch ? 'true' : 'false'
    });

    try {
      const response = await fetch(`/api/feedback?${query.toString()}`);
      const data = await response.json();

      updateMetricsUI(data.metrics);
      updateChartsUI(data.metrics);
      renderFeedbackList(data.items);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }

  // Filter Listeners
  filterSentiment.addEventListener('change', loadDashboardData);
  filterTopic.addEventListener('change', loadDashboardData);
  filterMismatch.addEventListener('change', loadDashboardData);

  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadDashboardData, 300);
  });

  function updateMetricsUI(metrics) {
    metricTotalCount.textContent = metrics.total;
    metricAvgRating.textContent = metrics.avgRating;

    const posCount = metrics.sentimentCounts.positive || 0;
    const posPct = metrics.total > 0 ? Math.round((posCount / metrics.total) * 100) : 0;
    metricPositivePct.textContent = `${posPct}%`;
    metricPositiveCount.textContent = `(${posCount} positive)`;

    metricMismatchCount.textContent = metrics.mismatchCount;
  }

  function updateChartsUI(metrics) {
    // 1. Sentiment Doughnut Chart
    const sentimentCtx = document.getElementById('sentimentChart').getContext('2d');
    const sentimentData = [
      metrics.sentimentCounts.positive || 0,
      metrics.sentimentCounts.neutral || 0,
      metrics.sentimentCounts.negative || 0,
      metrics.sentimentCounts['Not analysed'] || 0
    ];

    if (sentimentChartInstance) {
      sentimentChartInstance.destroy();
    }

    sentimentChartInstance = new Chart(sentimentCtx, {
      type: 'doughnut',
      data: {
        labels: ['Positive', 'Neutral', 'Negative', 'Not Analysed'],
        datasets: [{
          data: sentimentData,
          backgroundColor: ['#10b981', '#94a3b8', '#f43f5e', '#f59e0b'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        },
        cutout: '70%'
      }
    });

    // 2. Topic Bar Chart
    const topicCtx = document.getElementById('topicChart').getContext('2d');
    const topicLabels = Object.keys(metrics.topicCounts);
    const topicValues = Object.values(metrics.topicCounts);

    if (topicChartInstance) {
      topicChartInstance.destroy();
    }

    topicChartInstance = new Chart(topicCtx, {
      type: 'bar',
      data: {
        labels: topicLabels.map(t => t.toUpperCase()),
        datasets: [{
          label: 'Submissions',
          data: topicValues,
          backgroundColor: '#6366f1',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  function renderFeedbackList(items) {
    feedbackListContainer.innerHTML = '';

    if (!items || items.length === 0) {
      feedbackListContainer.innerHTML = `
        <div class="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl">
          <p class="text-slate-400 text-sm">No feedback submissions match your filter criteria.</p>
        </div>
      `;
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-3 transition hover:border-slate-700';

      const createdDate = new Date(item.created_at).toLocaleString();

      let sentimentBadgeClass = 'badge-not-analysed';
      if (item.sentiment === 'positive') sentimentBadgeClass = 'badge-positive';
      else if (item.sentiment === 'neutral') sentimentBadgeClass = 'badge-neutral';
      else if (item.sentiment === 'negative') sentimentBadgeClass = 'badge-negative';

      card.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
          <div class="flex items-center space-x-3">
            ${generateStarSvgString(item.rating)}
            <span class="text-xs text-slate-500 font-mono">${createdDate}</span>
          </div>

          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${sentimentBadgeClass}">
              ${item.sentiment}
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-indigo-300 border border-indigo-500/20">
              🏷️ ${item.topic}
            </span>
            ${item.is_mismatch ? `
              <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1" title="Rating vs Sentiment Conflict">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <span>Mismatch</span>
              </span>
            ` : ''}
          </div>
        </div>

        <p class="text-slate-200 text-sm leading-relaxed">${escapeHtml(item.comment)}</p>

        ${(item.sentiment === 'Not analysed' || item.sentiment === 'not_analyzed') ? `
          <div class="pt-2 flex justify-end">
            <button data-id="${item.id}" class="reanalyze-btn text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition">
              🔄 Retry AI Analysis
            </button>
          </div>
        ` : ''}
      `;

      feedbackListContainer.appendChild(card);
    });

    // Attach click listeners to Re-analyze buttons
    document.querySelectorAll('.reanalyze-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        e.target.disabled = true;
        e.target.textContent = 'Analyzing...';
        try {
          await fetch('/api/feedback/reanalyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, customApiKey: storedApiKey || null })
          });
          loadDashboardData();
        } catch (err) {
          alert('Failed to re-analyze feedback: ' + err.message);
        }
      });
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- QUICK ACTIONS ---

  // 1. Seed Demo Data
  seedDataBtn.addEventListener('click', async () => {
    seedDataBtn.disabled = true;
    try {
      const response = await fetch('/api/seed', { method: 'POST' });
      const data = await response.json();
      loadDashboardData();
    } catch (err) {
      alert('Error seeding demo data');
    } finally {
      seedDataBtn.disabled = false;
    }
  });

  // 2. Generate Executive AI Summary
  generateSummaryBtn.addEventListener('click', async () => {
    generateSummaryBtn.disabled = true;
    generateSummaryBtn.innerHTML = `
      <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Generating AI Summary...</span>
    `;

    try {
      const response = await fetch('/api/feedback/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20, customApiKey: storedApiKey || null })
      });
      const data = await response.json();
      displayExecutiveSummary(data.executive_summary);
    } catch (err) {
      alert('Error generating summary: ' + err.message);
    } finally {
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.innerHTML = `
        <svg class="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        <span>Generate AI Summary</span>
      `;
    }
  });

  function displayExecutiveSummary(summary) {
    aiSummaryText.textContent = summary.summary || 'Summary unavailable.';

    // Praises list
    aiPraisesList.innerHTML = (summary.top_praises || []).map(p => `<li>${escapeHtml(p)}</li>`).join('');

    // Pain points list
    aiConcernsList.innerHTML = (summary.areas_for_improvement || []).map(c => `<li>${escapeHtml(c)}</li>`).join('');

    // Recommendations list
    aiRecommendationsList.innerHTML = (summary.recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');

    aiSummaryPanel.classList.remove('hidden');
    aiSummaryPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  closeSummaryBtn.addEventListener('click', () => {
    aiSummaryPanel.classList.add('hidden');
  });

  // 3. Export CSV
  exportCsvBtn.addEventListener('click', () => {
    window.location.href = '/api/feedback/export';
  });

  // 4. Clear Data
  clearDataBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all feedback entries?')) {
      await fetch('/api/clear', { method: 'POST' });
      loadDashboardData();
    }
  });

  // --- SETTINGS MODAL ---
  openKeyModalBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  saveKeyBtn.addEventListener('click', () => {
    storedApiKey = modalApiKeyInput.value.trim();
    if (storedApiKey) {
      localStorage.setItem('custom_gemini_api_key', storedApiKey);
    } else {
      localStorage.removeItem('custom_gemini_api_key');
    }
    settingsModal.classList.add('hidden');
    alert('Settings saved!');
  });

  // --- BACKGROUND & THEME SYSTEM ---
  const themeModal = document.getElementById('themeModal');
  const openThemeModalBtn = document.getElementById('openThemeModalBtn');
  const closeThemeModalBtn = document.getElementById('closeThemeModalBtn');
  const closeThemeModalDoneBtn = document.getElementById('closeThemeModalDoneBtn');
  const currentThemeLabel = document.getElementById('currentThemeLabel');
  const themeSwatches = document.querySelectorAll('.theme-swatch');

  const customSolidColorInput = document.getElementById('customSolidColorInput');
  const applySolidColorBtn = document.getElementById('applySolidColorBtn');
  const customGrad1Input = document.getElementById('customGrad1Input');
  const customGrad2Input = document.getElementById('customGrad2Input');
  const applyGradientBtn = document.getElementById('applyGradientBtn');
  const wallpaperUrlInput = document.getElementById('wallpaperUrlInput');
  const applyWallpaperBtn = document.getElementById('applyWallpaperBtn');
  const ambientToggle = document.getElementById('ambientToggle');
  const ambientContainer = document.getElementById('ambientContainer');
  const resetThemeBtn = document.getElementById('resetThemeBtn');

  const THEME_NAMES = {
    beige: 'Warm Linen Beige',
    sand: 'Desert Sand & Terracotta',
    latte: 'Cozy Warm Latte',
    espresso: 'Warm Espresso Dark',
    slate: 'Midnight Slate',
    nebula: 'Cosmic Nebula',
    ocean: 'Deep Ocean',
    cyberpunk: 'Cyberpunk Grid',
    emerald: 'Emerald Matrix',
    sunset: 'Sunset Glow',
    light: 'Executive Light'
  };

  const ALL_THEME_CLASSES = [
    'theme-slate',
    'theme-beige',
    'theme-sand',
    'theme-latte',
    'theme-espresso',
    'theme-nebula',
    'theme-ocean',
    'theme-cyberpunk',
    'theme-emerald',
    'theme-sunset',
    'theme-light'
  ];

  function applyPresetTheme(themeName) {
    // Remove inline styles from custom background if any
    document.body.style.backgroundColor = '';
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundAttachment = '';

    // Switch body class
    ALL_THEME_CLASSES.forEach(cls => document.body.classList.remove(cls));
    const targetClass = `theme-${themeName}`;
    document.body.classList.add(targetClass);

    // Update active state in swatches
    themeSwatches.forEach(swatch => {
      if (swatch.dataset.theme === themeName) {
        swatch.classList.add('active-theme');
      } else {
        swatch.classList.remove('active-theme');
      }
    });

    if (currentThemeLabel) {
      currentThemeLabel.textContent = THEME_NAMES[themeName] || 'Custom Theme';
    }

    localStorage.setItem('app_theme_type', 'preset');
    localStorage.setItem('app_theme_preset', themeName);
  }

  function applyCustomSolid(color) {
    ALL_THEME_CLASSES.forEach(cls => document.body.classList.remove(cls));
    document.body.classList.add('theme-slate'); // baseline text styling
    document.body.style.backgroundColor = color;
    document.body.style.backgroundImage = 'none';

    themeSwatches.forEach(s => s.classList.remove('active-theme'));
    if (currentThemeLabel) currentThemeLabel.textContent = `Custom Solid (${color})`;

    localStorage.setItem('app_theme_type', 'solid');
    localStorage.setItem('app_theme_color', color);
  }

  function applyCustomGradient(c1, c2) {
    ALL_THEME_CLASSES.forEach(cls => document.body.classList.remove(cls));
    document.body.classList.add('theme-slate');
    document.body.style.backgroundColor = c1;
    document.body.style.backgroundImage = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
    document.body.style.backgroundAttachment = 'fixed';

    themeSwatches.forEach(s => s.classList.remove('active-theme'));
    if (currentThemeLabel) currentThemeLabel.textContent = 'Custom 2-Color Gradient';

    localStorage.setItem('app_theme_type', 'gradient');
    localStorage.setItem('app_theme_grad1', c1);
    localStorage.setItem('app_theme_grad2', c2);
  }

  function applyWallpaperImage(url) {
    if (!url) return;
    ALL_THEME_CLASSES.forEach(cls => document.body.classList.remove(cls));
    document.body.classList.add('theme-slate');
    document.body.style.backgroundImage = `linear-gradient(rgba(11, 17, 32, 0.85), rgba(11, 17, 32, 0.90)), url("${url}")`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';

    themeSwatches.forEach(s => s.classList.remove('active-theme'));
    if (currentThemeLabel) currentThemeLabel.textContent = 'Custom Wallpaper Image';

    localStorage.setItem('app_theme_type', 'wallpaper');
    localStorage.setItem('app_theme_wallpaper', url);
  }

  function loadSavedTheme() {
    // 1. Ambient Glow preference
    const savedAmbient = localStorage.getItem('app_ambient_glow');
    if (savedAmbient === 'false') {
      if (ambientToggle) ambientToggle.checked = false;
      if (ambientContainer) ambientContainer.style.display = 'none';
    } else {
      if (ambientToggle) ambientToggle.checked = true;
      if (ambientContainer) ambientContainer.style.display = 'block';
    }

    // 2. Theme Mode preference
    const type = localStorage.getItem('app_theme_type') || 'preset';

    if (type === 'preset') {
      const preset = localStorage.getItem('app_theme_preset') || 'slate';
      applyPresetTheme(preset);
    } else if (type === 'solid') {
      const color = localStorage.getItem('app_theme_color') || '#0f172a';
      if (customSolidColorInput) customSolidColorInput.value = color;
      applyCustomSolid(color);
    } else if (type === 'gradient') {
      const c1 = localStorage.getItem('app_theme_grad1') || '#1e1b4b';
      const c2 = localStorage.getItem('app_theme_grad2') || '#0f172a';
      if (customGrad1Input) customGrad1Input.value = c1;
      if (customGrad2Input) customGrad2Input.value = c2;
      applyCustomGradient(c1, c2);
    } else if (type === 'wallpaper') {
      const url = localStorage.getItem('app_theme_wallpaper') || '';
      if (wallpaperUrlInput) wallpaperUrlInput.value = url;
      applyWallpaperImage(url);
    }
  }

  // Event Listeners for Theme Modal
  if (openThemeModalBtn) {
    openThemeModalBtn.addEventListener('click', () => themeModal.classList.remove('hidden'));
  }
  if (closeThemeModalBtn) {
    closeThemeModalBtn.addEventListener('click', () => themeModal.classList.add('hidden'));
  }
  if (closeThemeModalDoneBtn) {
    closeThemeModalDoneBtn.addEventListener('click', () => themeModal.classList.add('hidden'));
  }

  themeSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const theme = swatch.dataset.theme;
      applyPresetTheme(theme);
    });
  });

  // Humanized Beige Quick Palette Pills
  document.querySelectorAll('.palette-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const color = pill.dataset.color;
      if (color) {
        applyCustomSolid(color);
      }
    });
  });

  if (applySolidColorBtn) {
    applySolidColorBtn.addEventListener('click', () => {
      const color = customSolidColorInput.value;
      applyCustomSolid(color);
    });
  }

  if (applyGradientBtn) {
    applyGradientBtn.addEventListener('click', () => {
      const c1 = customGrad1Input.value;
      const c2 = customGrad2Input.value;
      applyCustomGradient(c1, c2);
    });
  }

  if (applyWallpaperBtn) {
    applyWallpaperBtn.addEventListener('click', () => {
      const url = wallpaperUrlInput.value.trim();
      if (!url) {
        alert('Please enter a valid image URL');
        return;
      }
      applyWallpaperImage(url);
    });
  }

  if (ambientToggle) {
    ambientToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      if (ambientContainer) ambientContainer.style.display = enabled ? 'block' : 'none';
      localStorage.setItem('app_ambient_glow', enabled ? 'true' : 'false');
    });
  }

  if (resetThemeBtn) {
    resetThemeBtn.addEventListener('click', () => {
      localStorage.removeItem('app_theme_type');
      localStorage.removeItem('app_theme_preset');
      localStorage.removeItem('app_theme_color');
      localStorage.removeItem('app_theme_grad1');
      localStorage.removeItem('app_theme_grad2');
      localStorage.removeItem('app_theme_wallpaper');
      localStorage.setItem('app_ambient_glow', 'true');
      if (ambientToggle) ambientToggle.checked = true;
      if (ambientContainer) ambientContainer.style.display = 'block';
      applyPresetTheme('slate');
    });
  }

  // Load and apply saved theme immediately on init
  loadSavedTheme();

  // Auto-load dashboard on start if visiting directly
  loadDashboardData();
});
