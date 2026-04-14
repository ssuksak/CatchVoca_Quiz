/**
 * CatchVoca Mobile Quiz - Firebase Version
 * SM-2 알고리즘: sm2.js 참고
 */

// ============================================================================
// State Management
// ============================================================================

let words = [];
let currentIndex = 0;
let showingAnswer = false;
let firebaseApp = null;
let database = null;
let quizId = null;
let userId = null;
let reviewStates = {};
let auth = null;
let currentUser = null;

// ============================================================================
// Firebase Initialization
// ============================================================================

async function initializeFirebase() {
  // Firebase 모듈이 로드될 때까지 대기
  while (!window.firebaseModules) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const { initializeApp, getDatabase, getAuth } = window.firebaseModules;

  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
    database = getDatabase(firebaseApp);
    auth = getAuth(firebaseApp);
    console.log('[Quiz] Firebase initialized (database + auth)');
  }

  return database;
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * URL 쿼리 파라미터에서 퀴즈 ID 추출
 */
function getQuizIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

/**
 * Firebase에서 퀴즈 데이터 로드
 */
async function loadQuizDataFromFirebase(quizIdParam) {
  try {
    console.log('[Quiz] Loading from Firebase...', quizIdParam);

    const db = await initializeFirebase();
    const { ref, get } = window.firebaseModules;

    // URL에서 userId도 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('uid');

    if (!userIdParam) {
      showError('Invalid URL', 'User ID is missing from the quiz link.');
      return null;
    }

    const quizRef = ref(db, `users/${userIdParam}/${FIREBASE_PATHS.QUIZZES}/${quizIdParam}`);
    const snapshot = await get(quizRef);

    if (!snapshot.exists()) {
      showError('Quiz not found', 'The quiz link may have expired (7 days limit) or is invalid.');
      return null;
    }

    const quizData = snapshot.val();

    // 만료 확인
    if (quizData.expiresAt < Date.now()) {
      showError('Quiz expired', 'This quiz has expired. Please generate a new link.');
      return null;
    }

    // quizId와 userId 저장
    quizId = quizIdParam;
    userId = userIdParam;

    // reviewStates 로드 (있다면)
    const reviewStatesRef = ref(db, `users/${userIdParam}/${FIREBASE_PATHS.QUIZZES}/${quizIdParam}/reviewStates`);
    const reviewStatesSnapshot = await get(reviewStatesRef);

    if (reviewStatesSnapshot.exists()) {
      reviewStates = reviewStatesSnapshot.val() || {};
      console.log('[Quiz] Loaded review states:', Object.keys(reviewStates).length);
    } else {
      reviewStates = {};
      console.log('[Quiz] No review states found, starting fresh');
    }

    console.log(`[Quiz] Loaded ${quizData.words.length} words from Firebase`);
    return quizData.words;
  } catch (error) {
    console.error('[Quiz] Firebase load error:', error);
    showError('Failed to load quiz', error.message || 'Please check your internet connection.');
    return null;
  }
}

/**
 * 퀴즈 데이터 로드 (메인 함수)
 */
async function loadQuizData() {
  const quizIdParam = getQuizIdFromUrl();

  if (!quizIdParam) {
    showError('Quiz ID not found in URL.', 'Please generate a quiz link from CatchVoca Extension.');
    return null;
  }

  // Firebase에서 로드
  return await loadQuizDataFromFirebase(quizIdParam);
}

/**
 * 에러 표시
 */
function showError(mainMessage, detailMessage = '') {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'flex';

  const errorMessageEl = document.getElementById('error-message');
  errorMessageEl.textContent = '';
  const strong = document.createElement('strong');
  strong.textContent = mainMessage;
  errorMessageEl.appendChild(strong);

  if (detailMessage) {
    errorMessageEl.appendChild(document.createElement('br'));
    const small = document.createElement('small');
    small.textContent = detailMessage;
    errorMessageEl.appendChild(small);
  }
}

// ============================================================================
// Quiz Initialization
// ============================================================================

/**
 * 퀴즈 초기화
 */
