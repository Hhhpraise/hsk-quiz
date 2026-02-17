// ===== GLOBAL VARIABLES =====
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
let wrongAnswers = []; // For compatibility with old progress system
let isReviewMode = false; // For compatibility
let navigationHistory = []; // For forward/back navigation
let navigationPosition = -1;
let similarWordsMap = {}; // For similar words matching
let totalWordsCount = 0;

// Progress version for compatibility
const PROGRESS_VERSION = 3;

// Settings
let showEnglishInPinyin = true;
let autoProceed = true;
let soundEnabled = true;

// ===== DOM ELEMENTS =====
const loadingScreen = document.getElementById('loading-screen');
const errorMessage = document.getElementById('error-message');
const syncIndicator = document.getElementById('sync-indicator');
const mainContainer = document.getElementById('main-container');
const questionEl = document.getElementById('question');
const feedbackEl = document.getElementById('feedback');
const optionsEl = document.getElementById('options');
const currentQuestionEl = document.getElementById('current-question');
const correctCountEl = document.getElementById('correct-count');
const wrongCountEl = document.getElementById('wrong-count');
const accuracyEl = document.getElementById('accuracy');
const progressFill = document.querySelector('.progress-fill');
const currentPositionEl = document.getElementById('current-position');
const totalQuestionsEl = document.getElementById('total-questions');
const batchInfoEl = document.getElementById('batch-info');
const appTitleEl = document.getElementById('app-title');
const appSubtitleEl = document.getElementById('app-subtitle');

// Buttons
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const modePinyinBtn = document.getElementById('mode-pinyin');
const modeEnglishBtn = document.getElementById('mode-english');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const reviewBtn = document.getElementById('review-btn');
const skipBtn = document.getElementById('skip-btn');
const saveBtn = document.getElementById('save-btn');
const batchSizeSelect = document.getElementById('batch-size-select');

// Modal buttons
const statsBtn = document.getElementById('stats-btn');
const shareBtn = document.getElementById('share-btn');
const batchNavBtn = document.getElementById('batch-nav-btn');
const settingsBtn = document.getElementById('settings-btn');

// Settings elements
const showEnglishToggle = document.getElementById('show-english-toggle');
const autoProceedToggle = document.getElementById('auto-proceed-toggle');
const soundToggle = document.getElementById('sound-toggle');
const resetBatchBtn = document.getElementById('reset-batch-btn');
const resetAllBtn = document.getElementById('reset-all-btn');
const settingsWordCount = document.getElementById('settings-word-count');

// Modals
const modals = document.querySelectorAll('.modal');
const modalCloseBtns = document.querySelectorAll('.modal-close');

