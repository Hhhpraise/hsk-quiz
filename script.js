/* ============================================================
   HSK VOCABULARY MASTER v2.0 — Complete Application Script
   ============================================================ */

// ===== GLOBAL STATE =====
let vocabulary = [];
let currentBatch = 0;
let batchSize = 50;
let currentIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let totalAnswered = 0;
let isPinyinMode = true;
let selectedOption = null;
let reviewWords = [];
let completedBatches = new Set();
let batchPerformance = {};
let wrongAnswers = [];
let isReviewMode = false;
let isSRSMode = false;
let srsSessionWords = [];
let reviewSessionOriginalBatch = null;
let reviewSessionOriginalIndex = null;
let similarWordsMap = {};
let totalWordsCount = 0;

// ===== LEVEL SYSTEM =====
let allLevelsData = null;
let currentLevel = null;

// ===== SETTINGS =====
let showEnglishInPinyin = true;
let autoProceed = true;
let soundEnabled = true;
let dailyGoal = 20;
let srsEnabled = true;

// ===== SRS SYSTEM =====
// srsData: { [wordChinese]: { box: 0-5, nextReview: timestamp, interval: days } }
let srsData = {};

// ===== STREAKS =====
// streakData: { currentStreak: number, lastStudyDate: 'YYYY-MM-DD', longestStreak: number }
let streakData = { currentStreak: 0, lastStudyDate: null, longestStreak: 0 };
const STREAK_KEY_PREFIX = 'hsk_streak_';

// ===== HISTORY / ANALYTICS =====
// historyData: { [dateStr]: { answered: number, correct: number, wordsStudied: [] } }
let historyData = {};
const HISTORY_KEY_PREFIX = 'hsk_history_';

const PROGRESS_VERSION = 4;

function progressKey() {
    return currentLevel ? `hskQuizProgress_level_${currentLevel}` : 'hskQuizProgress';
}
function srsKey() {
    return currentLevel ? `hsk_srs_level_${currentLevel}` : 'hsk_srs';
}
function streakKey() {
    return currentLevel ? `${STREAK_KEY_PREFIX}${currentLevel}` : STREAK_KEY_PREFIX + 'legacy';
}
function historyKey() {
    return currentLevel ? `${HISTORY_KEY_PREFIX}${currentLevel}` : HISTORY_KEY_PREFIX + 'legacy';
}

// ===== DOM REFS =====
const $ = (id) => document.getElementById(id);
const loadingScreen = $('loading-screen');
const errorBanner = $('error-banner');
const syncToast = $('sync-toast');
const appContainer = $('app-container');
const questionEl = $('question');
const feedbackEl = $('feedback');
const optionsEl = $('options');
const currentQuestionEl = $('current-question');
const correctCountEl = $('correct-count');
const wrongCountEl = $('wrong-count');
const accuracyEl = $('accuracy');
const progressFill = $('progress-fill');
const currentPositionEl = $('current-position');
const totalQuestionsEl = $('total-questions');
const batchInfoEl = $('batch-info');
const appTitleEl = $('app-title');
const appSubtitleEl = $('app-subtitle');
const modeLabelEl = $('mode-label');
const streakBadge = $('streak-badge');
const streakCountEl = $('streak-count');
const goalFill = $('goal-fill');
const goalProgressText = $('goal-progress-text');
const goalTextEl = $('goal-text');
const srsPanel = $('srs-panel');
const srsPanelText = $('srs-panel-text');
const srsBoxes = $('srs-boxes');
const srsHeaderBtn = $('srs-header-btn');

