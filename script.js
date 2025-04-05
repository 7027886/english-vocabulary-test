// 从外部加载词汇表
let words = [];
let currentWordIndex = 0;
let score = 0;
let selectedDifficulty = 'all'; // 默认选择所有难度
let wrongAnswers = []; // 错题本
let testHistory = []; // 测试历史记录
const WORDS_PER_TEST = 10; // 每轮测试的单词数量

// 模拟排行榜数据（实际应用中应该从服务器获取）
let leaderboardData = {
    'all': [],
    'basic': [],
    'intermediate': [],
    'advanced': []
};

// 获取DOM元素
const wordDisplay = document.getElementById('word-display');
const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');

// 加载词汇表
async function loadWords() {
    try {
        const response = await fetch('data/words.json');
        words = await response.json();
        // 处理词汇数据格式
        words = words.map(item => {
            const word = item.english || item.B;
            const meaning = item.chinese || item.A;
            const phonetic = item.phonetic || ''; // 添加音标支持
            // 判断难度级别
            let difficulty = 'basic'; // 默认基础难度
            if (word.includes('**')) {
                difficulty = 'advanced';
            } else if (word.includes('*')) {
                difficulty = 'intermediate';
            }
            return {
                word: word.replace(/\*/g, ''), // 移除*号
                meaning,
                phonetic,
                difficulty
            };
        });
        console.log('词汇表加载成功，共', words.length, '个单词');
        showHomePage();
    } catch (error) {
        console.error('加载词汇表失败:', error);
        wordDisplay.innerHTML = '<h2>加载词汇表失败，请刷新页面重试</h2>';
    }
}

// 显示主页
function showHomePage() {
    wordDisplay.innerHTML = `
        <div class="home-options">
            <button onclick="showDifficultySelection()" class="btn home-btn">开始测试</button>
            <button onclick="showWrongAnswers()" class="btn home-btn">查看错题本</button>
            <button onclick="showTestHistory()" class="btn home-btn">查看历史成绩</button>
            <button onclick="showLeaderboard()" class="btn home-btn">查看排行榜</button>
        </div>
    `;
}

// 显示难度选择界面
function showDifficultySelection() {
    wordDisplay.innerHTML = `
        <div>
            <h2>请选择测试难度：</h2>
            <div class="difficulty-options">
                <button onclick="setDifficulty('all')" class="btn difficulty-btn">全部词汇</button>
                <button onclick="setDifficulty('basic')" class="btn difficulty-btn">基础词汇</button>
                <button onclick="setDifficulty('intermediate')" class="btn difficulty-btn">高中词汇</button>
                <button onclick="setDifficulty('advanced')" class="btn difficulty-btn">选择性必修词汇</button>
            </div>
            <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
        </div>
    `;
}

// 设置难度并开始测试
function setDifficulty(difficulty) {
    selectedDifficulty = difficulty;
    startTest();
}

// 生成随机选项
function generateOptions(currentWord) {
    // 获取当前单词的正确释义
    const correctMeaning = currentWord.meaning;
    
    // 从词汇表中随机选择两个不同的错误选项
    let options = [correctMeaning];
    let availableWords = words.filter(w => 
        w.meaning !== correctMeaning && 
        (selectedDifficulty === 'all' || w.difficulty === selectedDifficulty)
    );
    
    // 随机选择两个错误选项
    for (let i = 0; i < 2; i++) {
        const randomIndex = Math.floor(Math.random() * availableWords.length);
        options.push(availableWords[randomIndex].meaning);
        availableWords.splice(randomIndex, 1);
    }
    
    // 打乱选项顺序
    return options.sort(() => Math.random() - 0.5);
}

// 页面加载时获取词汇表
loadWords();

// 开始测试
function startTest() {
    if (words.length === 0) {
        wordDisplay.innerHTML = '<h2>请等待词汇表加载完成</h2>';
        return;
    }
    
    // 根据难度筛选单词
    let testWords = words;
    if (selectedDifficulty !== 'all') {
        testWords = words.filter(w => w.difficulty === selectedDifficulty);
    }
    
    // 随机选择20个单词
    testWords = testWords.sort(() => Math.random() - 0.5).slice(0, WORDS_PER_TEST);
    
    currentWordIndex = 0;
    score = 0;
    wrongAnswers = [];
    updateProgress();
    showNextWord();
    startBtn.style.display = 'none';
    nextBtn.style.display = 'none';
}

