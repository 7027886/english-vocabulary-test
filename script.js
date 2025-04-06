// 从外部加载词汇表
let words = [];
let testWords = []; // 当前测试的单词
let currentWordIndex = 0;
let score = 0;
let selectedDifficulty = 'all'; // 默认选择所有难度
let wrongAnswers = []; // 错题本
let testHistory = []; // 测试历史记录
const WORDS_PER_TEST = 10; // 每轮测试的单词数量

// 用户答题记录
let userAnswers = []; // 记录用户的选择
let isReviewing = false; // 是否在复查模式

// 语音合成相关变量
let synth = window.speechSynthesis;
let voices = [];
let isSpeaking = false;
let voicesLoaded = false;

// 初始化语音
function initSpeech() {
    if (!synth) {
        console.error('浏览器不支持语音合成');
        return;
    }
    
    // 添加语音变化事件监听器
    synth.addEventListener('voiceschanged', () => {
        voices = synth.getVoices();
        console.log('语音列表已更新，可用语音数量:', voices.length);
        if (voices.length > 0) {
            voicesLoaded = true;
            // 尝试预加载一个英语语音
            let englishVoice = voices.find(v => v.lang.includes('en-US') && !v.name.includes('Microsoft'));
            if (!englishVoice) {
                englishVoice = voices.find(v => v.lang.includes('en'));
            }
            if (englishVoice) {
                console.log('已选择英语语音:', englishVoice.name);
            }
        }
    });
    
    // 立即尝试获取语音列表
    voices = synth.getVoices();
    if (voices.length > 0) {
        voicesLoaded = true;
        console.log('语音列表已加载，可用语音数量:', voices.length);
    } else {
        console.log('等待语音列表加载...');
    }
}

// 页面加载时初始化
window.addEventListener('load', () => {
    console.log('页面完全加载完成，初始化语音...');
    initSpeech();
});

// DOM加载完成时初始化词汇表
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，加载词汇表...');
    loadWords();
});

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
function loadWords() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', './data/words.json', true);
    
    xhr.onload = function() {
        if (xhr.status === 200) {
            try {
                const data = JSON.parse(xhr.responseText);
                
                if (!Array.isArray(data)) {
                    throw new Error('词汇表格式错误：数据不是数组格式');
                }
                
                if (data.length === 0) {
                    throw new Error('词汇表为空');
                }
                
                words = data.map(item => {
                    if (!item.english || !item.chinese) {
                        console.warn('跳过无效的词条:', item);
                        return null;
                    }
                    
                    let word = item.english;
                    let meaning = item.chinese;
                    let phonetic = item.phonetic || '';
                    
                    // 提取词性标注（如果存在）
                    let partOfSpeech = '';
                    const posMatch = meaning.match(/^([a-zA-Z]+\.|[a-zA-Z]+\.[a-zA-Z]+\.)\s*/);
                    if (posMatch) {
                        partOfSpeech = posMatch[1];
                        meaning = meaning.substring(posMatch[0].length);
                    }
                    
                    // 移除中文释义前的英文单词和词组，但保留词性标注
                    if (!partOfSpeech) {
                        const wordMatch = meaning.match(/^([a-zA-Z]+\.|[a-zA-Z]+\.[a-zA-Z]+\.)\s*/);
                        if (wordMatch) {
                            partOfSpeech = wordMatch[1];
                            meaning = meaning.substring(wordMatch[0].length);
                        }
                    }
                    
                    // 移除其他英文内容，但保留词性标注
                    meaning = meaning.replace(/^[a-zA-Z\s,]+(?![a-zA-Z]+\.)/, '');
                    meaning = meaning.replace(/=\w+\s*\[.*?\]\s*\w+\.\s*/g, '');
                    
                    // 处理音标
                    if (!phonetic || phonetic === '//' || phonetic === '/') {
                        const phoneticMatch = meaning.match(/\[(.*?)\]/);
                        if (phoneticMatch) {
                            phonetic = '/' + phoneticMatch[1] + '/';
                            meaning = meaning.replace(/\[.*?\]/, '').trim();
                        } else {
                            console.warn('缺少音标的单词:', word);
                        }
                    }
                    
                    // 移除开头的点号（如果存在且没有词性标注）
                    if (!partOfSpeech) {
                        meaning = meaning.replace(/^[.．。]\s*/, '');
                    }
                    
                    // 清理和规范化中文释义
                    meaning = meaning.replace(/\s*,\s*/g, '，');
                    meaning = meaning.replace(/\s+/g, ' ').trim();
                    
                    // 如果有词性标注，添加到释义前面
                    if (partOfSpeech) {
                        meaning = partOfSpeech + ' ' + meaning;
                        console.log(`处理词性标注: ${word} -> ${partOfSpeech} ${meaning}`);
                    }
                    
                    // 如果清理后的释义为空，使用原始释义
                    if (!meaning) {
                        meaning = item.chinese.trim();
                    }
                    
                    // 判断难度级别
                    let difficulty = 'basic';
                    if (word.includes('**')) {
                        difficulty = 'advanced';
                    } else if (word.includes('*')) {
                        difficulty = 'intermediate';
                    }
                    
                    return {
                        word: word.replace(/\*+/g, ''),
                        meaning: meaning,
                        phonetic: phonetic.trim(),
                        difficulty
                    };
                }).filter(item => item !== null);
                
                if (words.length === 0) {
                    throw new Error('处理后的词汇表为空');
                }
                
                console.log('词汇表加载成功，共', words.length, '个单词');
                // 检查并报告缺少音标的单词数量
                const wordsWithoutPhonetic = words.filter(w => !w.phonetic).length;
                if (wordsWithoutPhonetic > 0) {
                    console.warn(`警告：有 ${wordsWithoutPhonetic} 个单词缺少音标`);
                }
                
                showHomePage();
            } catch (error) {
                console.error('处理词汇表数据失败:', error);
                showError('处理词汇表数据失败: ' + error.message);
            }
        } else {
            console.error('加载词汇表失败:', xhr.status, xhr.statusText);
            showError('加载词汇表失败: ' + xhr.statusText);
        }
    };
    
    xhr.onerror = function() {
        console.error('网络请求失败');
        showError('网络请求失败，请确保使用本地服务器运行此网站');
    };
    
    try {
        xhr.send();
    } catch (error) {
        console.error('发送请求失败:', error);
        showError('发送请求失败: ' + error.message);
    }
}