// ===== UTILITY FUNCTIONS =====
function showToast(msg) {
    syncToast.style.display = 'flex';
    syncToast.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
    setTimeout(() => { syncToast.style.display = 'none'; }, 2000);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function deterministicShuffle(array, seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash = hash & hash;
    }
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.abs(hash % (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
        hash = ((hash << 5) - hash) + i;
    }
    return array;
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function showQuickNotification(msg) {
    const el = document.createElement('div');
    el.className = 'quick-notify';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

// ===== SRS SYSTEM =====
const SRS_INTERVALS = [1, 3, 7, 14, 30]; // days for boxes 1-5

function loadSRSData() {
    const raw = localStorage.getItem(srsKey());
    if (raw) {
        try { srsData = JSON.parse(raw); } catch(e) { srsData = {}; }
    }
}

function saveSRSData() {
    localStorage.setItem(srsKey(), JSON.stringify(srsData));
}

function getSRSDueWords() {
    if (!srsEnabled) return [];
    const now = Date.now();
    const due = [];
    for (const ch of Object.keys(srsData)) {
        const entry = srsData[ch];
        if (entry.box > 0 && (!entry.nextReview || entry.nextReview <= now)) {
            const word = vocabulary.find(w => w.chinese === ch) || entry._word;
            if (word) due.push(word);
        }
    }
    return due;
}

function getSRSStats() {
    const stats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const entry of Object.values(srsData)) {
        const box = entry.box || 0;
        stats[box] = (stats[box] || 0) + 1;
    }
    return stats;
}

function updateSRSWord(word, wasCorrect) {
    if (!srsEnabled || !word || !word.chinese) return;
    const ch = word.chinese;
    if (!srsData[ch]) {
        srsData[ch] = { box: 0, nextReview: null, interval: 0, _word: word };
    }
    const entry = srsData[ch];
    if (wasCorrect) {
        entry.box = Math.min(5, entry.box + 1);
        if (entry.box > 0) {
            const days = SRS_INTERVALS[entry.box - 1];
            entry.interval = days;
            entry.nextReview = Date.now() + days * 24 * 60 * 60 * 1000;
        }
    } else {
        entry.box = 0;
        entry.nextReview = null;
        entry.interval = 0;
    }
    entry._word = word;
    saveSRSData();
}

function updateSRSDisplay() {
    const due = getSRSDueWords();
    const stats = getSRSStats();

    // Update header button
    if (due.length > 0) {
        srsHeaderBtn.style.display = 'flex';
        srsHeaderBtn.title = `${due.length} SRS words due for review`;
    } else {
        srsHeaderBtn.style.display = 'none';
    }

    // Update SRS panel
    if (due.length > 0 && !isReviewMode && !isSRSMode) {
        srsPanel.style.display = 'block';
        srsPanelText.textContent = `${due.length} words due for spaced repetition review today.`;
        // Render boxes
        let boxesHTML = '';
        for (let i = 0; i <= 5; i++) {
            const count = stats[i] || 0;
            boxesHTML += `<div class="srs-box box-${i}${count > 0 ? ' has-words' : ''}" title="Box ${i}: ${count} words">${count}</div>`;
        }
        srsBoxes.innerHTML = boxesHTML;
    } else {
        srsPanel.style.display = 'none';
    }
}

// ===== STREAKS & DAILY GOAL =====
function loadStreakData() {
    const raw = localStorage.getItem(streakKey());
    if (raw) {
        try { streakData = JSON.parse(raw); } catch(e) {
            streakData = { currentStreak: 0, lastStudyDate: null, longestStreak: 0 };
        }
    }
}

function saveStreakData() {
    localStorage.setItem(streakKey(), JSON.stringify(streakData));
}

function updateStreak() {
    const today = todayStr();
    if (streakData.lastStudyDate === today) return; // Already studied today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

    if (streakData.lastStudyDate === yesterdayStr) {
        streakData.currentStreak += 1;
    } else if (streakData.lastStudyDate !== today) {
        streakData.currentStreak = 1;
    }

    if (streakData.currentStreak > streakData.longestStreak) {
        streakData.longestStreak = streakData.currentStreak;
    }
    streakData.lastStudyDate = today;
    saveStreakData();
    updateStreakDisplay();

    // Celebrate milestones
    if (streakData.currentStreak > 0 && streakData.currentStreak % 7 === 0) {
        celebrateStreak(streakData.currentStreak);
    }
}

function updateStreakDisplay() {
    if (streakData.currentStreak > 0) {
        streakBadge.style.display = 'flex';
        streakCountEl.textContent = streakData.currentStreak;
    } else {
        streakBadge.style.display = 'none';
    }
}

function celebrateStreak(days) {
    // Confetti
    const colors = ['#F59E0B', '#EF4444', '#10B981', '#4F46E5', '#F97316', '#EC4899'];
    for (let i = 0; i < 40; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.top = -(Math.random() * 40) + 'px';
        piece.style.width = (6 + Math.random() * 10) + 'px';
        piece.style.height = (6 + Math.random() * 10) + 'px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
        piece.style.animationDelay = Math.random() * 0.5 + 's';
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 3000);
    }
    showQuickNotification(`🔥 ${days}-day streak!`);
}

function updateDailyGoal() {
    const today = todayStr();
    const todayHistory = historyData[today] || { answered: 0 };
    const progress = Math.min(todayHistory.answered, dailyGoal);
    const pct = dailyGoal > 0 ? Math.round((progress / dailyGoal) * 100) : 0;
    goalFill.style.width = pct + '%';
    goalProgressText.textContent = `${progress}/${dailyGoal}`;
    if (progress >= dailyGoal) {
        goalTextEl.textContent = 'Goal Complete! 🎯';
    } else {
        goalTextEl.textContent = 'Daily Goal';
    }
}

// ===== HISTORY & ANALYTICS =====
function loadHistoryData() {
    const raw = localStorage.getItem(historyKey());
    if (raw) {
        try { historyData = JSON.parse(raw); } catch(e) { historyData = {}; }
    }
}

function saveHistoryData() {
    localStorage.setItem(historyKey(), JSON.stringify(historyData));
}

function recordAnswer(wasCorrect) {
    const today = todayStr();
    if (!historyData[today]) {
        historyData[today] = { answered: 0, correct: 0, wordsStudied: [] };
    }
    historyData[today].answered += 1;
    if (wasCorrect) historyData[today].correct += 1;
    // Cap to avoid bloat
    const keys = Object.keys(historyData).sort();
    if (keys.length > 90) {
        delete historyData[keys[0]];
    }
    saveHistoryData();
}

// ===== VOCABULARY LOADING =====
async function loadVocabulary() {
    try {
        const paths = ['./hsk_vocabulary.json', 'hsk_vocabulary.json', '/hsk_vocabulary.json'];
        let response;
        for (const path of paths) {
            try {
                response = await fetch(path);
                if (response.ok) break;
            } catch (e) {}
        }
        if (!response || !response.ok) throw new Error('Failed to load vocabulary');
        const data = await response.json();

        if (data.levels) {
            allLevelsData = data.levels;
            if (!currentLevel) { showLevelPicker(); return; }
            loadLevelData(currentLevel);
            return;
        }
        // Legacy format
        allLevelsData = null;
        currentLevel = null;
        vocabulary = data.words || [];
        totalWordsCount = vocabulary.length;
        vocabulary.sort((a, b) => a.chinese.localeCompare(b.chinese));
        precomputeSimilarWords();
        $('settings-word-count').textContent = totalWordsCount;
        if (data.level) {
            appTitleEl.textContent = `HSK ${data.level} Quiz`;
            appSubtitleEl.textContent = data.description || 'Match Chinese characters to their meanings';
        }
    } catch (error) {
        console.error('Error loading vocabulary:', error);
        allLevelsData = null;
        currentLevel = null;
        vocabulary = [
            { chinese: "爱", pinyin: "ài", english: "love" },
            { chinese: "朋友", pinyin: "péngyou", english: "friend" },
            { chinese: "学习", pinyin: "xuéxí", english: "study" },
            { chinese: "工作", pinyin: "gōngzuò", english: "work" },
            { chinese: "生活", pinyin: "shēnghuó", english: "life" },
            { chinese: "时间", pinyin: "shíjiān", english: "time" },
            { chinese: "今天", pinyin: "jīntiān", english: "today" },
            { chinese: "明天", pinyin: "míngtiān", english: "tomorrow" },
            { chinese: "昨天", pinyin: "zuótiān", english: "yesterday" },
            { chinese: "年", pinyin: "nián", english: "year" }
        ];
        totalWordsCount = vocabulary.length;
        $('settings-word-count').textContent = totalWordsCount;
        precomputeSimilarWords();
    }
}

function loadLevelData(levelKey) {
    const levelData = allLevelsData[levelKey];
    if (!levelData) return;
    currentLevel = levelKey;
    vocabulary = levelData.words || [];
    totalWordsCount = vocabulary.length;
    vocabulary.sort((a, b) => a.chinese.localeCompare(b.chinese));
    precomputeSimilarWords();
    $('settings-word-count').textContent = totalWordsCount;
    appTitleEl.textContent = `HSK Level ${levelKey} Quiz`;
    appSubtitleEl.textContent = levelData.description || 'Match Chinese characters to their meanings';
    const lvlEl = $('settings-current-level');
    if (lvlEl) lvlEl.textContent = `Level ${levelKey} (${totalWordsCount} words)`;
}

function showLevelPicker() {
    const pickerScreen = $('level-picker-screen');
    const grid = $('level-cards-grid');
    if (!pickerScreen || !grid) return;
    grid.innerHTML = '';
    Object.entries(allLevelsData)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([levelKey, levelData]) => {
            const hasSaved = !!localStorage.getItem(`hskQuizProgress_level_${levelKey}`);
            let savedInfo = '';
            if (hasSaved) {
                try {
                    const p = JSON.parse(localStorage.getItem(`hskQuizProgress_level_${levelKey}`));
                    const acc = p.totalAnswered > 0 ? Math.round((p.correctCount / p.totalAnswered) * 100) : 0;
                    const completed = (p.completedBatches || []).length;
                    const bs = p.batchSize || 50;
                    const totalBatches = Math.ceil((p.totalWordsCount || levelData.totalWords) / bs);
                    savedInfo = `<div class="level-card-progress">${completed}/${totalBatches} batches · ${acc}%</div>`;
                } catch(e) {}
            }
            const card = document.createElement('div');
            card.className = 'level-card';
            card.innerHTML = `
                <div class="level-card-badge">Level ${levelKey}</div>
                <div class="level-card-words">${levelData.totalWords} words</div>
                ${savedInfo || '<div class="level-card-new">New</div>'}
            `;
            card.addEventListener('click', () => pickLevel(levelKey));
            grid.appendChild(card);
        });
    appContainer.style.display = 'none';
    pickerScreen.style.display = 'flex';
}

function pickLevel(levelKey) {
    const pickerScreen = $('level-picker-screen');
    const isFirstPick = appContainer.style.display === 'none';
    currentBatch = 0; currentIndex = 0; correctCount = 0; wrongCount = 0;
    totalAnswered = 0; reviewWords = []; wrongAnswers = [];
    completedBatches = new Set(); batchPerformance = {};
    isReviewMode = false; isSRSMode = false; selectedOption = null;
    srsSessionWords = [];

    loadLevelData(levelKey);
    loadSRSData();
    loadStreakData();
    loadHistoryData();
    loadProgress();
    loadSettings();

    pickerScreen.style.display = 'none';
    appContainer.style.display = 'block';

    if (isFirstPick) {
        setupEventListeners();
        loadProgressFromURL();
        initSpeakerButton();
    }

    generateQuestion();
    updateUI();
    updateBatchInfo();
    updateReviewButton();
    updateSRSDisplay();
    updateStreakDisplay();
    updateDailyGoal();
}