// 显示下一个单词
function showNextWord() {
    if (currentWordIndex < WORDS_PER_TEST) {
        const currentWord = words[currentWordIndex];
        const options = generateOptions(currentWord);
        
        wordDisplay.innerHTML = `
            <div class="test-word-container">
                <div class="word-header">
                    <h2>${currentWord.word}</h2>
                    <button onclick="playWord('${currentWord.word}')" class="btn play-btn" title="播放发音">
                        <span>🔊</span>
                    </button>
                </div>
                ${currentWord.phonetic ? `<p class="word-phonetic">${currentWord.phonetic}</p>` : ''}
                <p class="difficulty-tag ${currentWord.difficulty}">${getDifficultyText(currentWord.difficulty)}</p>
                <p class="choose-text">请选择正确的中文释义：</p>
                <div class="options">
                    ${options.map((option, index) => `
                        <button onclick="checkAnswer('${option}')" class="btn option-btn">
                            ${option}
                        </button>
                    `).join('')}
                </div>
                <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
            </div>
        `;
    } else {
        showResults();
    }
}

// 获取难度文本
function getDifficultyText(difficulty) {
    switch(difficulty) {
        case 'basic': return '基础词汇';
        case 'intermediate': return '高中词汇';
        case 'advanced': return '选择性必修词汇';
        default: return '未知难度';
    }
}

// 检查答案
function checkAnswer(selectedMeaning) {
    const currentWord = words[currentWordIndex];
    const isCorrect = selectedMeaning === currentWord.meaning;
    
    if (isCorrect) {
        score++;
    } else {
        // 添加到错题本，包含音标
        wrongAnswers.push({
            word: currentWord.word,
            meaning: currentWord.meaning,
            phonetic: currentWord.phonetic,  // 确保保存音标
            difficulty: currentWord.difficulty
        });
    }
    
    // 显示答题反馈
    const feedback = document.createElement('div');
    feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    feedback.innerHTML = `
        <p>${isCorrect ? '回答正确！' : '回答错误'}</p>
        <p>正确答案是：${currentWord.meaning}</p>
    `;
    
    wordDisplay.appendChild(feedback);
    
    // 延迟后进入下一题
    setTimeout(() => {
        currentWordIndex++;
        updateProgress();
        showNextWord();
    }, 1500);
}

