import admin from 'firebase-admin';

let adminApp = null;

/**
 * Firebase Admin SDK 싱글톤 초기화
 * 에러 처리: 환경변수 누락, 초기화 실패
 */
export function getAdminApp() {
  if (adminApp) {
    return adminApp;
  }

  try {
    // 이미 초기화된 앱이 있는지 확인
    const existingApps = admin.apps;
    if (existingApps && existingApps.length > 0) {
      adminApp = existingApps[0];
      console.log('[Firebase Admin] Using existing app');
      return adminApp;
    }

    // 환경변수 검증
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      const missing = [];
      if (!projectId) missing.push('FIREBASE_PROJECT_ID');
      if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
      if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');

      throw new Error(
        `Missing Firebase Admin credentials: ${missing.join(', ')}. ` +
        'Check your environment variables in Vercel Dashboard or .env.local file.'
      );
    }

    // Private Key 포맷팅 (\\n → \n)
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Admin SDK 초기화
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
      databaseURL: 'https://catchvoca-49f67-default-rtdb.asia-southeast1.firebasedatabase.app',
    });

    console.log('[Firebase Admin] Initialized successfully', { projectId });
    return adminApp;
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);

    // 상세한 에러 메시지
    if (error.message?.includes('credentials')) {
      throw new Error(
        'Firebase Admin initialization failed: Invalid credentials. ' +
        'Please check your service account key format.'
      );
    }

    throw new Error(`Firebase Admin initialization failed: ${error.message}`);
  }
}

/**
 * Firebase Auth Admin 인스턴스 반환
 */
export function getAdminAuth() {
  const app = getAdminApp();
  return app.auth();
}

/**
 * Firebase Realtime Database Admin 인스턴스 반환
 */
export function getAdminDatabase() {
  const app = getAdminApp();
  return app.database();
}