function precomputeSimilarWords() {
    const pinyinMap = {};
    vocabulary.forEach(word => {
        const basePinyin = word.pinyin.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[0-9]/g, "").toLowerCase();
        if (!pinyinMap[basePinyin]) pinyinMap[basePinyin] = [];
        pinyinMap[basePinyin].push(word);
    });
    vocabulary.forEach(word => {
        const basePinyin = word.pinyin.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[0-9]/g, "").toLowerCase();
        const similarWords = [];
        if (pinyinMap[basePinyin]) {
            pinyinMap[basePinyin].forEach(w => {
                if (w.chinese !== word.chinese && !similarWords.some(sw => sw.chinese === w.chinese)) {
                    similarWords.push(w);
                }
            });
        }
        Object.keys(pinyinMap).forEach(pinyin => {
            if (pinyin !== basePinyin && (pinyin.startsWith(basePinyin.substring(0,2)) || basePinyin.startsWith(pinyin.substring(0,2)))) {
                pinyinMap[pinyin].forEach(w => {
                    if (w.chinese !== word.chinese && !similarWords.some(sw => sw.chinese === w.chinese)) {
                        similarWords.push(w);
                    }
                });
            }
        });
        let index = 0;
        while (similarWords.length < 5 && index < vocabulary.length) {
            const candidateWord = vocabulary[index];
            if (candidateWord.chinese !== word.chinese && !similarWords.some(w => w.chinese === candidateWord.chinese)) {
                similarWords.push(candidateWord);
            }
            index++;
        }
        similarWordsMap[word.chinese] = similarWords;
    });
}

// ===== QUESTION GENERATION =====
function getCurrentBatch() {
    if (isSRSMode) return srsSessionWords;
    if (isReviewMode) return reviewWords;
    const start = currentBatch * batchSize;
    const end = start + batchSize;
    return vocabulary.slice(start, Math.min(end, vocabulary.length));
}

function generateQuestion() {
    stopSpeaking();
    selectedOption = null;
    const batchWords = getCurrentBatch();
    if (batchWords.length === 0) {
        if (isSRSMode) { endSRSSession(); return; }
        if (isReviewMode) { endReviewSession(); return; }
        showCompletionModal(true);
        return;
    }
    if (currentIndex >= batchWords.length) currentIndex = 0;

    const word = batchWords[currentIndex];
    questionEl.textContent = word.chinese;

    // Trigger character entrance animation
    questionEl.classList.remove('char-entrance');
    void questionEl.offsetWidth; // Force reflow
    questionEl.classList.add('char-entrance');

    // Update mode label
    if (isSRSMode) {
        modeLabelEl.textContent = 'SRS Review';
    } else if (isReviewMode) {
        modeLabelEl.textContent = 'Review Mode';
    } else {
        modeLabelEl.textContent = isPinyinMode ? 'Pinyin & English' : 'English Only';
    }

    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback-area';
    feedbackEl.classList.remove('visible');

    generateOptions(word);
    updateUI();
}

function generateOptions(correctWord) {
    let options = [correctWord];
    const pool = (isReviewMode || isSRSMode) ? vocabulary : getCurrentBatch();

    if (!isReviewMode && !isSRSMode) {
        const similarWords = similarWordsMap[correctWord.chinese] || [];
        for (const sw of similarWords) {
            if (options.length >= 4) break;
            if (sw.chinese !== correctWord.chinese) options.push(sw);
        }
    }

    while (options.length < 4) {
        const randomWord = pool[Math.floor(Math.random() * pool.length)];
        if (!options.some(w => w.chinese === randomWord.chinese)) {
            options.push(randomWord);
        }
    }

    deterministicShuffle(options, correctWord.chinese);
    optionsEl.innerHTML = '';

    options.forEach((word) => {
        const btn = document.createElement('div');
        btn.className = 'option-btn';
        btn.dataset.correct = word.chinese === correctWord.chinese;

        const content = document.createElement('div');
        content.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;';

        if (isPinyinMode && showEnglishInPinyin) {
            const pinyinEl = document.createElement('div');
            pinyinEl.className = 'option-pinyin';
            pinyinEl.textContent = word.pinyin;
            const englishEl = document.createElement('div');
            englishEl.className = 'option-english';
            englishEl.textContent = word.english;
            content.appendChild(pinyinEl);
            content.appendChild(englishEl);
        } else if (isPinyinMode) {
            const text = document.createElement('div');
            text.className = 'option-text';
            text.textContent = word.pinyin;
            content.appendChild(text);
        } else {
            const text = document.createElement('div');
            text.className = 'option-text';
            text.textContent = word.english;
            content.appendChild(text);
        }
        btn.appendChild(content);
        btn.addEventListener('click', () => selectOption(btn));
        btn.addEventListener('touchstart', function() { this.style.transform = 'scale(0.97)'; }, {passive: true});
        btn.addEventListener('touchend', function() { this.style.transform = ''; }, {passive: true});
        optionsEl.appendChild(btn);
    });
}

// ===== USER INTERACTIONS =====
function selectOption(optEl) {
    if (selectedOption) return;
    selectedOption = optEl;
    document.querySelectorAll('.option-btn').forEach(o => o.classList.remove('selected'));
    optEl.classList.add('selected');
    setTimeout(() => checkAnswer(optEl), 250);
}

function checkAnswer(optEl) {
    const isCorrect = optEl.dataset.correct === 'true';
    const allOpts = document.querySelectorAll('.option-btn');
    const currentWord = getCurrentBatch()[currentIndex];

    allOpts.forEach(o => { o.classList.add('locked'); });
    allOpts.forEach(o => {
        if (o.dataset.correct === 'true') o.classList.add('correct');
        else if (o === optEl) o.classList.add('incorrect');
    });

    totalAnswered++;
    if (isCorrect) {
        correctCount++;
        showFeedback('Correct! Well done!', 'correct');
        if (isSRSMode || isReviewMode) {
            const idx = reviewWords.findIndex(w => w.chinese === currentWord.chinese);
            if (idx > -1) { reviewWords.splice(idx, 1); updateReviewButton(); }
        }
    } else {
        wrongCount++;
        const correctText = isPinyinMode ? `${currentWord.pinyin} - ${currentWord.english}` : currentWord.english;
        showFeedback(`Incorrect. The answer is: <strong>${correctText}</strong>`, 'incorrect');
        if (!isReviewMode && !isSRSMode) {
            wrongAnswers.push({ word: currentWord, correctAnswer: correctText });
            if (!reviewWords.some(w => w.chinese === currentWord.chinese)) {
                reviewWords.push(currentWord);
                updateReviewButton();
            }
        }
    }

    // Update SRS
    if (!isSRSMode) updateSRSWord(currentWord, isCorrect);

    // Record for analytics
    recordAnswer(isCorrect);

    // Update streaks
    updateStreak();

    updateUI();
    updateDailyGoal();
    saveProgress();

    const isLastQuestion = currentIndex >= getCurrentBatch().length - 1;

    if (isLastQuestion) {
        setTimeout(() => {
            if (isSRSMode) { endSRSSession(); }
            else if (isReviewMode && reviewWords.length === 0) { endReviewSession(); }
            else if (isReviewMode) { showReviewCompletionModal(); }
            else { completeCurrentBatch(); }
        }, isCorrect ? 1500 : 2500);
    } else if (autoProceed) {
        setTimeout(() => {
            currentIndex++;
            selectedOption = null;
            generateQuestion();
        }, isCorrect ? 1200 : 2200);
    }
}

function showFeedback(msg, type) {
    feedbackEl.innerHTML = msg;
    feedbackEl.className = 'feedback-area ' + type + ' visible';
}

function skipQuestion() {
    const isLast = currentIndex >= getCurrentBatch().length - 1;
    if (isLast) {
        if (isSRSMode) endSRSSession();
        else if (isReviewMode) endReviewSession();
        else completeCurrentBatch();
    } else {
        currentIndex++;
        selectedOption = null;
        generateQuestion();
    }
}