// ===== UTILITY FUNCTIONS =====
function showSyncIndicator() {
    syncIndicator.style.display = 'flex';
    setTimeout(() => {
        syncIndicator.style.display = 'none';
    }, 2000);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Deterministic shuffle for consistent options
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

// ===== PROGRESS SYSTEM (Compatible with old version) =====
function saveProgress() {
    const progressData = {
        version: PROGRESS_VERSION,
        timestamp: Date.now(),
        currentBatch,
        batchSize,
        currentIndex,
        correctCount,
        wrongCount,
        totalAnswered,
        wrongAnswers,
        isPinyinMode,
        isReviewMode,
        reviewWords,
        completedBatches: Array.from(completedBatches),
        batchPerformance,
        totalWordsCount,
        showEnglishInPinyin,
        autoProceed,
        soundEnabled
    };

    localStorage.setItem('hskQuizProgress', JSON.stringify(progressData));
    showSyncIndicator();
}

function loadProgress() {
    const savedProgress = localStorage.getItem('hskQuizProgress');
    if (!savedProgress) return;

    try {
        const progress = JSON.parse(savedProgress);

        // Migrate old data if needed
        const migratedProgress = migrateProgressData(progress);

        // Load data
        currentBatch = migratedProgress.currentBatch || 0;
        batchSize = migratedProgress.batchSize || 50;
        currentIndex = migratedProgress.currentIndex || 0;
        correctCount = migratedProgress.correctCount || migratedProgress.correctAnswers || 0;
        wrongCount = migratedProgress.wrongCount || migratedProgress.wrongAnswers?.length || 0;
        totalAnswered = migratedProgress.totalAnswered || 0;
        wrongAnswers = migratedProgress.wrongAnswers || [];
        isPinyinMode = migratedProgress.isPinyinMode !== false;
        isReviewMode = migratedProgress.isReviewMode || false;
        reviewWords = migratedProgress.reviewWords || [];
        completedBatches = new Set(migratedProgress.completedBatches || []);
        batchPerformance = migratedProgress.batchPerformance || {};
        totalWordsCount = migratedProgress.totalWordsCount || vocabulary.length;
        showEnglishInPinyin = migratedProgress.showEnglishInPinyin !== false;
        autoProceed = migratedProgress.autoProceed !== false;
        soundEnabled = migratedProgress.soundEnabled !== false;

        // Update UI
        updateUI();
        updateBatchInfo();
        updateReviewButton();

        // Update mode buttons
        modePinyinBtn.classList.toggle('active', isPinyinMode);
        modeEnglishBtn.classList.toggle('active', !isPinyinMode);

        // Update settings toggles
        showEnglishToggle.checked = showEnglishInPinyin;
        autoProceedToggle.checked = autoProceed;
        soundToggle.checked = soundEnabled;

        // Update batch size select
        if (batchSizeSelect) {
            batchSizeSelect.value = batchSize === vocabulary.length ? 'all' : batchSize.toString();
        }

        // Show review button if needed
        if (reviewWords.length > 0) {
            reviewBtn.style.display = 'flex';
        }

    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

function migrateProgressData(progress) {
    if (!progress.version) {
        // Version 1 migration
        return {
            version: PROGRESS_VERSION,
            timestamp: Date.now(),
            ...progress,
            correctCount: progress.correctAnswers || 0,
            wrongCount: progress.wrongAnswers?.length || 0,
            showEnglishInPinyin: true,
            autoProceed: true,
            soundEnabled: true
        };
    }
    return progress;
}

// ===== INITIALIZATION =====
async function init() {
    try {
        // Load vocabulary
        await loadVocabulary();

        // Setup event listeners
        setupEventListeners();

        // Initialize speaker button
        initSpeakerButton();

        // Load saved progress (compatible with old system)
        loadProgress();

        // Check for progress in URL
        loadProgressFromURL();

        // Generate first question
        generateQuestion();

        // Hide loading screen
        loadingScreen.style.display = 'none';
        mainContainer.style.display = 'block';

    } catch (error) {
        console.error('Initialization error:', error);
        loadingScreen.style.display = 'none';
        errorMessage.style.display = 'flex';
    }
}

// ===== VOCABULARY LOADING =====
async function loadVocabulary() {
    try {
        // Try multiple paths for compatibility
        const paths = ['./vocabulary.json', 'vocabulary.json', '/vocabulary.json'];
        let response;

        for (const path of paths) {
            try {
                response = await fetch(path);
                if (response.ok) break;
            } catch (e) {
                console.log(`Failed to load from ${path}, trying next...`);
            }
        }

        if (!response || !response.ok) {
            throw new Error('Failed to load vocabulary');
        }

        const data = await response.json();
        vocabulary = data.words || [];
        totalWordsCount = vocabulary.length;

        // Update settings word count
        settingsWordCount.textContent = totalWordsCount;

        // Sort alphabetically for consistent batches (like old code)
        vocabulary.sort((a, b) => a.chinese.localeCompare(b.chinese));

        // Precompute similar words
        precomputeSimilarWords();

        // Update title with level info if provided
        if (data.level) {
            appTitleEl.textContent = `HSK ${data.level} Quiz`;
            appSubtitleEl.textContent = data.description || 'Match Chinese characters to their meanings';
        }

    } catch (error) {
        console.error('Error loading vocabulary:', error);
        // Fallback sample data
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
        settingsWordCount.textContent = totalWordsCount;
        precomputeSimilarWords();
    }
}

function precomputeSimilarWords() {
    const pinyinMap = {};

    vocabulary.forEach(word => {
        const basePinyin = word.pinyin
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[0-9]/g, "")
            .toLowerCase();

        if (!pinyinMap[basePinyin]) {
            pinyinMap[basePinyin] = [];
        }
        pinyinMap[basePinyin].push(word);
    });

    vocabulary.forEach(word => {
        const basePinyin = word.pinyin
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[0-9]/g, "")
            .toLowerCase();

        const similarWords = [];

        // Exact pinyin matches
        if (pinyinMap[basePinyin]) {
            pinyinMap[basePinyin].forEach(w => {
                if (w.chinese !== word.chinese && !similarWords.some(sw => sw.chinese === w.chinese)) {
                    similarWords.push(w);
                }
            });
        }

        // Partial matches
        Object.keys(pinyinMap).forEach(pinyin => {
            if (pinyin !== basePinyin && (
                pinyin.startsWith(basePinyin.substring(0, 2)) ||
                basePinyin.startsWith(pinyin.substring(0, 2))
            )) {
                pinyinMap[pinyin].forEach(w => {
                    if (w.chinese !== word.chinese && !similarWords.some(sw => sw.chinese === w.chinese)) {
                        similarWords.push(w);
                    }
                });
            }
        });

        // Fill with random words if needed
        let index = 0;
        while (similarWords.length < 5 && index < vocabulary.length) {
            const candidateWord = vocabulary[index];
            if (candidateWord.chinese !== word.chinese &&
                !similarWords.some(w => w.chinese === candidateWord.chinese)) {
                similarWords.push(candidateWord);
            }
            index++;
        }

        similarWordsMap[word.chinese] = similarWords;
    });
}

// ===== QUESTION GENERATION =====
function generateQuestion() {
    stopSpeaking(); // Reset speaker state on new question
    const batchWords = getCurrentBatch();
    if (batchWords.length === 0) {
        showCompletionModal();
        return;
    }

    if (currentIndex >= batchWords.length) {
        currentIndex = 0;
    }

    const word = batchWords[currentIndex];

    // Update question
    questionEl.textContent = word.chinese;

    // Clear feedback
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    feedbackEl.style.display = 'none';

    // Generate options
    generateOptions(word);

    // Update UI
    updateUI();
}

function generateOptions(correctWord) {
    const batchWords = getCurrentBatch();
    const options = [correctWord];

    // Get similar words first
    const similarWords = similarWordsMap[correctWord.chinese] || [];

    // Add similar words
    for (const similarWord of similarWords) {
        if (options.length >= 4) break;
        if (similarWord.chinese !== correctWord.chinese) {
            options.push(similarWord);
        }
    }

    // Fill remaining with random words
    while (options.length < 4) {
        const randomIndex = Math.floor(Math.random() * batchWords.length);
        const randomWord = batchWords[randomIndex];

        if (!options.some(w => w.chinese === randomWord.chinese)) {
            options.push(randomWord);
        }
    }

    // Deterministic shuffle
    deterministicShuffle(options, correctWord.chinese);

    // Clear options container
    optionsEl.innerHTML = '';

    // Create option elements
    options.forEach((word, index) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'option';
        optionEl.dataset.index = index;
        optionEl.dataset.correct = word.chinese === correctWord.chinese;

        const content = document.createElement('div');
        content.className = 'option-content';

        if (isPinyinMode && showEnglishInPinyin) {
            // Show both pinyin and English
            const pinyinEl = document.createElement('div');
            pinyinEl.className = 'option-pinyin';
            pinyinEl.textContent = word.pinyin;

            const englishEl = document.createElement('div');
            englishEl.className = 'option-english';
            englishEl.textContent = word.english;

            content.appendChild(pinyinEl);
            content.appendChild(englishEl);
        } else if (isPinyinMode) {
            // Show only pinyin
            const text = document.createElement('div');
            text.className = 'option-text';
            text.textContent = word.pinyin;
            content.appendChild(text);
        } else {
            // Show only English
            const text = document.createElement('div');
            text.className = 'option-text';
            text.textContent = word.english;
            content.appendChild(text);
        }

        optionEl.appendChild(content);

        // Add click event
        optionEl.addEventListener('click', () => selectOption(optionEl));
        optionEl.addEventListener('touchstart', handleTouchStart, { passive: true });
        optionEl.addEventListener('touchend', handleTouchEnd, { passive: true });

        optionsEl.appendChild(optionEl);
    });
}

function handleTouchStart(e) {
    this.style.transform = 'scale(0.98)';
}

function handleTouchEnd(e) {
    this.style.transform = '';
}

// ===== USER INTERACTIONS =====
function selectOption(optionEl) {
    if (selectedOption) return;

    selectedOption = optionEl;

    // Highlight selected option
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    optionEl.classList.add('selected');

    // Check answer after delay
    setTimeout(() => checkAnswer(optionEl), 300);
}

function checkAnswer(optionEl) {
    const isCorrect = optionEl.dataset.correct === 'true';
    const options = document.querySelectorAll('.option');
    const currentWord = getCurrentBatch()[currentIndex];

    // Disable all options
    options.forEach(opt => {
        opt.style.pointerEvents = 'none';
    });

    // Highlight correct/incorrect
    options.forEach(opt => {
        if (opt.dataset.correct === 'true') {
            opt.classList.add('correct');
        } else if (opt === optionEl) {
            opt.classList.add('incorrect');
        }
    });

    // Update stats
    totalAnswered++;
    if (isCorrect) {
        correctCount++;
        showFeedback('🎉 Correct! Well done!', 'correct');

        // Remove from review words if it was there
        const index = reviewWords.findIndex(w => w.chinese === currentWord.chinese);
        if (index > -1) {
            reviewWords.splice(index, 1);
            updateReviewButton();
        }
    } else {
        wrongCount++;
        const correctText = isPinyinMode ?
            `${currentWord.pinyin} - ${currentWord.english}` :
            currentWord.english;

        showFeedback(`❌ Incorrect.<br><strong>${correctText}</strong>`, 'incorrect');

        wrongAnswers.push({
            word: currentWord,
            selectedAnswer: optionEl.textContent,
            correctAnswer: correctText
        });

        // Add to review words if not already there
        if (!reviewWords.some(w => w.chinese === currentWord.chinese)) {
            reviewWords.push(currentWord);
            updateReviewButton();
        }
    }

    // Update UI
    updateUI();
    saveProgress();

    // Next question after delay if auto-proceed is enabled
    if (autoProceed) {
        setTimeout(() => {
            currentIndex++;
            selectedOption = null;

            if (currentIndex >= getCurrentBatch().length) {
                showCompletionModal();
            } else {
                generateQuestion();
            }
        }, 2000);
    }
}