async function initQuiz() {
  console.log('[Quiz] Initializing...');

  // 퀴즈 데이터 로드
  words = await loadQuizData();

  if (!words || words.length === 0) {
    return;
  }

  // UI 전환
  document.getElementById('loading').style.display = 'none';
  document.getElementById('quiz-container').style.display = 'block';

  // Total count 업데이트
  document.getElementById('total').textContent = words.length;

  // 첫 번째 단어 표시
  showWord(0);

  // 이벤트 리스너 등록
  setupEventListeners();

  console.log('[Quiz] Initialization complete');
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // 답변 토글 버튼
  document.getElementById('show-answer').addEventListener('click', toggleAnswer);

  // 네비게이션 버튼
  document.getElementById('prev-btn').addEventListener('click', () => navigateWord(-1));
  document.getElementById('next-btn').addEventListener('click', () => navigateWord(1));

  // 오디오 재생 버튼
  document.getElementById('play-audio').addEventListener('click', playAudio);

  // 평점 버튼
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.dataset.rating);
      handleRating(rating);
    });
  });

  // 키보드 단축키
  document.addEventListener('keydown', handleKeydown);
}

// ============================================================================
// Word Display
// ============================================================================

/**
 * 특정 인덱스의 단어 표시
 */
function showWord(index) {
  if (index < 0 || index >= words.length) {
    console.error('[Quiz] Invalid index:', index);
    return;
  }

  currentIndex = index;
  const word = words[index];
  showingAnswer = false;

  console.log(`[Quiz] Showing word ${index + 1}/${words.length}:`, word.w);

  // 단어 및 발음 기호
  document.getElementById('word-text').textContent = word.w;
  document.getElementById('phonetic').textContent = word.p || '';

  // 진행 상황
  document.getElementById('current').textContent = index + 1;

  // 답변 초기화
  hideAnswer();

  // 정의 렌더링
  renderDefinitions(word.d);

  // 오디오 버튼
  const audioBtn = document.getElementById('play-audio');
  if (word.a) {
    audioBtn.style.display = 'inline-block';
    audioBtn.dataset.audioUrl = word.a;
  } else {
    audioBtn.style.display = 'none';
  }

  // 네비게이션 버튼 상태
  updateNavigationButtons();
}

/**
 * 정의 목록 렌더링
 */
function renderDefinitions(definitions) {
  const definitionsList = document.getElementById('definitions-list');
  definitionsList.innerHTML = '';

  if (!definitions || definitions.length === 0) {
    const li = document.createElement('li');
    li.textContent = '정의 없음';
    li.className = 'no-definition';
    definitionsList.appendChild(li);
    return;
  }

  definitions.forEach((def, index) => {
    const li = document.createElement('li');
    const numberSpan = document.createElement('span');
    numberSpan.className = 'def-number';
    numberSpan.textContent = `${index + 1}.`;
    li.appendChild(numberSpan);
    li.appendChild(document.createTextNode(` ${def}`));
    definitionsList.appendChild(li);
  });
}

/**
 * 네비게이션 버튼 상태 업데이트
 */
function updateNavigationButtons() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === words.length - 1;

  // 마지막 단어일 때 "Finish" 표시
  if (currentIndex === words.length - 1) {
    nextBtn.textContent = 'Finish 🎉';
  } else {
    nextBtn.textContent = 'Next →';
  }
}

// ============================================================================
// Answer Toggle
// ============================================================================

/**
 * 답변 표시/숨기기 토글
 */
function toggleAnswer() {
  showingAnswer = !showingAnswer;

  if (showingAnswer) {
    showAnswer();
  } else {
    hideAnswer();
  }
}

/**
 * 답변 표시
 */
function showAnswer() {
  const answerContainer = document.getElementById('answer');
  const showAnswerBtn = document.getElementById('show-answer');

  answerContainer.style.display = 'block';
  showAnswerBtn.textContent = 'Hide Answer';
  showAnswerBtn.classList.add('active');
  showingAnswer = true;
}

/**
 * 답변 숨기기
 */
function hideAnswer() {
  const answerContainer = document.getElementById('answer');
  const showAnswerBtn = document.getElementById('show-answer');

  answerContainer.style.display = 'none';
  showAnswerBtn.textContent = 'Show Answer';
  showAnswerBtn.classList.remove('active');
  showingAnswer = false;
}