// ===== REVIEW SESSION =====
function startReviewSession() {
    if (reviewWords.length === 0) return;
    reviewSessionOriginalBatch = currentBatch;
    reviewSessionOriginalIndex = currentIndex;
    isReviewMode = true;
    isSRSMode = false;
    currentIndex = 0; correctCount = 0; wrongCount = 0; totalAnswered = 0;
    selectedOption = null;
    closeModal('review-modal');
    appTitleEl.textContent = 'Review Session';
    appSubtitleEl.textContent = 'Practicing words you missed';
    updateActionButtonsForMode();
    generateQuestion();
    updateUI();
    updateBatchInfo();
    updateReviewButton();
    updateSRSDisplay();
    saveProgress();
}

function endReviewSession() {
    if (!isReviewMode) return;
    isReviewMode = false;
    if (reviewSessionOriginalBatch !== null) currentBatch = reviewSessionOriginalBatch;
    if (reviewSessionOriginalIndex !== null) currentIndex = reviewSessionOriginalIndex;
    reviewSessionOriginalBatch = null;
    reviewSessionOriginalIndex = null;
    appTitleEl.textContent = currentLevel ? `HSK Level ${currentLevel} Quiz` : 'HSK Quiz';
    appSubtitleEl.textContent = 'Match Chinese characters to their meanings';
    updateActionButtonsForMode();
    generateQuestion();
    updateUI();
    updateBatchInfo();
    updateReviewButton();
    updateSRSDisplay();
    saveProgress();
}

// ===== SRS SESSION =====
function startSRSSession() {
    const dueWords = getSRSDueWords();
    if (dueWords.length === 0) return;
    srsSessionWords = [...dueWords];
    isSRSMode = true;
    isReviewMode = false;
    currentIndex = 0; correctCount = 0; wrongCount = 0; totalAnswered = 0;
    selectedOption = null;
    closeModal('review-modal');
    appTitleEl.textContent = 'SRS Review';
    appSubtitleEl.textContent = 'Spaced repetition — review what you\'ve learned';
    updateActionButtonsForMode();
    srsPanel.style.display = 'none';
    generateQuestion();
    updateUI();
    updateBatchInfo();
    updateReviewButton();
    saveProgress();
}

function endSRSSession() {
    if (!isSRSMode) return;
    isSRSMode = false;
    srsSessionWords = [];
    appTitleEl.textContent = currentLevel ? `HSK Level ${currentLevel} Quiz` : 'HSK Quiz';
    appSubtitleEl.textContent = 'Match Chinese characters to their meanings';
    updateActionButtonsForMode();
    generateQuestion();
    updateUI();
    updateBatchInfo();
    updateReviewButton();
    updateSRSDisplay();
    saveProgress();
    if (getSRSDueWords().length > 0) {
        showQuickNotification('SRS review complete! More words due tomorrow.');
    }
}

function updateActionButtonsForMode() {
    const reviewBtn = $('review-btn');
    if (isSRSMode) {
        reviewBtn.style.display = 'flex';
        reviewBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Exit SRS';
        reviewBtn.className = 'action-btn secondary';
        reviewBtn.onclick = endSRSSession;
    } else if (isReviewMode) {
        reviewBtn.style.display = 'flex';
        reviewBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Exit Review';
        reviewBtn.className = 'action-btn secondary';
        reviewBtn.onclick = endReviewSession;
    } else {
        updateReviewButton();
        reviewBtn.onclick = () => showModal('review-modal');
    }
}

// ===== BATCH MANAGEMENT =====
function changeBatchSize(size) {
    batchSize = size === 'all' ? vocabulary.length : parseInt(size);
    currentBatch = 0; currentIndex = 0; correctCount = 0; wrongCount = 0;
    totalAnswered = 0; reviewWords = []; wrongAnswers = [];
    generateQuestion();
    updateBatchInfo();
    updateReviewButton();
    saveProgress();
}

function goToBatch(batch) {
    currentBatch = batch; currentIndex = 0; correctCount = 0; wrongCount = 0;
    totalAnswered = 0;
    generateQuestion();
    updateBatchInfo();
    closeModal('batch-select-modal');
    saveProgress();
}

function completeCurrentBatch() {
    if (isSRSMode || isReviewMode) return;
    const batchWords = getCurrentBatch();
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    completedBatches.add(currentBatch);
    batchPerformance[currentBatch] = { correct: correctCount, total: batchWords.length, accuracy };
    const totalBatches = Math.ceil(vocabulary.length / batchSize);
    const isLastBatch = currentBatch >= totalBatches - 1;
    if (isLastBatch) {
        showCompletionModal(true);
    } else {
        setTimeout(() => {
            currentBatch++; currentIndex = 0; correctCount = 0; wrongCount = 0;
            totalAnswered = 0; selectedOption = null;
            showQuickNotification(`Batch ${currentBatch + 1}`);
            generateQuestion();
            updateBatchInfo();
            saveProgress();
        }, 1500);
    }
}

// ===== UI UPDATES =====
function updateUI() {
    const batchWords = getCurrentBatch();
    const total = batchWords.length;
    currentQuestionEl.textContent = currentIndex + 1;
    correctCountEl.textContent = correctCount;
    wrongCountEl.textContent = wrongCount;
    const acc = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    accuracyEl.textContent = acc + '%';
    const prog = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
    progressFill.style.width = prog + '%';
    currentPositionEl.textContent = currentIndex + 1;
    totalQuestionsEl.textContent = total;
    $('prev-btn').disabled = currentIndex === 0;
    $('next-btn').disabled = currentIndex >= total - 1;
}

function updateBatchInfo() {
    if (isSRSMode) {
        batchInfoEl.innerHTML = `<i class="fas fa-layer-group"></i><span>SRS: ${currentIndex+1} of ${srsSessionWords.length}</span>`;
    } else if (isReviewMode) {
        batchInfoEl.innerHTML = `<i class="fas fa-redo"></i><span>Review: ${currentIndex+1} of ${reviewWords.length}</span>`;
    } else {
        const totalBatches = Math.ceil(vocabulary.length / batchSize);
        batchInfoEl.innerHTML = `<i class="fas fa-layer-group"></i><span>Batch ${currentBatch+1} / ${totalBatches} (${totalWordsCount} words)</span>`;
    }
}

function updateReviewButton() {
    const btn = $('review-btn');
    if (isSRSMode || isReviewMode) {
        updateActionButtonsForMode();
        return;
    }
    const count = reviewWords.length;
    if (count > 0) {
        btn.style.display = 'flex';
        btn.className = 'action-btn secondary';
        btn.innerHTML = `<i class="fas fa-redo"></i> Review (${count})`;
        btn.onclick = () => showModal('review-modal');
    } else {
        btn.style.display = 'none';
    }
}

// ===== PROGRESS PERSISTENCE =====
function saveProgress() {
    const data = {
        version: PROGRESS_VERSION, timestamp: Date.now(),
        currentBatch, batchSize, currentIndex, correctCount, wrongCount,
        totalAnswered, wrongAnswers, isPinyinMode, isReviewMode,
        reviewWords, completedBatches: Array.from(completedBatches),
        batchPerformance, totalWordsCount,
        showEnglishInPinyin, autoProceed, soundEnabled,
        dailyGoal, srsEnabled
    };
    localStorage.setItem(progressKey(), JSON.stringify(data));
}

function loadSettings() {
    const saved = localStorage.getItem(progressKey());
    if (!saved) {
        dailyGoal = 20; srsEnabled = true; return;
    }
    try {
        const p = JSON.parse(saved);
        dailyGoal = p.dailyGoal || 20;
        srsEnabled = p.srsEnabled !== false;
        if ($('daily-goal-select')) $('daily-goal-select').value = dailyGoal;
        if ($('srs-toggle')) $('srs-toggle').checked = srsEnabled;
    } catch(e) {}
}

