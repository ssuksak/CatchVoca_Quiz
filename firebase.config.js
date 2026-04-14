/**
 * Firebase Configuration for CatchVoca Quiz PWA
 *
 * NOTE: Firebase 웹 클라이언트 설정값은 공개(public) 설계입니다.
 * 보안은 Firebase Security Rules로 처리됩니다.
 * 서버 측 Admin SDK 자격증명(Private Key)은 별도 .env에서 관리합니다.
 *
 * Extension(.env)의 VITE_FIREBASE_* 값과 동일하게 유지하세요.
 */

const firebaseConfig = {
  apiKey: "AIzaSyCNyoXDdfQrDcWKa5KZ_HaySrRWRz8jO8w",
  authDomain: "catchvoca-49f67.firebaseapp.com",
  databaseURL: "https://catchvoca-49f67-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "catchvoca-49f67",
  storageBucket: "catchvoca-49f67.firebasestorage.app",
  messagingSenderId: "330427545154",
  appId: "1:330427545154:web:272c397b7f71e201321fdb",
};

const FIREBASE_PATHS = {
  QUIZZES: 'quizzes',
};