// ============================================================================
// SM-2 Rating Handler
// ============================================================================

/**
 * 평점 처리 (SM-2 알고리즘 적용)
 */
async function handleRating(rating) {
  const word = words[currentIndex];

  // quizId 검증
  if (!quizId) {
    console.error('[Quiz] Cannot rate word: quizId is not set');
    alert('퀴즈 ID를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // ✅ normalizedWord 사용 (PC 동기화와 일치)
  const normalizedWord = word.w.toLowerCase().trim();
  const wordId = `${normalizedWord}::${quizId}`;

  console.log(`[Quiz] Rating ${rating} for word:`, word.w, `(normalized: ${normalizedWord})`);

  // 현재 ReviewState 가져오기 또는 초기화
  let currentState = reviewStates[wordId];
  if (!currentState) {
    currentState = createInitialReviewState(wordId);
    console.log('[Quiz] Created initial review state for:', wordId);
  }

  // SM-2 알고리즘으로 다음 복습 일정 계산
  const sm2Result = calculateNextReview(currentState, rating);

  console.log('[Quiz] SM-2 calculation result:', {
    interval: sm2Result.interval,
    easeFactor: sm2Result.easeFactor,
    repetitions: sm2Result.repetitions,
  });

  // ReviewState 업데이트
  reviewStates[wordId] = {
    wordId: wordId,
    nextReviewAt: sm2Result.nextReviewAt,
    interval: sm2Result.interval,
    easeFactor: sm2Result.easeFactor,
    repetitions: sm2Result.repetitions,
    lastRating: rating,
    lastReviewedAt: Date.now(),
  };

  // Firebase에 저장
  await saveReviewStateToFirebase(wordId);

  // 피드백 표시
  showRatingFeedback(rating, sm2Result.interval);

  // 1초 후 다음 단어로 이동
  setTimeout(() => {
    if (currentIndex < words.length - 1) {
      navigateWord(1);
    } else {
      showCompletionMessage();
    }
  }, 1000);
}

/**
 * ReviewState를 Firebase에 저장
 */
async function saveReviewStateToFirebase(wordId) {
  try {
    // userId와 quizId 검증
    if (!userId || !quizId) {
      console.error('[Quiz] Cannot save review state: userId or quizId is not set', { userId, quizId });
      throw new Error('User ID or Quiz ID is missing');
    }

    const db = await initializeFirebase();
    const { ref, update } = window.firebaseModules;

    // userId를 포함한 올바른 경로에 저장
    const reviewStateRef = ref(db, `users/${userId}/${FIREBASE_PATHS.QUIZZES}/${quizId}/reviewStates/${wordId}`);
    await update(reviewStateRef, reviewStates[wordId]);

    console.log('[Quiz] Review state saved to Firebase:', wordId);
  } catch (error) {
    console.error('[Quiz] Failed to save review state:', error);

    // ✅ 사용자에게 저장 실패 알림
    alert('⚠️ 학습 기록 저장 실패\n\n인터넷 연결을 확인하고 다시 시도해주세요.');
    throw error; // 재시도 가능하도록 에러 전파
  }
}

/**
 * 평점 피드백 표시
 */
function showRatingFeedback(rating, interval) {
  const feedbackMessages = {
    1: `다시 복습하세요! (다음: ${interval}일 후)`,
    2: `조금 더 연습이 필요해요 (다음: ${interval}일 후)`,
    3: `좋아요! (다음: ${interval}일 후)`,
    4: `완벽해요! (다음: ${interval}일 후)`,
  };

  const message = feedbackMessages[rating] || '평가 완료!';

  // 임시 알림 표시
  const feedback = document.createElement('div');
  feedback.className = 'rating-feedback';
  feedback.textContent = message;
  feedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px 40px;
    border-radius: 10px;
    font-size: 18px;
    z-index: 1000;
    animation: fadeIn 0.3s ease-in-out;
  `;

  document.body.appendChild(feedback);

  setTimeout(() => {
    feedback.remove();
  }, 900);
}

// ============================================================================
// Navigation
// ============================================================================

/**
 * 단어 네비게이션
 */
function navigateWord(direction) {
  const newIndex = currentIndex + direction;

  if (newIndex < 0 || newIndex >= words.length) {
    return;
  }

  // 마지막 단어에서 "Finish" 클릭 시
  if (currentIndex === words.length - 1 && direction === 1) {
    showCompletionMessage();
    return;
  }

  showWord(newIndex);
}

/**
 * 퀴즈 완료 메시지
 */
function showCompletionMessage() {
  const reviewedCount = Object.keys(reviewStates).length;

  const card = document.querySelector('.card');
  card.textContent = '';
  const completionDiv = document.createElement('div');
  completionDiv.className = 'completion-message';

  const emoji = document.createElement('div');
  emoji.className = 'emoji';
  emoji.textContent = '\u{1F389}';
  completionDiv.appendChild(emoji);

  const h2 = document.createElement('h2');
  h2.textContent = 'Quiz Complete!';
  completionDiv.appendChild(h2);

  const p1 = document.createElement('p');
  p1.textContent = `You've reviewed ${reviewedCount} words out of ${words.length}.`;
  completionDiv.appendChild(p1);

  const p2 = document.createElement('p');
  p2.className = 'subtitle';
  p2.textContent = 'Great job! Keep practicing to improve retention.';
  completionDiv.appendChild(p2);

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = 'Restart Quiz';
  btn.addEventListener('click', () => location.reload());
  completionDiv.appendChild(btn);

  card.appendChild(completionDiv);

  document.querySelector('.controls').style.display = 'none';
}

// ============================================================================
// Audio Playback
// ============================================================================

/**
 * 오디오 재생
 * 참고: 네이버 오디오 URL은 CORS/인증 문제로 재생 불가
 * 새로 저장한 단어는 Free Dictionary API 오디오 URL 사용 (정상 작동)
 */
function playAudio() {
  const audioBtn = document.getElementById('play-audio');
  const audioUrl = audioBtn.dataset.audioUrl;

  if (!audioUrl) {
    console.warn('[Quiz] No audio URL available');
    return;
  }

  const audio = new Audio(audioUrl);

  // Visual feedback - starting
  audioBtn.textContent = '🔊 재생 중...';
  audioBtn.disabled = true;

  audio.play().catch((error) => {
    console.error('[Quiz] Audio play error:', error, 'URL:', audioUrl);
    // 네이버 오디오 URL인 경우 친절한 메시지 표시
    if (audioUrl.includes('dict-dn.pstatic.net') || audioUrl.includes('naver')) {
      alert('⚠️ 이 단어의 오디오는 현재 재생할 수 없습니다.\n\n새로 저장한 단어는 오디오가 정상 작동합니다.');
    } else {
      alert('오디오 재생에 실패했습니다. 인터넷 연결을 확인해주세요.');
    }
    audioBtn.textContent = '🔊 발음 듣기';
    audioBtn.disabled = false;
  });

  audio.addEventListener('ended', () => {
    audioBtn.textContent = '🔊 발음 듣기';
    audioBtn.disabled = false;
  });

  audio.addEventListener('error', (e) => {
    console.error('[Quiz] Audio error event:', e);
    audioBtn.textContent = '🔊 발음 듣기';
    audioBtn.disabled = false;
  });
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

/**
 * 키보드 이벤트 핸들러
 */
function handleKeydown(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      navigateWord(-1);
      break;

    case 'ArrowRight':
      event.preventDefault();
      navigateWord(1);
      break;

    case ' ':
      event.preventDefault();
      toggleAnswer();
      break;

    default:
      break;
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * DOMContentLoaded 이벤트 시 초기화
 * 참고: init_override.js가 로드되면 인증 후 initQuizWithAuth()가 호출됨
 * 이 이벤트 리스너는 init_override.js가 없는 경우의 fallback
 */
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Quiz] DOM loaded');
  // init_override.js가 로드될 때까지 대기
  // init_override.js가 있으면 initQuizWithAuth()가 실행됨
  setTimeout(() => {
    // init_override.js가 로드되지 않은 경우에만 실행
    if (!window.initQuizWithAuthLoaded) {
      console.log('[Quiz] No auth override, running basic initQuiz');
      initQuiz();
    }
  }, 100);
});
