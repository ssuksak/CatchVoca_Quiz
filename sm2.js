/**
 * SM-2 Spaced Repetition Algorithm
 * CatchVoca Chrome Extension의 core 패키지와 동일한 로직
 *
 * 참고: Chrome Extension(TypeScript)에서 Vanilla JS로 포팅
 * 알고리즘 변경 시 packages/core/src/services/sm2/algorithm.ts와 동기화 필요
 */

const SM2_CONFIG = {
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,
  firstInterval: 1,   // 1일
  secondInterval: 6,  // 6일
};

const Rating = {
  Again: 1,     // 완전히 못 외움
  Hard: 2,      // 어렵게 기억
  Good: 3,      // 보통
  Easy: 4,      // 쉽게 기억
  VeryEasy: 5,  // 매우 쉽게 기억 (UI에서 사용 안 함)
};

/**
 * SM-2 알고리즘으로 다음 복습 일정 계산
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 * @param {Object} currentState - { interval, easeFactor, repetitions }
 * @param {number} rating - 1~5
 * @returns {{ nextReviewAt, interval, easeFactor, repetitions }}
 */
function calculateNextReview(currentState, rating) {
  let { interval, easeFactor, repetitions } = currentState;

  const newEaseFactor = Math.max(
    SM2_CONFIG.minEaseFactor,
    Math.min(
      SM2_CONFIG.maxEaseFactor,
      easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
    )
  );

  let newInterval;
  let newRepetitions;

  if (rating < Rating.Good) {
    newInterval = SM2_CONFIG.firstInterval;
    newRepetitions = 0;
  } else {
    newRepetitions = repetitions + 1;
    if (newRepetitions === 1) {
      newInterval = SM2_CONFIG.firstInterval;
    } else if (newRepetitions === 2) {
      newInterval = SM2_CONFIG.secondInterval;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  return {
    nextReviewAt: Date.now() + newInterval * 24 * 60 * 60 * 1000,
    interval: newInterval,
    easeFactor: newEaseFactor,
    repetitions: newRepetitions,
  };
}

/**
 * 초기 ReviewState 생성
 * @param {string} wordId
 * @returns {Object}
 */
function createInitialReviewState(wordId) {
  return {
    wordId,
    nextReviewAt: Date.now(),
    interval: SM2_CONFIG.firstInterval,
    easeFactor: 2.5,
    repetitions: 0,
  };
}