// 更新进度
function updateProgress() {
    const progress = (currentWordIndex / WORDS_PER_TEST) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${currentWordIndex}/${WORDS_PER_TEST}`;
}

// 显示结果
function showResults() {
    const percentage = (score / WORDS_PER_TEST) * 100;
    const testResult = {
        date: new Date().toLocaleString(),
        difficulty: selectedDifficulty,
        score: score,
        total: WORDS_PER_TEST,
        percentage: percentage
    };
    testHistory.push(testResult);
    
    // 更新排行榜
    updateLeaderboard(testResult);
    
    wordDisplay.innerHTML = `
        <div>
            <h2>测试完成！</h2>
            <p>你答对了 ${score} 个单词，正确率为 ${percentage.toFixed(1)}%</p>
            ${wrongAnswers.length > 0 ? `
                <div class="wrong-answers">
                    <h3>错题本（${wrongAnswers.length}题）</h3>
                    <div class="wrong-answers-list">
                        ${wrongAnswers.map(item => `
                            <div class="wrong-answer-item">
                                <div class="word-header">
                                    <strong>${item.word}</strong>
                                    ${item.phonetic ? `<span class="word-phonetic">${item.phonetic}</span>` : ''}
                                    <button onclick="playWord('${item.word}')" class="btn play-btn" title="播放发音">
                                        <span>🔊</span>
                                    </button>
                                </div>
                                <p class="word-meaning">${item.meaning}</p>
                                <span class="difficulty-tag ${item.difficulty}">${getDifficultyText(item.difficulty)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="result-actions">
                <button onclick="showHomePage()" class="btn">返回主页</button>
                <button onclick="showDifficultySelection()" class="btn">重新测试</button>
                <button onclick="showLeaderboard()" class="btn">查看排行榜</button>
            </div>
        </div>
    `;
}

// 更新排行榜
function updateLeaderboard(testResult) {
    // 添加到对应难度的排行榜
    leaderboardData[testResult.difficulty].push({
        date: testResult.date,
        score: testResult.score,
        percentage: testResult.percentage
    });
    
    // 对每个难度的排行榜进行排序
    Object.keys(leaderboardData).forEach(difficulty => {
        leaderboardData[difficulty].sort((a, b) => b.percentage - a.percentage);
        // 只保留前100名
        if (leaderboardData[difficulty].length > 100) {
            leaderboardData[difficulty] = leaderboardData[difficulty].slice(0, 100);
        }
    });
}

// 显示排行榜
function showLeaderboard(difficulty = 'all') {
    const leaderboard = leaderboardData[difficulty];
    
    wordDisplay.innerHTML = `
        <div>
            <h2>排行榜</h2>
            <div class="leaderboard-tabs">
                <button onclick="showLeaderboard('all')" class="tab-btn ${difficulty === 'all' ? 'active' : ''}">全部词汇</button>
                <button onclick="showLeaderboard('basic')" class="tab-btn ${difficulty === 'basic' ? 'active' : ''}">基础词汇</button>
                <button onclick="showLeaderboard('intermediate')" class="tab-btn ${difficulty === 'intermediate' ? 'active' : ''}">高中词汇</button>
                <button onclick="showLeaderboard('advanced')" class="tab-btn ${difficulty === 'advanced' ? 'active' : ''}">选择性必修词汇</button>
            </div>
            <div class="leaderboard-list">
                ${leaderboard.length > 0 ? leaderboard.map((item, index) => `
                    <div class="leaderboard-item">
                        <span class="rank ${index < 3 ? `rank-${index + 1}` : ''}">${index + 1}</span>
                        <div class="score-info">
                            <p>得分：${item.score}/${WORDS_PER_TEST}</p>
                            <p>正确率：<span class="score-percentage">${item.percentage.toFixed(1)}%</span></p>
                            <p>日期：${item.date}</p>
                        </div>
                    </div>
                `).join('') : '<p>暂无排名数据</p>'}
            </div>
            <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
        </div>
    `;
}

// 显示错题本
function showWrongAnswers() {
    if (wrongAnswers.length === 0) {
        wordDisplay.innerHTML = `
            <div>
                <h2>错题本</h2>
                <p>暂无错题记录</p>
                <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
            </div>
        `;
        return;
    }
    
    wordDisplay.innerHTML = `
        <div>
            <h2>错题本</h2>
            <div class="wrong-answers-list">
                ${wrongAnswers.map(item => `
                    <div class="wrong-answer-item">
                        <div class="word-info">
                            <div class="word-header">
                                <strong class="word-text">${item.word}</strong>
                                <button onclick="playWord('${item.word}')" class="btn play-btn" title="播放发音">
                                    <span>🔊</span>
                                </button>
                                <span class="difficulty-tag ${item.difficulty}">${getDifficultyText(item.difficulty)}</span>
                            </div>
                            ${item.phonetic ? `<span class="word-phonetic">${item.phonetic}</span>` : ''}
                            <p class="word-meaning">${item.meaning}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
        </div>
    `;
}

// 添加单词发音功能
function playWord(word) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';  // 设置为英语发音
    speechSynthesis.speak(utterance);
}

// 显示历史成绩
function showTestHistory() {
    if (testHistory.length === 0) {
        wordDisplay.innerHTML = `
            <div>
                <h2>历史成绩</h2>
                <p>暂无测试记录</p>
                <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
            </div>
        `;
        return;
    }
    
    wordDisplay.innerHTML = `
        <div>
            <h2>历史成绩</h2>
            <div class="test-history">
                ${testHistory.map(test => `
                    <div class="test-history-item">
                        <p>日期：${test.date}</p>
                        <p>难度：${getDifficultyText(test.difficulty)}</p>
                        <p>得分：${test.score}/${test.total} (${test.percentage.toFixed(1)}%)</p>
                    </div>
                `).join('')}
            </div>
            <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
        </div>
    `;
} 