function loadProgress() {
    const saved = localStorage.getItem(progressKey());
    if (!saved) return;
    try {
        const p = JSON.parse(saved);
        currentBatch = p.currentBatch || 0;
        batchSize = p.batchSize || 50;
        currentIndex = p.currentIndex || 0;
        correctCount = p.correctCount || p.correctAnswers || 0;
        wrongCount = p.wrongCount || p.wrongAnswers?.length || 0;
        totalAnswered = p.totalAnswered || 0;
        wrongAnswers = p.wrongAnswers || [];
        isPinyinMode = p.isPinyinMode !== false;
        isReviewMode = p.isReviewMode || false;
        reviewWords = p.reviewWords || [];
        completedBatches = new Set(p.completedBatches || []);
        batchPerformance = p.batchPerformance || {};
        totalWordsCount = p.totalWordsCount || vocabulary.length;
        showEnglishInPinyin = p.showEnglishInPinyin !== false;
        autoProceed = p.autoProceed !== false;
        soundEnabled = p.soundEnabled !== false;
        dailyGoal = p.dailyGoal || 20;
        srsEnabled = p.srsEnabled !== false;

        updateUI();
        updateBatchInfo();
        updateReviewButton();
        $('mode-pinyin').classList.toggle('active', isPinyinMode);
        $('mode-english').classList.toggle('active', !isPinyinMode);
        $('show-english-toggle').checked = showEnglishInPinyin;
        $('auto-proceed-toggle').checked = autoProceed;
        $('sound-toggle').checked = soundEnabled;
        if ($('daily-goal-select')) $('daily-goal-select').value = dailyGoal;
        if ($('srs-toggle')) $('srs-toggle').checked = srsEnabled;
        if (batchSizeSelectEl) batchSizeSelectEl.value = batchSize === vocabulary.length ? 'all' : batchSize.toString();
        if (reviewWords.length > 0) { $('review-btn').style.display = 'flex'; }
    } catch(e) { console.error('Error loading progress:', e); }
}

// ===== MODALS =====
function showModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    switch(id) {
        case 'completion-modal': populateCompletion(); break;
        case 'review-modal': populateReview(); break;
        case 'share-modal': populateShare(); break;
        case 'analysis-modal': populateAnalysis(); break;
        case 'batch-select-modal': populateBatchSelect(); break;
        case 'settings-modal': populateSettings(); break;
    }
}

function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function populateCompletion() {
    const totalBatches = Math.ceil(vocabulary.length / batchSize);
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const isFinal = currentBatch >= totalBatches - 1;
    $('completion-title').textContent = isFinal ? 'All Batches Complete!' : 'Batch Complete!';

    const body = $('completion-body');
    body.innerHTML = `
        <div style="text-align:center;">
            <div style="font-size:3rem;margin-bottom:16px;">${isFinal ? '🏆' : '🎉'}</div>
            <div class="completion-stats">
                <div class="stat-card"><div class="stat-card-val">${getCurrentBatch().length}</div><div class="stat-card-lbl">Words</div></div>
                <div class="stat-card"><div class="stat-card-val" style="color:var(--color-success)">${correctCount}</div><div class="stat-card-lbl">Correct</div></div>
                <div class="stat-card"><div class="stat-card-val" style="color:var(--color-error)">${wrongCount}</div><div class="stat-card-lbl">Wrong</div></div>
                <div class="stat-card"><div class="stat-card-val">${accuracy}%</div><div class="stat-card-lbl">Accuracy</div></div>
            </div>
            ${isFinal ? `<p style="color:var(--text-secondary);margin-bottom:20px;">You've completed all ${totalBatches} batches!</p>` : ''}
            <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
                ${reviewWords.length > 0 ? `<button class="action-btn secondary" id="comp-review-btn">Review Mistakes (${reviewWords.length})</button>` : ''}
                ${!isFinal ? `<button class="action-btn primary" id="comp-next-btn">Next Batch</button>` : ''}
                <button class="action-btn ${isFinal ? 'primary' : 'secondary'}" id="comp-restart-btn">${isFinal ? 'Start Over' : 'Skip to Next'}</button>
            </div>
        </div>
    `;

    setTimeout(() => {
        $('comp-review-btn')?.addEventListener('click', () => { closeModal('completion-modal'); showModal('review-modal'); });
        $('comp-next-btn')?.addEventListener('click', () => { closeModal('completion-modal'); completeCurrentBatch(); });
        $('comp-restart-btn')?.addEventListener('click', () => {
            if (isFinal) {
                currentBatch = 0; currentIndex = 0; correctCount = 0; wrongCount = 0;
                totalAnswered = 0; reviewWords = []; wrongAnswers = [];
                completedBatches.clear(); batchPerformance = {};
            } else {
                completeCurrentBatch();
            }
            closeModal('completion-modal');
            generateQuestion(); updateBatchInfo(); updateReviewButton(); saveProgress();
        });
    }, 100);
}

function populateReview() {
    const body = $('review-body');
    if (reviewWords.length === 0) {
        body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✨</div><h4>No words to review!</h4><p>Keep practicing and missed words will appear here.</p></div>`;
        return;
    }
    let html = `<div class="word-list">`;
    reviewWords.forEach((w, i) => {
        html += `
            <div class="word-list-item">
                <div><div class="wl-chinese">${w.chinese}</div><div class="wl-pinyin">${w.pinyin}</div></div>
                <div style="text-align:right;"><div class="wl-english">${w.english}</div></div>
            </div>`;
    });
    html += `</div>
        <div style="margin-top:16px;display:flex;gap:12px;">
            <button class="action-btn primary" id="start-review-session-btn" style="flex:1;">Start Review (${reviewWords.length})</button>
        </div>`;
    body.innerHTML = html;
    $('start-review-session-btn')?.addEventListener('click', startReviewSession);
}

