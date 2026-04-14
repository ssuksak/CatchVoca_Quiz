# Vercel API 배포 가이드

## 1. Firebase Admin SDK 서비스 계정 키 생성

### 1.1 Firebase Console에서 키 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. `CatchVoca` 프로젝트 선택
3. 왼쪽 메뉴 → ⚙️ **프로젝트 설정**
4. **서비스 계정** 탭 클릭
5. **새 비공개 키 생성** 버튼 클릭
6. JSON 파일 다운로드 (예: `catchvoca-49f67-firebase-adminsdk-xxxxx.json`)

⚠️ **주의**: 이 JSON 파일은 절대 Git에 커밋하지 마세요!

### 1.2 환경변수 추출

다운로드한 JSON 파일을 열면 다음과 같은 구조입니다:

```json
{
  "type": "service_account",
  "project_id": "catchvoca-49f67",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@catchvoca-49f67.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

다음 3개 값만 추출하면 됩니다:
- `project_id` → `FIREBASE_PROJECT_ID`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY`

## 2. 로컬 개발 환경 설정

### 2.1 .env.local 파일 생성

`CatchVoca_Quiz` 폴더에 `.env.local` 파일을 생성하고 다음 내용을 입력:

```bash
FIREBASE_PROJECT_ID=catchvoca-49f67
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@catchvoca-49f67.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n실제키내용\n-----END PRIVATE KEY-----\n"
ALLOWED_ORIGIN=chrome-extension://
```

⚠️ **중요**: `FIREBASE_PRIVATE_KEY`는 반드시 **큰따옴표**로 감싸야 하며, `\n`은 그대로 유지해야 합니다.

### 2.2 로컬 테스트

```bash
# CatchVoca_Quiz 폴더에서
vercel dev

# 다른 터미널에서 API 테스트
curl -X OPTIONS http://localhost:3000/api/auth/exchange-token -v

# CORS 헤더 확인:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: POST, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization
```

## 3. Vercel 대시보드에 환경변수 설정

### 3.1 Vercel 프로젝트 생성

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. **Add New...** → **Project** 클릭
3. `CatchVoca_Quiz` 저장소 선택
4. **Import** 클릭

### 3.2 환경변수 추가

프로젝트 설정에서:

1. **Settings** → **Environment Variables** 메뉴
2. 다음 3개 환경변수 추가:

| Variable Name | Value | Environments |
|---------------|-------|--------------|
| `FIREBASE_PROJECT_ID` | `catchvoca-49f67` | Production, Preview, Development |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxxxx@...` | Production, Preview, Development |
| `FIREBASE_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` | Production, Preview, Development |

⚠️ **주의사항**:
- `FIREBASE_PRIVATE_KEY`는 **큰따옴표 포함해서 입력**
- `\n`은 실제 줄바꿈이 아니라 문자열 `\n`으로 입력
- 각 환경변수는 **모든 환경**(Production, Preview, Development)에 추가

### 3.3 배포

```bash
# Preview 배포 (테스트용)
vercel

# Production 배포
vercel --prod
```

배포 완료 후 URL 확인:
- Preview: `https://catch-voca-quiz-xxxxx.vercel.app`
- Production: `https://your-domain.vercel.app`

## 4. API 테스트

### 4.1 OPTIONS 요청 (CORS Preflight)

```bash
curl -X OPTIONS https://your-app.vercel.app/api/auth/exchange-token -v
```

**예상 응답**:
```
HTTP/2 200
access-control-allow-origin: *
access-control-allow-methods: POST, OPTIONS
access-control-allow-headers: Content-Type, Authorization
access-control-max-age: 86400
```

### 4.2 POST 요청 (실제 토큰 교환)

먼저 유효한 Google Access Token이 필요합니다. Extension에서 로그인 후 콘솔에서 복사하거나, 다음 방법으로 테스트:

```bash
# 1. 유효한 Access Token 획득 (Chrome Extension 로그인 후 콘솔에서)
# chrome.storage.local.get('googleAccessToken', (result) => console.log(result.googleAccessToken))

# 2. API 호출
curl -X POST https://your-app.vercel.app/api/auth/exchange-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ya29.a0AfB_byC..." \
  -v
```