function showFeedback(message, type) {
    feedbackEl.innerHTML = message;
    feedbackEl.className = `feedback ${type}`;
    feedbackEl.style.display = 'flex';
}

function skipQuestion() {
    currentIndex++;
    if (currentIndex >= getCurrentBatch().length) {
        showCompletionModal();
    } else {
        selectedOption = null;
        generateQuestion();
    }
}

// ===== BATCH MANAGEMENT =====
function getCurrentBatch() {
    const start = currentBatch * batchSize;
    const end = start + batchSize;
    return vocabulary.slice(start, Math.min(end, vocabulary.length));
}

function changeBatchSize(size) {
    if (size === 'all') {
        batchSize = vocabulary.length;
    } else {
        batchSize = parseInt(size);
    }

    currentBatch = 0;
    currentIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    totalAnswered = 0;
    reviewWords = [];
    wrongAnswers = [];

    generateQuestion();
    updateBatchInfo();
    updateReviewButton();
    saveProgress();
}

function goToBatch(batch) {
    currentBatch = batch;
    currentIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    totalAnswered = 0;

    generateQuestion();
    updateBatchInfo();
    closeModal('batch-select-modal');
    saveProgress();
}

// ===== UI UPDATES =====
function updateUI() {
    const batchWords = getCurrentBatch();
    const totalQuestions = batchWords.length;

    // Update counters
    currentQuestionEl.textContent = currentIndex + 1;
    correctCountEl.textContent = correctCount;
    wrongCountEl.textContent = wrongCount;

    // Update accuracy
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    accuracyEl.textContent = `${accuracy}%`;

    // Update progress
    const progress = ((currentIndex + 1) / totalQuestions) * 100;
    progressFill.style.width = `${progress}%`;

    // Update navigation
    currentPositionEl.textContent = currentIndex + 1;
    totalQuestionsEl.textContent = totalQuestions;

    // Update buttons
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex >= totalQuestions - 1;
}

function updateBatchInfo() {
    const totalBatches = Math.ceil(vocabulary.length / batchSize);
    batchInfoEl.innerHTML = `
        <i class="fas fa-layer-group"></i>
        <span>Batch ${currentBatch + 1} of ${totalBatches} (${totalWordsCount} words)</span>
    `;
}

function updateReviewButton() {
    const count = reviewWords.length;
    if (count > 0) {
        reviewBtn.style.display = 'flex';
        reviewBtn.innerHTML = `
            <i class="fas fa-redo"></i>
            <span class="btn-text">Review (${count})</span>
        `;
    } else {
        reviewBtn.style.display = 'none';
    }
}