// 显示错误信息
function showError(message) {
    wordDisplay.innerHTML = `
        <div class="error-message">
            <h2>加载词汇表失败</h2>
            <p>请使用本地服务器运行此网站</p>
            <p>错误信息：${message}</p>
            <div class="error-help">
                <p>解决方法：</p>
                <ol>
                    <li>使用Python启动本地服务器：
                        <pre>python -m http.server 8000</pre>
                    </li>
                    <li>然后在浏览器中访问：
                        <pre>http://localhost:8000</pre>
                    </li>
                </ol>
            </div>
            <button onclick="location.reload()" class="btn">重新加载</button>
        </div>
    `;
}

// 显示主页
function showHomePage() {
    // 重置进度条
    progressFill.style.width = '0%';
    progressText.textContent = '0/10';
    
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
    // 获取当前单词的正确释义（包含词性标注）
    const correctMeaning = currentWord.meaning;
    
    // 从词汇表中随机选择两个不同的错误选项
    let options = [correctMeaning];
    let availableWords = words.filter(w => {
        return w.meaning !== correctMeaning && 
               (selectedDifficulty === 'all' || w.difficulty === selectedDifficulty);
    });
    
    // 如果可用的错误选项不足，使用所有难度的单词
    if (availableWords.length < 2) {
        availableWords = words.filter(w => w.meaning !== correctMeaning);
    }
    
    // 随机选择两个错误选项
    for (let i = 0; i < 2 && availableWords.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableWords.length);
        options.push(availableWords[randomIndex].meaning);
        availableWords.splice(randomIndex, 1);
    }
    
    // 打乱选项顺序
    return options.sort(() => Math.random() - 0.5);
}

// 开始测试
function startTest() {
    if (words.length === 0) {
        wordDisplay.innerHTML = '<h2>请等待词汇表加载完成</h2>';
        return;
    }
    
    // 根据难度筛选单词
    let availableWords = words;
    if (selectedDifficulty !== 'all') {
        availableWords = words.filter(w => w.difficulty === selectedDifficulty);
    }
    
    // 随机选择单词
    testWords = availableWords.sort(() => Math.random() - 0.5).slice(0, WORDS_PER_TEST);
    
    currentWordIndex = 0;
    score = 0;
    wrongAnswers = [];
    userAnswers = []; // 重置用户答题记录
    isReviewing = false; // 重置复查模式
    updateProgress();
    showNextWord();
}

