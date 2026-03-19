# ARMORY — Tactical Skincare System

> 피부는 전장이다. 매일 루틴이 방어막이 된다.

남성 전용 AI 피부 관리 모바일 웹앱. 전술 장비(Tactical Gear) 컨셉으로 스킨케어를 게이미피케이션합니다.

---

## 스크린샷

| 로그인 | 홈 / 베이스 | 루틴 로드아웃 | 레벨업 |
|:---:|:---:|:---:|:---:|
| OAuth 진입 | HP 게이지 + 환경 | 일일 미션 XP | 레벨업 팝업 |

---

## 주요 기능

### AI 피부 스캔
- 모바일 카메라 풀스크린 + HUD 오버레이
- 5단계 스캔 시퀀서 (INIT → DETECT → LOCK → ANALYZE → DONE)
- 실제 Skin Analysis API 연동 가능 (Mock 모드 기본)

### XP / 레벨 시스템
| 액션 | XP |
|---|---|
| 오늘 첫 스캔 | +30 |
| 루틴 항목 완료 | +10 |
| 하루 ALL CLEAR | +50 |
| 3일 연속 스트릭 | +30 |
| 7일 연속 스트릭 | +100 |

**레벨 10단계**: RECRUIT → OPERATIVE → SPECIALIST → SERGEANT → LIEUTENANT → CAPTAIN → MAJOR → COLONEL → COMMANDER → ELITE OPERATOR

### 피부 악화 패널티
미션 미수행 시 다음날 자정 자동 적용:
- 루틴 0% → 피부 수치 대폭 하락 + XP -45
- 루틴 30% 미만 → 수치 소폭 하락 + XP -10
- 완료 시 → 패널티 없음

### 실시간 알림
- 루틴 시간 경과 후 손목시계 아이콘 경보 (주황/빨강)
- 진동 + 사운드 피드백
- LOADOUT으로 즉시 이동 CTA

---

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Auth**: Google OAuth 2.0 / Kakao OAuth 2.0
- **Camera**: MediaDevices API (`getUserMedia`)
- **Audio**: Web Audio API (사운드 피드백)

---

## 시작하기

```bash
# 패키지 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 편집 후 실제 키 입력

# 개발 서버 실행
npm run dev
```

`http://localhost:3000` 접속

---

## OAuth 설정

### Google
1. [Google Cloud Console](https://console.cloud.google.com) → API 및 서비스 → 사용자 인증 정보
2. OAuth 2.0 클라이언트 ID 생성
3. 승인된 리디렉션 URI: `http://localhost:3000/auth/google/callback`
4. `.env.local`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 입력

### Kakao
1. [Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 → 앱 생성
2. REST API 키 복사
3. 플랫폼 → Web → 사이트 도메인: `http://localhost:3000`
4. 카카오 로그인 → Redirect URI: `http://localhost:3000/auth/kakao/callback`
5. `.env.local`에 `KAKAO_REST_KEY` 입력

---

## Skin Analysis API 연동

`components/ArmoryApp.jsx` 내 `API_CONFIG` 수정:

```js
const API_CONFIG = {
  endpoint: "https://your-api.com/v1/skin-analysis",
  useMock: false,  // true = Mock 모드
};
```

API 요청 형식: `POST { image: base64_string }`
API 응답 형식: `{ moisture: 0-100, sebum: 0-100, sensitivity: 0-100, barrier: 0-100 }`

---

## 프로젝트 구조

```
armory/
├── app/
│   ├── auth/
│   │   ├── google/callback/route.ts   # Google OAuth 콜백
│   │   └── kakao/callback/route.ts    # Kakao OAuth 콜백
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── ArmoryApp.jsx                  # 메인 앱 컴포넌트 (v6)
├── lib/
│   └── auth.ts                        # OAuth 토큰 교환 헬퍼
├── public/
│   └── manifest.json                  # PWA 매니페스트
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── README.md
```

---

## 버전 히스토리

| 버전 | 내용 |
|---|---|
| v1 | 기본 전술 UI 컨셉 |
| v2 | 모바일 전용 + 스와이프 제스처 |
| v3 | 가독성 색상 개선 + TopBar 아이콘 |
| v4 | 글로벌 실시간 상태 시스템 (Context + useReducer) |
| v5 | 손목시계 알림 + 루틴 알림 엔진 |
| v6 | XP/레벨 시스템 + 피부 악화 패널티 + Google/Kakao 로그인 |

---

*ARMORY TACTICAL v6.0 — BUILD 2025.03*