function populateShare() {
    const body = $('share-body');
    const shareUrl = generateShareUrl();

    body.innerHTML = `
        <div class="share-tabs">
            <button class="share-tab active" data-tab="url">Link & QR</button>
            <button class="share-tab" data-tab="file">File</button>
            <button class="share-tab" data-tab="code">Sync Code</button>
        </div>
        <div id="share-tab-content"></div>
    `;

    const contentEl = body.querySelector('#share-tab-content');
    function showTab(tab) {
        body.querySelectorAll('.share-tab').forEach(t => t.classList.remove('active'));
        body.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        switch(tab) {
            case 'url':
                contentEl.innerHTML = `
                    <div style="text-align:center;">
                        <div class="share-url-box">
                            <div class="share-url-text">${shareUrl}</div>
                            <button class="action-btn primary" id="copy-url-btn" style="min-height:auto;padding:8px 16px;">Copy</button>
                        </div>
                        <div style="margin:16px 0;"><div class="qr-wrapper" id="qr-code-container"></div></div>
                        <p style="font-size:0.75rem;color:var(--text-muted);">Scan QR code or share the link to transfer progress to another device.</p>
                    </div>`;
                generateQRCode(shareUrl, 'qr-code-container');
                $('copy-url-btn')?.addEventListener('click', () => {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        $('copy-url-btn').textContent = 'Copied!';
                        setTimeout(() => { $('copy-url-btn').textContent = 'Copy'; }, 2000);
                    });
                });
                break;
            case 'file':
                const exportData = buildProgressExport();
                const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
                const fileUrl = URL.createObjectURL(blob);
                contentEl.innerHTML = `
                    <div style="text-align:center;">
                        <p style="margin-bottom:16px;color:var(--text-secondary);">Export your progress as a file, or import a previously saved file.</p>
                        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            <button class="action-btn primary" id="export-file-btn"><i class="fas fa-download"></i> Export JSON</button>
                            <button class="action-btn secondary" id="import-file-btn"><i class="fas fa-upload"></i> Import JSON</button>
                        </div>
                        <input type="file" id="import-file-input" accept=".json" style="display:none;">
                        <p id="import-status" style="margin-top:12px;font-size:0.8125rem;"></p>
                    </div>`;
                $('export-file-btn')?.addEventListener('click', () => {
                    const a = document.createElement('a');
                    a.href = fileUrl;
                    a.download = `hsk-progress-${currentLevel || 'all'}-${todayStr()}.json`;
                    a.click();
                    showToast('Progress exported!');
                });
                $('import-file-btn')?.addEventListener('click', () => {
                    $('import-file-input').click();
                });
                $('import-file-input')?.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            const data = JSON.parse(ev.target.result);
                            importProgressData(data);
                            $('import-status').textContent = 'Progress imported successfully!';
                            $('import-status').style.color = 'var(--color-success)';
                            closeModal('share-modal');
                            generateQuestion(); updateUI(); updateBatchInfo(); updateReviewButton(); updateSRSDisplay(); updateStreakDisplay(); updateDailyGoal();
                        } catch(err) {
                            $('import-status').textContent = 'Invalid file format.';
                            $('import-status').style.color = 'var(--color-error)';
                        }
                    };
                    reader.readAsText(file);
                });
                break;
            case 'code':
                const syncCode = generateSyncCode();
                contentEl.innerHTML = `
                    <div style="text-align:center;">
                        <p style="margin-bottom:16px;color:var(--text-secondary);">Enter this code on another device to sync progress.</p>
                        <div class="sync-code-display" id="sync-code-display">${syncCode}</div>
                        <button class="action-btn primary" id="copy-code-btn"><i class="fas fa-copy"></i> Copy Code</button>
                        <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border-light);">
                            <p style="margin-bottom:12px;color:var(--text-secondary);">Or enter a sync code from another device:</p>
                            <div style="display:flex;gap:8px;justify-content:center;">
                                <input type="text" id="sync-code-input" maxlength="6" placeholder="ABC123" style="padding:10px 16px;border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:1.25rem;font-family:var(--font-mono);text-align:center;width:140px;letter-spacing:4px;text-transform:uppercase;background:var(--bg-surface);color:var(--text-primary);">
                                <button class="action-btn primary" id="apply-code-btn" style="min-height:auto;">Apply</button>
                            </div>
                            <p id="code-status" style="margin-top:8px;font-size:0.8125rem;"></p>
                        </div>
                    </div>`;
                $('copy-code-btn')?.addEventListener('click', () => {
                    navigator.clipboard.writeText(syncCode).then(() => {
                        $('copy-code-btn').textContent = 'Copied!';
                        setTimeout(() => { $('copy-code-btn').innerHTML = '<i class="fas fa-copy"></i> Copy Code'; }, 2000);
                    });
                });
                $('apply-code-btn')?.addEventListener('click', () => {
                    const code = $('sync-code-input').value.trim().toUpperCase();
                    if (code.length !== 6) {
                        $('code-status').textContent = 'Enter a 6-character code.';
                        $('code-status').style.color = 'var(--color-error)';
                        return;
                    }
                    const data = decodeSyncCode(code);
                    if (data) {
                        importProgressData(data);
                        $('code-status').textContent = 'Synced successfully!';
                        $('code-status').style.color = 'var(--color-success)';
                        closeModal('share-modal');
                        generateQuestion(); updateUI(); updateBatchInfo(); updateReviewButton(); updateSRSDisplay(); updateStreakDisplay(); updateDailyGoal();
                    } else {
                        $('code-status').textContent = 'Invalid or expired sync code.';
                        $('code-status').style.color = 'var(--color-error)';
                    }
                });
                break;
        }
    }

    body.querySelectorAll('.share-tab').forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });
    showTab('url');
}

function buildProgressExport() {
    return {
        version: PROGRESS_VERSION,
        timestamp: Date.now(),
        level: currentLevel,
        currentBatch, batchSize, currentIndex, correctCount, wrongCount, totalAnswered,
        wrongAnswers, isPinyinMode, reviewWords,
        completedBatches: Array.from(completedBatches),
        batchPerformance, totalWordsCount,
        srsData, streakData, historyData,
        showEnglishInPinyin, autoProceed, soundEnabled, dailyGoal, srsEnabled
    };
}

function importProgressData(data) {
    if (!data || data.version < 2) return;
    currentBatch = data.currentBatch || 0;
    batchSize = data.batchSize || 50;
    currentIndex = data.currentIndex || 0;
    correctCount = data.correctCount || 0;
    wrongCount = data.wrongCount || 0;
    totalAnswered = data.totalAnswered || 0;
    wrongAnswers = data.wrongAnswers || [];
    isPinyinMode = data.isPinyinMode !== false;
    reviewWords = data.reviewWords || [];
    completedBatches = new Set(data.completedBatches || []);
    batchPerformance = data.batchPerformance || {};
    totalWordsCount = data.totalWordsCount || vocabulary.length;
    if (data.srsData) { srsData = data.srsData; saveSRSData(); }
    if (data.streakData) { streakData = data.streakData; saveStreakData(); }
    if (data.historyData) { historyData = data.historyData; saveHistoryData(); }
    if (data.dailyGoal) dailyGoal = data.dailyGoal;
    if (data.srsEnabled !== undefined) srsEnabled = data.srsEnabled;
    saveProgress();
    showToast('Progress imported!');
}