**예상 성공 응답** (200 OK):
```json
{
  "customToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uid": "google:123456789",
    "email": "user@example.com",
    "displayName": "User Name",
    "photoURL": "https://...",
    "emailVerified": true
  }
}
```

**예상 에러 응답**:

1. **Authorization 헤더 누락** (401):
```json
{
  "error": "Missing authorization",
  "message": "Authorization header must be \"Bearer <token>\""
}
```

2. **잘못된 토큰** (401):
```json
{
  "error": "Invalid access token",
  "message": "Google UserInfo API returned 401",
  "details": "..."
}
```

3. **환경변수 누락** (500):
```json
{
  "error": "Server configuration error",
  "message": "Firebase Admin SDK not properly configured",
  "details": "Missing Firebase Admin credentials: FIREBASE_PRIVATE_KEY"
}
```

## 5. 로그 확인

### 5.1 Vercel 함수 로그

Vercel Dashboard → 프로젝트 → **Logs** 탭

다음과 같은 로그가 보여야 합니다:
```
[Firebase Admin] Initialized successfully { projectId: 'catchvoca-49f67' }
[Exchange Token] Verifying Google Access Token...
[Exchange Token] User verified: { id: '123456789', email: 'user@example.com' }
[Exchange Token] Creating Firebase Custom Token... { uid: 'google:123456789' }
[Exchange Token] Custom Token created successfully { uid: 'google:google:123456789' }
```

### 5.2 에러 로그

에러 발생 시 상세한 정보가 로그에 기록됩니다:
```
[Exchange Token] Google API error: { status: 401, error: 'Invalid Credentials' }
[Exchange Token] Firebase Custom Token creation failed: [FirebaseAuthError]: ...
```

## 6. 트러블슈팅

### 문제 1: "Missing Firebase Admin credentials"

**원인**: 환경변수가 Vercel에 설정되지 않음

**해결**:
1. Vercel Dashboard → Settings → Environment Variables 확인
2. 3개 환경변수 모두 설정되어 있는지 확인
3. **Redeploy** 클릭 (환경변수 변경 시 재배포 필요)

### 문제 2: "Invalid credentials" (Firebase Admin)

**원인**: Private Key 포맷이 잘못됨

**해결**:
1. `FIREBASE_PRIVATE_KEY`를 다시 확인
2. 큰따옴표 포함 여부 확인: `"-----BEGIN..."`
3. `\n`이 실제 줄바꿈이 아닌 문자열인지 확인
4. JSON 파일에서 `private_key` 값을 그대로 복사

### 문제 3: CORS 에러

**원인**: Chrome Extension에서 API 호출 시 CORS 헤더 누락

**해결**:
1. API 코드에서 `Access-Control-Allow-Origin` 헤더 확인
2. Preflight OPTIONS 요청이 200 OK 반환하는지 확인
3. Chrome Extension ID가 변경되었는지 확인 (unpacked 모드)

### 문제 4: "Insufficient permissions" (Firebase)

**원인**: 서비스 계정에 권한 부족

**해결**:
1. Firebase Console → 프로젝트 설정 → 서비스 계정
2. "권한" 탭에서 **Firebase Authentication Admin** 역할 추가
3. 또는 새 서비스 계정 키 재생성

## 7. 보안 체크리스트

- [ ] `.env.local` 파일이 `.gitignore`에 포함되어 있음
- [ ] 서비스 계정 JSON 파일을 Git에 커밋하지 않음
- [ ] Vercel 환경변수에만 Private Key 저장
- [ ] `ALLOWED_ORIGIN`을 프로덕션에서 특정 도메인으로 제한 고려
- [ ] 서비스 계정 키가 유출되지 않도록 팀원들에게 공유 금지

## 8. 다음 단계

Vercel API 배포 완료 후:
1. Extension에서 `VITE_VERCEL_API_URL` 환경변수 설정
2. `firebaseAuthService.ts` 수정하여 Token 교환 API 호출
3. 통합 테스트 실행

---

**배포 완료 여부 확인**:
```bash
# API 엔드포인트 확인
curl -X OPTIONS https://your-app.vercel.app/api/auth/exchange-token -v

# 200 OK와 CORS 헤더가 보이면 성공!
```