// ===== MODAL FUNCTIONS =====
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Populate modal content based on ID
        switch(modalId) {
            case 'completion-modal':
                populateCompletionModal();
                break;
            case 'review-modal':
                populateReviewModal();
                break;
            case 'share-modal':
                populateShareModal();
                break;
            case 'analysis-modal':
                populateAnalysisModal();
                break;
            case 'batch-select-modal':
                populateBatchSelectModal();
                break;
            case 'settings-modal':
                populateSettingsModal();
                break;
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function populateCompletionModal() {
    const batchWords = getCurrentBatch();
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    // Mark batch as completed
    completedBatches.add(currentBatch);

    // Store performance data
    batchPerformance[currentBatch] = {
        correct: correctCount,
        total: batchWords.length,
        accuracy: accuracy
    };

    document.getElementById('completion-body').innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
            <h3 style="margin-bottom: 20px;">Batch Complete!</h3>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-value">${batchWords.length}</div>
                    <div class="stat-label">Total</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${correctCount}</div>
                    <div class="stat-label">Correct</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${wrongCount}</div>
                    <div class="stat-label">Wrong</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${accuracy}%</div>
                    <div class="stat-label">Accuracy</div>
                </div>
            </div>

            <div style="display: flex; gap: 12px;">
                ${reviewWords.length > 0 ? `
                    <button class="action-btn secondary" id="completion-review-btn" style="flex: 1;">
                        Review Mistakes
                    </button>
                ` : ''}
                <button class="action-btn primary" id="completion-next-btn" style="flex: 1;">
                    Next Batch
                </button>
            </div>
        </div>
    `;

    // Add event listeners for modal buttons
    document.getElementById('completion-review-btn')?.addEventListener('click', () => {
        closeModal('completion-modal');
        showModal('review-modal');
    });

    document.getElementById('completion-next-btn')?.addEventListener('click', () => {
        currentBatch++;
        currentIndex = 0;
        correctCount = 0;
        wrongCount = 0;
        totalAnswered = 0;
        generateQuestion();
        updateBatchInfo();
        closeModal('completion-modal');
        saveProgress();
    });
}

function populateReviewModal() {
    if (reviewWords.length === 0) {
        document.getElementById('review-body').innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">✨</div>
                <h4 style="margin-bottom: 8px;">No words to review!</h4>
                <p style="color: #8e8e93;">Keep practicing and words will appear here.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 16px;">${reviewWords.length} words to review</h4>
            <div style="display: flex; flex-direction: column; gap: 12px; max-height: 300px; overflow-y: auto;">
    `;

    reviewWords.forEach((word, index) => {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center;
                        padding: 16px; background: #f2f2f7; border-radius: 12px;">
                <div>
                    <div style="font-size: 24px; font-weight: 600;">${word.chinese}</div>
                    <div style="color: #8e8e93; font-size: 14px;">${word.pinyin}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 500;">${word.english}</div>
                    <button class="practice-word-btn" data-index="${index}"
                            style="margin-top: 8px; padding: 6px 12px; background: #4361ee;
                                   color: white; border: none; border-radius: 8px; font-size: 12px;">
                        Practice
                    </button>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button class="action-btn secondary" id="start-review-btn" style="flex: 1;">
                Start Review Session
            </button>
        </div>
    `;

    document.getElementById('review-body').innerHTML = html;

    // Add event listeners
    document.querySelectorAll('.practice-word-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            const word = reviewWords[index];
            reviewWords.splice(index, 1);
            reviewWords.unshift(word);
            startReviewSession();
        });
    });

    document.getElementById('start-review-btn')?.addEventListener('click', startReviewSession);
}

function populateShareModal() {
    // Get current progress data
    const progressData = {
        version: PROGRESS_VERSION,
        timestamp: Date.now(),
        currentBatch,
        batchSize,
        currentIndex,
        correctCount,
        wrongCount,
        totalAnswered,
        wrongAnswers,
        isPinyinMode,
        isReviewMode,
        reviewWords,
        completedBatches: Array.from(completedBatches),
        batchPerformance,
        totalWordsCount,
        deviceId: getDeviceId()
    };

    try {
        // Optimize data for sharing
        const optimized = {
            v: 2,
            b: progressData.currentBatch,
            s: progressData.batchSize,
            i: progressData.currentIndex,
            c: progressData.correctCount,
            w: progressData.wrongCount,
            t: progressData.totalAnswered,
            p: progressData.isPinyinMode,
            r: progressData.reviewWords.map(w => w.chinese),
            d: Array.from(progressData.completedBatches),
            ts: progressData.timestamp,
            tw: progressData.totalWordsCount
        };

        // Compress using LZ-String
        const compressedData = LZString.compressToBase64(JSON.stringify(optimized))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const shareUrl = `${window.location.origin}${window.location.pathname}?p=${compressedData}`;

        document.getElementById('share-body').innerHTML = `
            <div style="text-align: center;">
                <p style="margin-bottom: 20px; color: #8e8e93;">
                    Share your progress with this link:
                </p>

                <div class="share-url-container">
                    <div class="share-url">${shareUrl}</div>
                    <button class="action-btn primary" id="copy-url-btn" style="white-space: nowrap;">
                        Copy
                    </button>
                </div>

                <div style="margin: 24px 0;">
                    <div style="font-weight: 500; margin-bottom: 12px;">Scan QR Code:</div>
                    <div class="qr-container" id="qr-code-container"></div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 24px;">
                    <div class="stat-card">
                        <div class="stat-value">${currentBatch + 1}</div>
                        <div class="stat-label">Batch</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0}%</div>
                        <div class="stat-label">Accuracy</div>
                    </div>
                </div>
            </div>
        `;

        // Generate QR code
        generateQRCode(shareUrl, 'qr-code-container');

        // Add copy button event
        document.getElementById('copy-url-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(shareUrl).then(() => {
                const btn = document.getElementById('copy-url-btn');
                btn.innerHTML = 'Copied!';
                setTimeout(() => {
                    btn.innerHTML = 'Copy';
                }, 2000);
            });
        });

    } catch (error) {
        console.error('Error generating share modal:', error);
        document.getElementById('share-body').innerHTML = `
            <div style="text-align: center; color: #ff3b30;">
                <p>Error generating share link. Please try again.</p>
            </div>
        `;
    }
}

function generateQRCode(text, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const qr = qrcode(0, 'L');
        qr.addData(text);
        qr.make();

        const qrImage = qr.createImgTag(4, 0);
        container.innerHTML = qrImage;
    } catch (error) {
        container.innerHTML = '<p style="color: #ff3b30;">Failed to generate QR code</p>';
    }
}

function populateAnalysisModal() {
    const totalBatches = Math.ceil(vocabulary.length / batchSize);
    const completed = completedBatches.size;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    document.getElementById('analysis-body').innerHTML = `
        <div>
            <h4 style="margin-bottom: 16px;">Overall Statistics</h4>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${totalBatches}</div>
                    <div class="stat-label">Total Batches</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${completed}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${reviewWords.length}</div>
                    <div class="stat-label">To Review</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${accuracy}%</div>
                    <div class="stat-label">Accuracy</div>
                </div>
            </div>

            <h4 style="margin: 24px 0 16px;">Batch Progress</h4>
            <div class="batch-grid" id="batch-grid"></div>
        </div>
    `;

    // Generate batch grid
    const batchGrid = document.getElementById('batch-grid');
    for (let i = 0; i < totalBatches; i++) {
        const batchItem = document.createElement('div');
        batchItem.className = 'batch-item';
        if (i === currentBatch) {
            batchItem.classList.add('current');
        } else if (completedBatches.has(i)) {
            batchItem.classList.add('completed');
        }
        batchItem.textContent = i + 1;
        batchItem.title = batchPerformance[i] ?
            `Accuracy: ${batchPerformance[i].accuracy}%` :
            'Not started';
        batchItem.addEventListener('click', () => goToBatch(i));
        batchGrid.appendChild(batchItem);
    }
}

function populateBatchSelectModal() {
    const totalBatches = Math.ceil(vocabulary.length / batchSize);

    document.getElementById('batch-select-body').innerHTML = `
        <div>
            <p style="margin-bottom: 16px; color: #8e8e93;">
                Select a batch to practice:
            </p>
            <div class="batch-grid" id="select-batch-grid"></div>
        </div>
    `;

    // Generate batch grid
    const batchGrid = document.getElementById('select-batch-grid');
    for (let i = 0; i < totalBatches; i++) {
        const batchItem = document.createElement('div');
        batchItem.className = 'batch-item';
        if (i === currentBatch) {
            batchItem.classList.add('current');
        }
        batchItem.textContent = `Batch ${i + 1}`;
        batchItem.addEventListener('click', () => goToBatch(i));
        batchGrid.appendChild(batchItem);
    }
}

function populateSettingsModal() {
    // Settings are already populated by loadProgress()
    // Just update word count
    settingsWordCount.textContent = totalWordsCount;
}

// ===== REVIEW SESSION =====
function startReviewSession() {
    if (reviewWords.length === 0) return;

    // Use review words as current batch temporarily
    isReviewMode = true;
    currentIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    totalAnswered = 0;

    closeModal('review-modal');
    generateQuestion();
    updateUI();
    saveProgress();
}

// ===== SETTINGS FUNCTIONS =====
function resetCurrentBatch() {
    if (confirm('Reset current batch progress? This will clear your answers for this batch.')) {
        correctCount = 0;
        wrongCount = 0;
        totalAnswered = 0;
        wrongAnswers = wrongAnswers.filter(wa =>
            !getCurrentBatch().some(w => w.chinese === wa.word.chinese)
        );
        reviewWords = reviewWords.filter(w =>
            !getCurrentBatch().some(bw => bw.chinese === w.chinese)
        );
        currentIndex = 0;
        generateQuestion();
        updateUI();
        updateReviewButton();
        saveProgress();
        closeModal('settings-modal');
    }
}

function resetAllProgress() {
    if (confirm('Reset ALL progress? This will clear all your saved progress and cannot be undone.')) {
        localStorage.removeItem('hskQuizProgress');
        localStorage.removeItem('hsk4-progress'); // Also remove old format
        currentBatch = 0;
        currentIndex = 0;
        correctCount = 0;
        wrongCount = 0;
        totalAnswered = 0;
        reviewWords = [];
        wrongAnswers = [];
        completedBatches.clear();
        batchPerformance = {};
        generateQuestion();
        updateUI();
        updateBatchInfo();
        updateReviewButton();
        closeModal('settings-modal');
    }
}

// ===== PROGRESS URL LOADING =====
function loadProgressFromURL() {
    const urlParams = new URLSearchParams(window.location.search);

    // Try new compressed format first
    let progressParam = urlParams.get('p');
    if (progressParam) {
        try {
            // Add padding back if needed
            let data = progressParam.replace(/-/g, '+').replace(/_/g, '/');
            while (data.length % 4) {
                data += '=';
            }

            // Decompress
            const decompressedData = LZString.decompressFromBase64(data);
            if (!decompressedData) {
                throw new Error('Decompression failed');
            }

            const progress = JSON.parse(decompressedData);

            if (progress && confirm('Load progress from shared link? This will replace your current progress.')) {
                // Load the progress data
                currentBatch = progress.b || 0;
                batchSize = progress.s || 50;
                currentIndex = progress.i || 0;
                correctCount = progress.c || 0;
                wrongCount = progress.w || 0;
                totalAnswered = progress.t || 0;
                isPinyinMode = progress.p !== false;
                reviewWords = (progress.r || []).map(chinese =>
                    vocabulary.find(w => w.chinese === chinese) || { chinese }
                ).filter(w => w.chinese);
                completedBatches = new Set(progress.d || []);

                // Clean URL
                window.history.replaceState({}, '', window.location.pathname);

                // Reload
                generateQuestion();
                updateUI();
                updateBatchInfo();
                updateReviewButton();
                saveProgress();

                alert('Progress loaded successfully!');
            }
        } catch (e) {
            console.error('Error loading compressed progress from URL:', e);
        }
    }
}

function getDeviceId() {
    let deviceId = localStorage.getItem('hskDeviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('hskDeviceId', deviceId);
    }
    return deviceId;
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Mode buttons
    modePinyinBtn.addEventListener('click', () => switchMode(true));
    modeEnglishBtn.addEventListener('click', () => switchMode(false));

    // Navigation buttons
    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            generateQuestion();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex < getCurrentBatch().length - 1) {
            currentIndex++;
            generateQuestion();
        }
    });

    // Action buttons
    skipBtn.addEventListener('click', skipQuestion);
    saveBtn.addEventListener('click', saveProgress);
    reviewBtn.addEventListener('click', () => showModal('review-modal'));

    // Batch size select
    batchSizeSelect.addEventListener('change', (e) => {
        changeBatchSize(e.target.value);
    });

    // Modal buttons
    statsBtn.addEventListener('click', () => showModal('analysis-modal'));
    shareBtn.addEventListener('click', () => showModal('share-modal'));
    batchNavBtn.addEventListener('click', () => showModal('batch-select-modal'));
    settingsBtn.addEventListener('click', () => showModal('settings-modal'));

    // Settings toggles
    showEnglishToggle.addEventListener('change', (e) => {
        showEnglishInPinyin = e.target.checked;
        generateQuestion();
        saveProgress();
    });

    autoProceedToggle.addEventListener('change', (e) => {
        autoProceed = e.target.checked;
        saveProgress();
    });

    soundToggle.addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
        saveProgress();
    });

    // Reset buttons
    resetBatchBtn.addEventListener('click', resetCurrentBatch);
    resetAllBtn.addEventListener('click', resetAllProgress);

    // Modal close buttons
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Close modal on backdrop click
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModal = Array.from(modals).find(modal =>
                getComputedStyle(modal).display === 'flex'
            );
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });

    // Keyboard shortcuts for options (1-4)
    document.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '4') {
            const optionIndex = parseInt(e.key) - 1;
            const options = document.querySelectorAll('.option');
            if (options[optionIndex] && !selectedOption) {
                selectOption(options[optionIndex]);
            }
        }
    });

    // Prevent double-tap zoom on mobile
    document.addEventListener('touchstart', function() {}, {passive: true});
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('hsk-theme', newTheme);
    localStorage.setItem('hsk4-theme', newTheme); // For compatibility
    themeIcon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

function switchMode(isPinyin) {
    isPinyinMode = isPinyin;
    modePinyinBtn.classList.toggle('active', isPinyin);
    modeEnglishBtn.classList.toggle('active', !isPinyin);

    // Regenerate question with new mode
    generateQuestion();
    saveProgress();
}
// Add this function to handle batch completion
function completeCurrentBatch() {
    const batchWords = getCurrentBatch();
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    // Mark batch as completed
    completedBatches.add(currentBatch);

    // Store performance data
    batchPerformance[currentBatch] = {
        correct: correctCount,
        total: batchWords.length,
        accuracy: accuracy
    };

    // Check if this is the last batch
    const totalBatches = Math.ceil(vocabulary.length / batchSize);
    const isLastBatch = currentBatch >= totalBatches - 1;

    if (isLastBatch) {
        // If last batch, show completion with different options
        showCompletionModal(true);
    } else {
        // Auto-advance to next batch after a delay
        setTimeout(() => {
            currentBatch++;
            currentIndex = 0;
            correctCount = 0;
            wrongCount = 0;
            totalAnswered = 0;
            selectedOption = null;

            // Show quick notification instead of full modal
            showQuickNotification(`Moving to Batch ${currentBatch + 1}`);

            // Generate new batch question
            generateQuestion();
            updateBatchInfo();
            saveProgress();
        }, 1500);
    }
}

// Add this helper function for notifications
function showQuickNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'quick-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        background: #4361ee;
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        z-index: 10000;
        animation: fadeInOut 2s ease;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// Update the checkAnswer function to use completeCurrentBatch
function checkAnswer(optionEl) {
    const isCorrect = optionEl.dataset.correct === 'true';
    const options = document.querySelectorAll('.option');
    const currentWord = getCurrentBatch()[currentIndex];

    // Disable all options
    options.forEach(opt => {
        opt.style.pointerEvents = 'none';
    });

    // Highlight correct/incorrect
    options.forEach(opt => {
        if (opt.dataset.correct === 'true') {
            opt.classList.add('correct');
        } else if (opt === optionEl) {
            opt.classList.add('incorrect');
        }
    });

    // Update stats
    totalAnswered++;
    if (isCorrect) {
        correctCount++;
        showFeedback('🎉 Correct! Well done!', 'correct');

        // Remove from review words if it was there
        const index = reviewWords.findIndex(w => w.chinese === currentWord.chinese);
        if (index > -1) {
            reviewWords.splice(index, 1);
            updateReviewButton();
        }
    } else {
        wrongCount++;
        const correctText = isPinyinMode ?
            `${currentWord.pinyin} - ${currentWord.english}` :
            currentWord.english;

        showFeedback(`❌ Incorrect.<br><strong>${correctText}</strong>`, 'incorrect');

        wrongAnswers.push({
            word: currentWord,
            selectedAnswer: optionEl.textContent,
            correctAnswer: correctText
        });

        // Add to review words if not already there
        if (!reviewWords.some(w => w.chinese === currentWord.chinese)) {
            reviewWords.push(currentWord);
            updateReviewButton();
        }
    }

    // Update UI
    updateUI();
    saveProgress();

    // Check if this was the last question in the batch
    const isLastQuestion = currentIndex >= getCurrentBatch().length - 1;

    if (isLastQuestion) {
        // If last question, complete the batch after delay
        setTimeout(() => {
            completeCurrentBatch();
        }, 2000);
    } else if (autoProceed) {
        // If not last question and auto-proceed is enabled, move to next question
        setTimeout(() => {
            currentIndex++;
            selectedOption = null;
            generateQuestion();
        }, 2000);
    }
}

// Update the skipQuestion function
function skipQuestion() {
    const isLastQuestion = currentIndex >= getCurrentBatch().length - 1;

    if (isLastQuestion) {
        completeCurrentBatch();
    } else {
        currentIndex++;
        selectedOption = null;
        generateQuestion();
    }
}

// Update the populateCompletionModal function for last batch
function populateCompletionModal(isFinal = false) {
    const batchWords = getCurrentBatch();
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const totalBatches = Math.ceil(vocabulary.length / batchSize);

    if (!isFinal) {
        // This should only be called for the final batch now
        return;
    }

    document.getElementById('completion-body').innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 48px; margin-bottom: 20px;">${isFinal ? '🏆' : '🎉'}</div>
            <h3 style="margin-bottom: 20px;">${isFinal ? 'All Batches Complete!' : 'Batch Complete!'}</h3>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-value">${batchWords.length}</div>
                    <div class="stat-label">Total</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${correctCount}</div>
                    <div class="stat-label">Correct</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${wrongCount}</div>
                    <div class="stat-label">Wrong</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${accuracy}%</div>
                    <div class="stat-label">Accuracy</div>
                </div>
            </div>

            <p style="color: #8e8e93; margin-bottom: 24px;">
                ${isFinal ?
                    `You've completed all ${totalBatches} batches! ${reviewWords.length > 0 ? 'You still have some words to review.' : 'Great work!'}` :
                    'Great job! Moving to next batch...'
                }
            </p>

            ${isFinal ? `
                <div style="display: flex; gap: 12px;">
                    ${reviewWords.length > 0 ? `
                        <button class="action-btn secondary" id="completion-review-btn" style="flex: 1;">
                            Review Mistakes
                        </button>
                    ` : ''}
                    <button class="action-btn primary" id="completion-restart-btn" style="flex: 1;">
                        Start Over
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    // Add event listeners for modal buttons
    document.getElementById('completion-review-btn')?.addEventListener('click', () => {
        closeModal('completion-modal');
        showModal('review-modal');
    });

    document.getElementById('completion-restart-btn')?.addEventListener('click', () => {
        currentBatch = 0;
        currentIndex = 0;
        correctCount = 0;
        wrongCount = 0;
        totalAnswered = 0;
        reviewWords = [];
        wrongAnswers = [];
        completedBatches.clear();
        batchPerformance = {};

        generateQuestion();
        updateBatchInfo();
        updateReviewButton();
        closeModal('completion-modal');
        saveProgress();
    });
}

// Update the showCompletionModal function
function showCompletionModal(isFinal = false) {
    if (isFinal) {
        populateCompletionModal(true);
        setTimeout(() => {
            showModal('completion-modal');
        }, 500);
    } else {
        // For non-final batches, we auto-advance, so no modal needed
        completeCurrentBatch();
    }
}

// Update the init function to add CSS for notifications
async function init() {
    try {
        // Add notification CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0%, 100% { opacity: 0; transform: translate(-50%, -20px); }
                50% { opacity: 1; transform: translate(-50%, 0); }
            }
        `;
        document.head.appendChild(style);

        // Load vocabulary
        await loadVocabulary();

        // Setup event listeners
        setupEventListeners();

        // Load saved progress (compatible with old system)
        loadProgress();

        // Check for progress in URL
        loadProgressFromURL();

        // Generate first question
        generateQuestion();

        // Hide loading screen
        loadingScreen.style.display = 'none';
        mainContainer.style.display = 'block';

    } catch (error) {
        console.error('Initialization error:', error);
        loadingScreen.style.display = 'none';
        errorMessage.style.display = 'flex';
    }
}



// Add this variable to track if we're in review mode
let reviewSessionOriginalBatch = null;
let reviewSessionOriginalIndex = null;

// Update the startReviewSession function
function startReviewSession() {
    if (reviewWords.length === 0) return;

    // Save current state to return to later
    reviewSessionOriginalBatch = currentBatch;
    reviewSessionOriginalIndex = currentIndex;

    // Set up review session
    isReviewMode = true;
    currentIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    totalAnswered = 0;
    selectedOption = null;

    // Close modal and update UI
    closeModal('review-modal');

    // Update header to show we're in review mode
    document.getElementById('app-title').textContent = 'Review Session';
    document.getElementById('app-subtitle').textContent = 'Practicing words you missed';

    // Show a notification
    showQuickNotification(`Starting review session with ${reviewWords.length} words`);

    // Generate first review question
    generateQuestion();
    updateUI();
    updateReviewButton();
    saveProgress();
}

// Add a function to end review session
function endReviewSession() {
    if (!isReviewMode) return;

    // Restore original state
    isReviewMode = false;
    if (reviewSessionOriginalBatch !== null) {
        currentBatch = reviewSessionOriginalBatch;
    }
    if (reviewSessionOriginalIndex !== null) {
        currentIndex = reviewSessionOriginalIndex;
    }

    reviewSessionOriginalBatch = null;
    reviewSessionOriginalIndex = null;

    // Restore original title
    document.getElementById('app-title').textContent = 'HSK Quiz';
    document.getElementById('app-subtitle').textContent = 'Match Chinese characters to their meanings';

    // Generate question from original batch
    generateQuestion();
    updateUI();
    saveProgress();
}

// Update the getCurrentBatch function to handle review mode
function getCurrentBatch() {
    if (isReviewMode) {
        return reviewWords;
    }
    const start = currentBatch * batchSize;
    const end = start + batchSize;
    return vocabulary.slice(start, Math.min(end, vocabulary.length));
}

// Update the updateBatchInfo function for review mode
function updateBatchInfo() {
    if (isReviewMode) {
        batchInfoEl.innerHTML = `
            <i class="fas fa-redo"></i>
            <span>Review: ${currentIndex + 1} of ${reviewWords.length} words</span>
        `;
    } else {
        const totalBatches = Math.ceil(vocabulary.length / batchSize);
        batchInfoEl.innerHTML = `
            <i class="fas fa-layer-group"></i>
            <span>Batch ${currentBatch + 1} of ${totalBatches} (${totalWordsCount} words)</span>
        `;
    }
}

// Update the completeCurrentBatch function for review mode
function completeCurrentBatch() {
    if (isReviewMode) {
        // Handle review session completion
        showReviewCompletionModal();
        return;
    }

    const batchWords = getCurrentBatch();
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    // Mark batch as completed
    completedBatches.add(currentBatch);

    // Store performance data
    batchPerformance[currentBatch] = {
        correct: correctCount,
        total: batchWords.length,
        accuracy: accuracy
    };

    // Check if this is the last batch
    const totalBatches = Math.ceil(vocabulary.length / batchSize);
    const isLastBatch = currentBatch >= totalBatches - 1;

    if (isLastBatch) {
        // If last batch, show completion with different options
        showCompletionModal(true);
    } else {
        // Auto-advance to next batch after a delay
        setTimeout(() => {
            currentBatch++;
            currentIndex = 0;
            correctCount = 0;
            wrongCount = 0;
            totalAnswered = 0;
            selectedOption = null;

            // Show quick notification instead of full modal
            showQuickNotification(`Moving to Batch ${currentBatch + 1}`);

            // Generate new batch question
            generateQuestion();
            updateBatchInfo();
            saveProgress();
        }, 1500);
    }
}

// Add a function for review completion modal
function showReviewCompletionModal() {
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    // Create and show modal
    const modalHTML = `
        <div class="modal" id="review-completion-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Review Session Complete!</h3>
                    <button class="modal-close" onclick="closeModal('review-completion-modal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 48px; margin-bottom: 20px;">📚</div>
                        <h3 style="margin-bottom: 20px;">Great Practice!</h3>

                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                            <div class="stat-card">
                                <div class="stat-value">${reviewWords.length}</div>
                                <div class="stat-label">Words Reviewed</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${correctCount}</div>
                                <div class="stat-label">Correct</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${wrongCount}</div>
                                <div class="stat-label">Wrong</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${accuracy}%</div>
                                <div class="stat-label">Accuracy</div>
                            </div>
                        </div>

                        <p style="color: #8e8e93; margin-bottom: 24px;">
                            ${reviewWords.length === 0 ?
                                'All words mastered! Great job!' :
                                `${reviewWords.length} words still need practice. Keep reviewing!`
                            }
                        </p>

                        <div style="display: flex; gap: 12px;">
                            ${reviewWords.length > 0 ? `
                                <button class="action-btn secondary" id="continue-review-btn" style="flex: 1;">
                                    Continue Review
                                </button>
                            ` : ''}
                            <button class="action-btn primary" id="end-review-btn" style="flex: 1;">
                                End Review Session
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('review-completion-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Show modal
    const modal = document.getElementById('review-completion-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Add event listeners
    setTimeout(() => {
        document.getElementById('continue-review-btn')?.addEventListener('click', () => {
            closeModal('review-completion-modal');
            // Reset counters and continue
            currentIndex = 0;
            correctCount = 0;
            wrongCount = 0;
            totalAnswered = 0;
            generateQuestion();
            updateUI();
        });

        document.getElementById('end-review-btn')?.addEventListener('click', () => {
            closeModal('review-completion-modal');
            endReviewSession();
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal('review-completion-modal');
                endReviewSession();
            }
        });
    }, 100);
}

// Update the closeModal function to handle our dynamically created modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';

        // Remove from DOM if it's our review completion modal
        if (modalId === 'review-completion-modal') {
            setTimeout(() => modal.remove(), 300);
        }
    }
}

// Update the checkAnswer function to handle review mode properly
function checkAnswer(optionEl) {
    const isCorrect = optionEl.dataset.correct === 'true';
    const options = document.querySelectorAll('.option');
    const currentWord = getCurrentBatch()[currentIndex];

    // Disable all options
    options.forEach(opt => {
        opt.style.pointerEvents = 'none';
    });

    // Highlight correct/incorrect
    options.forEach(opt => {
        if (opt.dataset.correct === 'true') {
            opt.classList.add('correct');
        } else if (opt === optionEl) {
            opt.classList.add('incorrect');
        }
    });

    // Update stats
    totalAnswered++;
    if (isCorrect) {
        correctCount++;
        showFeedback('🎉 Correct! Well done!', 'correct');

        // Remove from review words if it was there (only in review mode)
        if (isReviewMode) {
            const index = reviewWords.findIndex(w => w.chinese === currentWord.chinese);
            if (index > -1) {
                reviewWords.splice(index, 1);
                updateReviewButton();
            }
        }
    } else {
        wrongCount++;
        const correctText = isPinyinMode ?
            `${currentWord.pinyin} - ${currentWord.english}` :
            currentWord.english;

        showFeedback(`❌ Incorrect.<br><strong>${correctText}</strong>`, 'incorrect');

        // Only add to wrongAnswers if not in review mode
        if (!isReviewMode) {
            wrongAnswers.push({
                word: currentWord,
                selectedAnswer: optionEl.textContent,
                correctAnswer: correctText
            });

            // Add to review words if not already there
            if (!reviewWords.some(w => w.chinese === currentWord.chinese)) {
                reviewWords.push(currentWord);
                updateReviewButton();
            }
        }
    }

    // Update UI
    updateUI();
    saveProgress();

    // Check if this was the last question
    const isLastQuestion = currentIndex >= getCurrentBatch().length - 1;

    if (isLastQuestion) {
        // If last question, complete the batch/session after delay
        setTimeout(() => {
            if (isReviewMode && reviewWords.length === 0) {
                // If all review words are mastered
                showReviewCompletionModal();
            } else if (isReviewMode) {
                // If still have review words, ask to continue
                showReviewCompletionModal();
            } else {
                // Normal batch completion
                completeCurrentBatch();
            }
        }, 2000);
    } else if (autoProceed) {
        // If not last question and auto-proceed is enabled, move to next question
        setTimeout(() => {
            currentIndex++;
            selectedOption = null;
            generateQuestion();
        }, 2000);
    }
}

// Update the generateOptions function to handle review mode
function generateOptions(correctWord) {
    let options = [correctWord];

    if (isReviewMode) {
        // In review mode, use the entire vocabulary for distractors
        while (options.length < 4) {
            const randomIndex = Math.floor(Math.random() * vocabulary.length);
            const randomWord = vocabulary[randomIndex];

            if (!options.some(w => w.chinese === randomWord.chinese)) {
                options.push(randomWord);
            }
        }
    } else {
        // Normal mode logic (unchanged)
        const batchWords = getCurrentBatch();
        const similarWords = similarWordsMap[correctWord.chinese] || [];

        // Add similar words
        for (const similarWord of similarWords) {
            if (options.length >= 4) break;
            if (similarWord.chinese !== correctWord.chinese) {
                options.push(similarWord);
            }
        }

        // Fill remaining with random words
        while (options.length < 4) {
            const randomIndex = Math.floor(Math.random() * batchWords.length);
            const randomWord = batchWords[randomIndex];

            if (!options.some(w => w.chinese === randomWord.chinese)) {
                options.push(randomWord);
            }
        }
    }

    // Deterministic shuffle
    deterministicShuffle(options, correctWord.chinese);

    // Clear options container
    optionsEl.innerHTML = '';

    // Create option elements
    options.forEach((word, index) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'option';
        optionEl.dataset.index = index;
        optionEl.dataset.correct = word.chinese === correctWord.chinese;

        const content = document.createElement('div');
        content.className = 'option-content';

        if (isPinyinMode && showEnglishInPinyin) {
            // Show both pinyin and English
            const pinyinEl = document.createElement('div');
            pinyinEl.className = 'option-pinyin';
            pinyinEl.textContent = word.pinyin;

            const englishEl = document.createElement('div');
            englishEl.className = 'option-english';
            englishEl.textContent = word.english;

            content.appendChild(pinyinEl);
            content.appendChild(englishEl);
        } else if (isPinyinMode) {
            // Show only pinyin
            const text = document.createElement('div');
            text.className = 'option-text';
            text.textContent = word.pinyin;
            content.appendChild(text);
        } else {
            // Show only English
            const text = document.createElement('div');
            text.className = 'option-text';
            text.textContent = word.english;
            content.appendChild(text);
        }

        optionEl.appendChild(content);

        // Add click event
        optionEl.addEventListener('click', () => selectOption(optionEl));
        optionEl.addEventListener('touchstart', handleTouchStart, { passive: true });
        optionEl.addEventListener('touchend', handleTouchEnd, { passive: true });

        optionsEl.appendChild(optionEl);
    });
}

// Add an "Exit Review" button to the action buttons in review mode
// We'll update this dynamically
function updateActionButtonsForReviewMode() {
    if (isReviewMode) {
        // Replace the review button with exit review button
        reviewBtn.innerHTML = `
            <i class="fas fa-sign-out-alt"></i>
            <span class="btn-text">Exit Review</span>
        `;
        reviewBtn.style.display = 'flex';

        // Update click handler
        reviewBtn.onclick = endReviewSession;
    } else {
        // Restore normal review button
        updateReviewButton();
        reviewBtn.onclick = () => showModal('review-modal');
    }
}

// Call this when entering/exiting review mode
function startReviewSession() {
    if (reviewWords.length === 0) return;

    // Save current state to return to later
    reviewSessionOriginalBatch = currentBatch;
    reviewSessionOriginalIndex = currentIndex;

    // Set up review session
    isReviewMode = true;
    currentIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    totalAnswered = 0;
    selectedOption = null;

    // Close modal and update UI
    closeModal('review-modal');

    // Update header to show we're in review mode
    document.getElementById('app-title').textContent = 'Review Session';
    document.getElementById('app-subtitle').textContent = 'Practicing words you missed';

    // Update action buttons
    updateActionButtonsForReviewMode();

    // Show a notification
    showQuickNotification(`Starting review session with ${reviewWords.length} words`);

    // Generate first review question
    generateQuestion();
    updateUI();
    updateBatchInfo();
    saveProgress();
}

function endReviewSession() {
    if (!isReviewMode) return;

    // Restore original state
    isReviewMode = false;
    if (reviewSessionOriginalBatch !== null) {
        currentBatch = reviewSessionOriginalBatch;
    }
    if (reviewSessionOriginalIndex !== null) {
        currentIndex = reviewSessionOriginalIndex;
    }

    reviewSessionOriginalBatch = null;
    reviewSessionOriginalIndex = null;

    // Restore original title
    document.getElementById('app-title').textContent = 'HSK Quiz';
    document.getElementById('app-subtitle').textContent = 'Match Chinese characters to their meanings';

    // Restore action buttons
    updateActionButtonsForReviewMode();

    // Generate question from original batch
    generateQuestion();
    updateUI();
    updateBatchInfo();
    saveProgress();
}


// ===== TEXT-TO-SPEECH (SPEAKER BUTTON) =====
let speechSynthesisSupported = 'speechSynthesis' in window;
let isSpeaking = false;

// Preferred Chinese voice (cached after first lookup)
let chineseVoice = null;

function getChineseVoice() {
    if (chineseVoice) return chineseVoice;
    const voices = window.speechSynthesis.getVoices();
    // Prefer Mandarin/Chinese voices
    const preferred = voices.find(v =>
        v.lang === 'zh-CN' || v.lang === 'zh-TW' ||
        v.lang === 'zh' || v.lang.startsWith('zh-')
    );
    chineseVoice = preferred || null;
    return chineseVoice;
}

// Voices may load asynchronously — refresh cache when they do
if (speechSynthesisSupported) {
    window.speechSynthesis.onvoiceschanged = () => {
        chineseVoice = null; // reset cache so next call re-fetches
        getChineseVoice();
    };
}

function speakCurrentWord() {
    const speakerBtn = document.getElementById('speaker-btn');
    const speakerIconEl = document.getElementById('speaker-icon');

    if (!speechSynthesisSupported) {
        speakerBtn.classList.add('not-supported');
        speakerBtn.title = 'Speech not supported in this browser';
        return;
    }

    // Get the current word
    const batchWords = getCurrentBatch();
    if (!batchWords || batchWords.length === 0) return;
    const word = batchWords[currentIndex];
    if (!word) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    if (isSpeaking) {
        // Toggle off if already speaking
        isSpeaking = false;
        speakerBtn.classList.remove('speaking');
        speakerIconEl.className = 'fas fa-volume-up';
        return;
    }

    const utterance = new SpeechSynthesisUtterance(word.chinese);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;   // Slightly slower — better for learning
    utterance.pitch = 1.0;

    const voice = getChineseVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
        isSpeaking = true;
        speakerBtn.classList.add('speaking');
        speakerIconEl.className = 'fas fa-volume-up';
    };

    utterance.onend = () => {
        isSpeaking = false;
        speakerBtn.classList.remove('speaking');
        speakerIconEl.className = 'fas fa-volume-up';
    };

    utterance.onerror = () => {
        isSpeaking = false;
        speakerBtn.classList.remove('speaking');
        speakerIconEl.className = 'fas fa-volume-up';
    };

    window.speechSynthesis.speak(utterance);
}

function initSpeakerButton() {
    const speakerBtn = document.getElementById('speaker-btn');
    if (!speakerBtn) return;

    if (!speechSynthesisSupported) {
        speakerBtn.classList.add('not-supported');
        speakerBtn.title = 'Speech synthesis not supported in this browser';
        return;
    }

    speakerBtn.addEventListener('click', speakCurrentWord);
    speakerBtn.addEventListener('touchend', (e) => {
        e.preventDefault(); // Prevent double-fire on mobile
        speakCurrentWord();
    });
}

// Stop speaking when moving to a new question (so the animation resets)
function stopSpeaking() {
    if (speechSynthesisSupported) {
        window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    const speakerBtn = document.getElementById('speaker-btn');
    const speakerIconEl = document.getElementById('speaker-icon');
    if (speakerBtn) speakerBtn.classList.remove('speaking');
    if (speakerIconEl) speakerIconEl.className = 'fas fa-volume-up';
}

// ===== INITIALIZE APP =====
// Load saved theme
const savedTheme = localStorage.getItem('hsk-theme') || localStorage.getItem('hsk4-theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);
themeIcon.className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

// Start the app
document.addEventListener('DOMContentLoaded', init);