function generateShareUrl() {
    const optimized = {
        v: 2, b: currentBatch, s: batchSize, i: currentIndex,
        c: correctCount, w: wrongCount, t: totalAnswered,
        p: isPinyinMode, r: reviewWords.map(w => w.chinese),
        d: Array.from(completedBatches), ts: Date.now(), tw: totalWordsCount
    };
    const compressed = LZString.compressToBase64(JSON.stringify(optimized))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${window.location.origin}${window.location.pathname}?p=${compressed}`;
}

function generateQRCode(text, containerId) {
    const container = $(containerId);
    if (!container) return;
    try {
        const qr = qrcode(0, 'L');
        qr.addData(text); qr.make();
        container.innerHTML = qr.createImgTag(4, 0);
    } catch(e) {
        container.innerHTML = '<p style="color:var(--color-error);">Failed to generate QR code</p>';
    }
}

function generateSyncCode() {
    const data = buildProgressExport();
    const json = JSON.stringify(data);
    const compressed = LZString.compressToBase64(json);
    // Take first 6 alphanumeric chars
    let code = '';
    for (const ch of compressed) {
        if (/[A-Z0-9]/i.test(ch)) code += ch.toUpperCase();
        if (code.length >= 6) break;
    }
    while (code.length < 6) code += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    // Store in session-level localStorage for retrieval
    localStorage.setItem('hsk_sync_code_' + code, compressed);
    // Auto-expire after 30 minutes
    setTimeout(() => { localStorage.removeItem('hsk_sync_code_' + code); }, 30 * 60 * 1000);
    return code;
}

function decodeSyncCode(code) {
    const compressed = localStorage.getItem('hsk_sync_code_' + code);
    if (!compressed) return null;
    try {
        const json = LZString.decompressFromBase64(compressed);
        return JSON.parse(json);
    } catch(e) { return null; }
}

function loadProgressFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    let progressParam = urlParams.get('p');
    if (!progressParam) return;
    try {
        let data = progressParam.replace(/-/g, '+').replace(/_/g, '/');
        while (data.length % 4) data += '=';
        const decompressed = LZString.decompressFromBase64(data);
        if (!decompressed) throw new Error('Decompression failed');
        const progress = JSON.parse(decompressed);
        if (progress && confirm('Load progress from shared link? This will replace your current progress.')) {
            currentBatch = progress.b || 0;
            batchSize = progress.s || 50;
            currentIndex = progress.i || 0;
            correctCount = progress.c || 0;
            wrongCount = progress.w || 0;
            totalAnswered = progress.t || 0;
            isPinyinMode = progress.p !== false;
            reviewWords = (progress.r || []).map(ch => vocabulary.find(w => w.chinese === ch) || {chinese: ch}).filter(w => w.chinese);
            completedBatches = new Set(progress.d || []);
            window.history.replaceState({}, '', window.location.pathname);
            generateQuestion(); updateUI(); updateBatchInfo(); updateReviewButton(); saveProgress();
            showToast('Progress loaded from link!');
        }
    } catch(e) { console.error('Error loading progress from URL:', e); }
}

function populateAnalysis() {
    const body = $('analysis-body');
    const totalBatches = Math.ceil(vocabulary.length / batchSize);
    const completed = completedBatches.size;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const srsStats = getSRSStats();
    const srsTotal = Object.values(srsStats).reduce((a,b) => a+b, 0);

    body.innerHTML = `
        <div class="stats-grid-2">
            <div class="stat-card"><div class="stat-card-val">${totalBatches}</div><div class="stat-card-lbl">Total Batches</div></div>
            <div class="stat-card"><div class="stat-card-val">${completed}</div><div class="stat-card-lbl">Completed</div></div>
            <div class="stat-card"><div class="stat-card-val">${accuracy}%</div><div class="stat-card-lbl">Accuracy</div></div>
            <div class="stat-card"><div class="stat-card-val">${streakData.currentStreak}</div><div class="stat-card-lbl">Day Streak</div></div>
            <div class="stat-card"><div class="stat-card-val">${reviewWords.length}</div><div class="stat-card-lbl">To Review</div></div>
            <div class="stat-card"><div class="stat-card-val">${srsTotal}</div><div class="stat-card-lbl">SRS Words</div></div>
        </div>

        <h4 style="margin-top:24px;margin-bottom:12px;color:var(--text-secondary);font-size:0.875rem;">SRS Box Distribution</h4>
        <div class="srs-boxes" style="justify-content:flex-start;">
            ${[0,1,2,3,4,5].map(i => `<div class="srs-box box-${i}${(srsStats[i]||0)>0?' has-words':''}" title="Box ${i}">${srsStats[i]||0}</div>`).join('')}
        </div>

        <h4 style="margin-top:24px;margin-bottom:12px;color:var(--text-secondary);font-size:0.875rem;">Accuracy Trend (Last 30 Days)</h4>
        <div class="chart-card"><div class="chart-wrap"><canvas id="accuracy-chart"></canvas></div></div>

        <h4 style="margin-top:16px;margin-bottom:12px;color:var(--text-secondary);font-size:0.875rem;">Questions Answered Per Day</h4>
        <div class="chart-card"><div class="chart-wrap"><canvas id="volume-chart"></canvas></div></div>

        <h4 style="margin-top:24px;margin-bottom:12px;color:var(--text-secondary);font-size:0.875rem;">Batch Progress</h4>
        <div class="batch-grid" id="analysis-batch-grid"></div>
    `;

    // Render batch grid
    const batchGrid = body.querySelector('#analysis-batch-grid');
    for (let i = 0; i < totalBatches; i++) {
        const dot = document.createElement('div');
        dot.className = 'batch-dot';
        if (i === currentBatch) dot.classList.add('current');
        if (completedBatches.has(i)) dot.classList.add('completed');
        dot.textContent = i + 1;
        dot.title = batchPerformance[i] ? `Accuracy: ${batchPerformance[i].accuracy}%` : 'Not started';
        dot.addEventListener('click', () => { closeModal('analysis-modal'); goToBatch(i); });
        batchGrid.appendChild(dot);
    }

    // Render charts after a short delay (DOM must be visible)
    setTimeout(() => renderCharts(), 200);
}

function renderCharts() {
    const days = [];
    const accuracyData = [];
    const volumeData = [];

    // Build last 30 days of data
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const h = historyData[ds] || { answered: 0, correct: 0 };
        const label = `${d.getMonth()+1}/${d.getDate()}`;
        days.push(label);
        accuracyData.push(h.answered > 0 ? Math.round((h.correct / h.answered) * 100) : null);
        volumeData.push(h.answered || 0);
    }

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    // Accuracy chart
    const accCtx = $('accuracy-chart');
    if (accCtx) {
        new Chart(accCtx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'Accuracy %',
                    data: accuracyData,
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79,70,229,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: accuracyData.filter(v => v !== null).length < 10 ? 3 : 1,
                    spanGaps: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, maxTicksLimit: 10, font: { size: 10 } } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } }, min: 0, max: 100 }
                }
            }
        });
    }

    // Volume chart
    const volCtx = $('volume-chart');
    if (volCtx) {
        new Chart(volCtx, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [{
                    label: 'Questions',
                    data: volumeData,
                    backgroundColor: '#818CF8',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, maxTicksLimit: 10, font: { size: 10 } } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } }, beginAtZero: true }
                }
            }
        });
    }
}

function populateBatchSelect() {
    const body = $('batch-select-body');
    const totalBatches = Math.ceil(vocabulary.length / batchSize);
    body.innerHTML = `<p style="margin-bottom:16px;color:var(--text-secondary);">Select a batch to practice:</p><div class="batch-grid"></div>`;
    const grid = body.querySelector('.batch-grid');
    for (let i = 0; i < totalBatches; i++) {
        const dot = document.createElement('div');
        dot.className = 'batch-dot';
        if (i === currentBatch) dot.classList.add('current');
        dot.textContent = i + 1;
        dot.addEventListener('click', () => goToBatch(i));
        grid.appendChild(dot);
    }
}

function populateSettings() {
    $('settings-word-count').textContent = totalWordsCount;
    const lvlEl = $('settings-current-level');
    if (lvlEl) lvlEl.textContent = currentLevel ? `Level ${currentLevel} (${totalWordsCount} words)` : `Single level (${totalWordsCount} words)`;
    if ($('change-level-btn')) {
        const row = $('change-level-btn').closest('.settings-row');
        if (row) row.style.display = allLevelsData ? 'flex' : 'none';
    }
}

// ===== SETTINGS ACTIONS =====
function resetCurrentBatch() {
    if (!confirm('Reset current batch progress?')) return;
    correctCount = 0; wrongCount = 0; totalAnswered = 0;
    wrongAnswers = wrongAnswers.filter(wa => !getCurrentBatch().some(w => w.chinese === wa.word?.chinese));
    reviewWords = reviewWords.filter(w => !getCurrentBatch().some(bw => bw.chinese === w.chinese));
    currentIndex = 0;
    generateQuestion(); updateUI(); updateReviewButton(); saveProgress();
    closeModal('settings-modal');
}

function resetAllProgress() {
    if (!confirm('Reset ALL progress? This cannot be undone.')) return;
    localStorage.removeItem(progressKey());
    localStorage.removeItem('hskQuizProgress');
    localStorage.removeItem('hsk4-progress');
    localStorage.removeItem(srsKey());
    localStorage.removeItem(streakKey());
    localStorage.removeItem(historyKey());
    if (allLevelsData) {
        Object.keys(allLevelsData).forEach(lvl => {
            localStorage.removeItem(`hskQuizProgress_level_${lvl}`);
            localStorage.removeItem(`hsk_srs_level_${lvl}`);
            localStorage.removeItem(`${STREAK_KEY_PREFIX}${lvl}`);
            localStorage.removeItem(`${HISTORY_KEY_PREFIX}${lvl}`);
        });
    }
    srsData = {};
    streakData = { currentStreak: 0, lastStudyDate: null, longestStreak: 0 };
    historyData = {};
    currentBatch = 0; currentIndex = 0; correctCount = 0; wrongCount = 0;
    totalAnswered = 0; reviewWords = []; wrongAnswers = [];
    completedBatches.clear(); batchPerformance = {};
    generateQuestion(); updateUI(); updateBatchInfo(); updateReviewButton();
    updateSRSDisplay(); updateStreakDisplay(); updateDailyGoal();
    closeModal('settings-modal');
}

function showReviewCompletionModal() {
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-sheet">
            <div class="modal-header"><h3>Review Complete!</h3><button class="modal-close">&times;</button></div>
            <div class="modal-body" style="text-align:center;">
                <div style="font-size:3rem;margin-bottom:16px;">📚</div>
                <div class="stats-grid-2" style="margin-bottom:20px;">
                    <div class="stat-card"><div class="stat-card-val">${reviewWords.length + correctCount}</div><div class="stat-card-lbl">Reviewed</div></div>
                    <div class="stat-card"><div class="stat-card-val" style="color:var(--color-success)">${correctCount}</div><div class="stat-card-lbl">Correct</div></div>
                    <div class="stat-card"><div class="stat-card-val" style="color:var(--color-error)">${wrongCount}</div><div class="stat-card-lbl">Wrong</div></div>
                    <div class="stat-card"><div class="stat-card-val">${accuracy}%</div><div class="stat-card-lbl">Accuracy</div></div>
                </div>
                <div style="display:flex;gap:12px;justify-content:center;">
                    ${reviewWords.length > 0 ? `<button class="action-btn secondary" id="rvc-continue-btn">Continue Review</button>` : ''}
                    <button class="action-btn primary" id="rvc-end-btn">End Review</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const closeFn = () => { modal.style.display = 'none'; document.body.style.overflow = ''; setTimeout(() => modal.remove(), 300); };
    modal.querySelector('.modal-close').addEventListener('click', closeFn);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeFn(); });

    modal.querySelector('#rvc-continue-btn')?.addEventListener('click', () => {
        closeFn();
        currentIndex = 0; correctCount = 0; wrongCount = 0; totalAnswered = 0;
        generateQuestion(); updateUI();
    });
    modal.querySelector('#rvc-end-btn')?.addEventListener('click', () => { closeFn(); endReviewSession(); });
}

// ===== THEME =====
function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('hsk-theme', next);
    localStorage.setItem('hsk4-theme', next);
    $('theme-icon').className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// ===== TTS =====
let isSpeaking = false;

function speakCurrentWord() {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking || isSpeaking) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        $('speaker-btn')?.classList.remove('speaking');
        return;
    }
    const batchWords = getCurrentBatch();
    if (!batchWords?.length) return;
    const word = batchWords[currentIndex];
    if (!word?.chinese) return;

    function doSpeak() {
        const voices = window.speechSynthesis.getVoices();
        window.speechSynthesis.cancel();
        setTimeout(() => {
            const u = new SpeechSynthesisUtterance(word.chinese);
            u.lang = 'zh-CN'; u.rate = 0.85; u.volume = 1.0;
            if (voices?.length) {
                const zh = voices.find(v => v.lang === 'zh-CN') || voices.find(v => v.lang.startsWith('zh'));
                if (zh) u.voice = zh;
            }
            const btn = $('speaker-btn');
            u.onstart = () => { isSpeaking = true; if(btn) btn.classList.add('speaking'); };
            u.onend = () => { isSpeaking = false; if(btn) btn.classList.remove('speaking'); };
            u.onerror = () => { isSpeaking = false; if(btn) btn.classList.remove('speaking'); };
            window.speechSynthesis.speak(u);
        }, 100);
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices?.length) { doSpeak(); }
    else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }; }
}

function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isSpeaking = false;
    $('speaker-btn')?.classList.remove('speaking');
}

function initSpeakerButton() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const btn = $('speaker-btn');
    if (!btn) return;
    btn.onclick = (e) => { e.stopPropagation(); speakCurrentWord(); };
}

// ===== EVENT LISTENERS =====
let batchSizeSelectEl;

function setupEventListeners() {
    batchSizeSelectEl = $('batch-size-select');
    $('theme-toggle').addEventListener('click', toggleTheme);
    $('mode-pinyin').addEventListener('click', () => { isPinyinMode = true; $('mode-pinyin').classList.add('active'); $('mode-english').classList.remove('active'); generateQuestion(); saveProgress(); });
    $('mode-english').addEventListener('click', () => { isPinyinMode = false; $('mode-english').classList.add('active'); $('mode-pinyin').classList.remove('active'); generateQuestion(); saveProgress(); });
    $('prev-btn').addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; generateQuestion(); } });
    $('next-btn').addEventListener('click', () => { if (currentIndex < getCurrentBatch().length - 1) { currentIndex++; generateQuestion(); } });
    $('skip-btn').addEventListener('click', skipQuestion);
    $('save-btn').addEventListener('click', () => { saveProgress(); showToast('Progress Saved'); });
    $('review-btn').addEventListener('click', () => showModal('review-modal'));
    batchSizeSelectEl.addEventListener('change', (e) => changeBatchSize(e.target.value));
    $('stats-btn').addEventListener('click', () => showModal('analysis-modal'));
    $('share-btn').addEventListener('click', () => showModal('share-modal'));
    $('batch-nav-btn').addEventListener('click', () => showModal('batch-select-modal'));
    $('settings-btn').addEventListener('click', () => showModal('settings-modal'));
    $('srs-start-btn')?.addEventListener('click', startSRSSession);
    $('srs-header-btn')?.addEventListener('click', () => {
        if (isSRSMode) endSRSSession();
        else startSRSSession();
    });

    // Settings toggles
    $('show-english-toggle').addEventListener('change', (e) => { showEnglishInPinyin = e.target.checked; generateQuestion(); saveProgress(); });
    $('auto-proceed-toggle').addEventListener('change', (e) => {
        autoProceed = e.target.checked;
        if (autoProceed && selectedOption) {
            const isLast = currentIndex >= getCurrentBatch().length - 1;
            if (!isLast) setTimeout(() => { currentIndex++; generateQuestion(); }, 600);
        } else if (!autoProceed && selectedOption) { generateQuestion(); }
        saveProgress();
    });
    $('sound-toggle').addEventListener('change', (e) => { soundEnabled = e.target.checked; saveProgress(); });
    $('daily-goal-select')?.addEventListener('change', (e) => { dailyGoal = parseInt(e.target.value); updateDailyGoal(); saveProgress(); });
    $('srs-toggle')?.addEventListener('change', (e) => { srsEnabled = e.target.checked; updateSRSDisplay(); saveProgress(); });

    // Reset
    $('reset-batch-btn').addEventListener('click', resetCurrentBatch);
    $('reset-all-btn').addEventListener('click', resetAllProgress);

    // Change level
    $('change-level-btn')?.addEventListener('click', () => { closeModal('settings-modal'); if (allLevelsData) showLevelPicker(); });

    // Modal close
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            var modal = e.target.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal.id); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            var open = Array.from(document.querySelectorAll('.modal-overlay')).find(m => getComputedStyle(m).display === 'flex');
            if (open) closeModal(open.id);
        }
        if (e.key >= '1' && e.key <= '4' && !selectedOption) {
            var opts = document.querySelectorAll('.option-btn');
            if (opts[parseInt(e.key) - 1]) selectOption(opts[parseInt(e.key) - 1]);
        }
    });
    document.addEventListener('touchstart', () => {}, {passive: true});
}

// ===== INIT =====
async function init() {
    try {
        var savedTheme = localStorage.getItem('hsk-theme') || localStorage.getItem('hsk4-theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        $('theme-icon').className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

        await loadVocabulary();

        var pickerScreen = $('level-picker-screen');
        if (pickerScreen && pickerScreen.style.display !== 'none') {
            loadingScreen.style.display = 'none';
            return;
        }

        setupEventListeners();
        loadSRSData();
        loadStreakData();
        loadHistoryData();
        loadProgress();
        loadSettings();
        loadProgressFromURL();
        generateQuestion();
        initSpeakerButton();

        loadingScreen.style.display = 'none';
        appContainer.style.display = 'block';

        updateStreakDisplay();
        updateDailyGoal();
        updateSRSDisplay();

    } catch (error) {
        console.error('Init error:', error);
        loadingScreen.style.display = 'none';
        errorBanner.style.display = 'flex';
    }
}

document.addEventListener('DOMContentLoaded', init);