// 显示下一个单词
function showNextWord() {
    if (currentWordIndex < WORDS_PER_TEST) {
        const currentWord = testWords[currentWordIndex];
        const options = generateOptions(currentWord);
        const userAnswer = userAnswers[currentWordIndex];
        const showPrevButton = currentWordIndex > 0; // 从第二题开始显示上一步按钮
        
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
                        <button onclick="checkAnswer('${option}')" class="btn option-btn${userAnswer ? (option === currentWord.meaning ? ' correct-answer' : (option === userAnswer ? ' incorrect-answer' : '')) : ''}"${userAnswer ? ' disabled' : ''}>
                            ${option}
                        </button>
                    `).join('')}
                </div>
                ${userAnswer ? `
                    <div class="feedback-container">
                        <div class="feedback ${userAnswer === currentWord.meaning ? 'correct' : 'incorrect'}">
                            <div class="feedback-content">
                                <h3>${userAnswer === currentWord.meaning ? '✓ 回答正确！' : '✗ 回答错误'}</h3>
                                <p>正确答案：${currentWord.meaning}</p>
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="navigation-buttons">
                    ${showPrevButton ? `<button onclick="showPreviousWord()" class="btn nav-btn">上一步</button>` : ''}
                    ${userAnswer ? `<button onclick="proceedToNext()" class="btn nav-btn">下一步</button>` : ''}
                </div>
            </div>
        `;
    } else {
        showResults();
    }
}

// 显示上一个单词
function showPreviousWord() {
    if (currentWordIndex > 0) {
        isReviewing = true;
        currentWordIndex--;
        updateProgress();
        showNextWord();
    }
}

// 检查答案
function checkAnswer(selectedAnswer) {
    if (isReviewing) return; // 复查模式下不允许重新作答
    
    const currentWord = testWords[currentWordIndex];
    const isCorrect = selectedAnswer === currentWord.meaning;
    
    // 记录用户选择
    userAnswers[currentWordIndex] = selectedAnswer;
    
    if (isCorrect) {
        score++;
    } else {
        wrongAnswers.push({
            word: currentWord.word,
            phonetic: currentWord.phonetic,
            meaning: currentWord.meaning,
            difficulty: currentWord.difficulty
        });
    }
    
    // 更新界面显示
    showNextWord();
}

// 进入下一题
function proceedToNext() {
    if (currentWordIndex < WORDS_PER_TEST - 1) {
        isReviewing = false;
        currentWordIndex++;
        updateProgress();
        showNextWord();
    } else {
        showResults();
    }
}

// 更新进度
function updateProgress() {
    const progress = (currentWordIndex / WORDS_PER_TEST) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${currentWordIndex}/${WORDS_PER_TEST}`;
}

// 显示结果
function showResults() {
    // 更新进度条到最终状态
    progressFill.style.width = '100%';
    progressText.textContent = `${WORDS_PER_TEST}/${WORDS_PER_TEST}`;
    
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
        <div class="results-container">
            <h2>测试完成！</h2>
            <p>你答对了 ${score} 个单词，正确率为 ${percentage.toFixed(1)}%</p>
            ${wrongAnswers.length > 0 ? `
                <div class="wrong-answers">
                    <h3>错题本（${wrongAnswers.length}题）</h3>
                    <div class="wrong-answers-list">
                        ${wrongAnswers.map(item => `
                            <div class="wrong-answer-item">
                                <div class="word-info">
                                    <span class="word">${item.word}</span>
                                    <button onclick="playWord('${item.word}')" class="btn play-btn" title="播放发音">
                                        <span>🔊</span>
                                    </button>
                                    ${item.phonetic ? `<span class="phonetic">${item.phonetic}</span>` : ''}
                                </div>
                                <div class="meaning">${item.meaning}</div>
                                <span class="difficulty-tag ${item.difficulty}">${getDifficultyText(item.difficulty)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="result-buttons">
                <button onclick="startTest()" class="btn">再测一次</button>
                <button onclick="showHomePage()" class="btn">返回主页</button>
            </div>
        </div>
    `;
}

// 更新排行榜
function updateLeaderboard(testResult) {
    leaderboardData[testResult.difficulty].push({
        score: testResult.percentage,
        date: testResult.date
    });
    
    // 按分数排序
    leaderboardData[testResult.difficulty].sort((a, b) => b.score - a.score);
    
    // 只保留前10名
    leaderboardData[testResult.difficulty] = leaderboardData[testResult.difficulty].slice(0, 10);
}

// 显示排行榜
function showLeaderboard() {
    const difficulties = {
        'all': '全部词汇',
        'basic': '基础词汇',
        'intermediate': '高中词汇',
        'advanced': '选择性必修词汇'
    };
    
    let leaderboardHTML = '<div class="leaderboard-container"><h2>排行榜</h2>';
    
    for (const [difficulty, name] of Object.entries(difficulties)) {
        leaderboardHTML += `
            <div class="leaderboard-section">
                <h3>${name}</h3>
                ${leaderboardData[difficulty].length > 0 ? `
                    <div class="leaderboard-list">
                        ${leaderboardData[difficulty].map((entry, index) => `
                            <div class="leaderboard-item">
                                <span class="rank">#${index + 1}</span>
                                <span class="score">${entry.score.toFixed(1)}%</span>
                                <span class="date">${entry.date}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>暂无记录</p>'}
            </div>
        `;
    }
    
    leaderboardHTML += `
        <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
    </div>`;
    
    wordDisplay.innerHTML = leaderboardHTML;
}

// 显示错题本
function showWrongAnswers() {
    if (wrongAnswers.length === 0) {
        wordDisplay.innerHTML = `
            <div class="wrong-answers-container">
                <h2>错题本</h2>
                <p>暂无错题记录</p>
                <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
            </div>
        `;
        return;
    }
    
    wordDisplay.innerHTML = `
        <div class="wrong-answers-container">
            <h2>错题本</h2>
            <div class="wrong-answers-list">
                ${wrongAnswers.map(item => `
                    <div class="wrong-answer-item">
                        <div class="word-info">
                            <span class="word">${item.word}</span>
                            <button onclick="playWord('${item.word}')" class="btn play-btn" title="播放发音">
                                <span>🔊</span>
                            </button>
                            ${item.phonetic ? `<span class="phonetic">${item.phonetic}</span>` : ''}
                        </div>
                        <div class="meaning">${item.meaning}</div>
                        <span class="difficulty-tag ${item.difficulty}">${getDifficultyText(item.difficulty)}</span>
                    </div>
                `).join('')}
            </div>
            <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
        </div>
    `;
}

// 播放单词发音
function playWord(word) {
    if (!synth) {
        alert('您的浏览器不支持语音功能，请使用最新版本的Chrome、Edge或Safari浏览器。');
        return;
    }

    if (!voicesLoaded) {
        console.log('语音列表尚未加载完成，重新获取...');
        voices = synth.getVoices();
        if (voices.length === 0) {
            alert('语音引擎尚未准备好，请稍后再试。');
            return;
        }
    }

    // 如果正在播放，先停止
    if (isSpeaking) {
        synth.cancel();
        isSpeaking = false;
    }

    // 创建语音对象
    const utterance = new SpeechSynthesisUtterance(word);
    
    // 设置语音参数
    utterance.lang = 'en-US';
    utterance.rate = 0.8;  // 语速稍慢
    utterance.pitch = 1;   // 正常音调
    
    // 选择英语语音
    let voice = voices.find(v => v.lang.includes('en-US') && !v.name.includes('Microsoft'));
    if (!voice) {
        voice = voices.find(v => v.lang.includes('en'));
    }
    if (voice) {
        utterance.voice = voice;
        console.log('使用语音:', voice.name);
    } else {
        console.log('未找到合适的英语语音，使用默认语音');
    }

    // 设置状态
    utterance.onstart = () => {
        isSpeaking = true;
        console.log('开始播放:', word);
    };

    utterance.onend = () => {
        isSpeaking = false;
        console.log('播放结束:', word);
    };

    utterance.onerror = (event) => {
        console.error('语音合成错误:', event);
        isSpeaking = false;
        
        // 如果是被中断的错误，尝试重新播放
        if (event.error === 'interrupted') {
            console.log('语音被中断，尝试重新播放');
            setTimeout(() => {
                if (!isSpeaking) {
                    playWord(word);
                }
            }, 100);
        } else {
            alert('播放失败，请重试');
        }
    };

    // 开始播放
    try {
        synth.speak(utterance);
    } catch (error) {
        console.error('播放出错:', error);
        isSpeaking = false;
        alert('播放失败，请重试');
    }
}

// 显示历史成绩
function showTestHistory() {
    if (testHistory.length === 0) {
        wordDisplay.innerHTML = `
            <div class="history-container">
                <h2>历史成绩</h2>
                <p>暂无测试记录</p>
                <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
            </div>
        `;
        return;
    }
    
    wordDisplay.innerHTML = `
        <div class="history-container">
            <h2>历史成绩</h2>
            <div class="history-list">
                ${testHistory.map(record => `
                    <div class="history-item">
                        <div class="history-info">
                            <span class="date">${record.date}</span>
                            <span class="difficulty">${getDifficultyText(record.difficulty)}</span>
                        </div>
                        <div class="score-info">
                            <span class="score">${record.score}/${record.total}</span>
                            <span class="percentage">${record.percentage.toFixed(1)}%</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button onclick="showHomePage()" class="btn back-btn">返回主页</button>
        </div>
    `;
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