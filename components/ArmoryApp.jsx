"use client";
import { useState, useEffect, useRef, useCallback, createContext, useContext, useReducer } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ══════════════════════════════════════════════════════════════════
// DESIGN TOKENS — 다크 / 라이트 테마
// ══════════════════════════════════════════════════════════════════
const THEMES = {
  dark: {
    bg:"#01080F", bgCard:"#071520", bgCardHi:"#0D2235", bgStrip:"#040E18",
    border:"#1A3A52", borderHi:"#2A5A7A", borderFx:"#3A7A9A",
    blue:"#18CFFF", blueGlow:"rgba(24,207,255,0.22)", blueDim:"#0A4A6A",
    blueText:"#6ABFDF", blueSub:"#3A8AAA",
    red:"#FF5555", redDim:"#2A0A0A", orange:"#FF9933", yellow:"#FFD700",
    green:"#00FF99", greenDim:"#003320", purple:"#BB88FF",
    gold:"#FFD700", silver:"#C0C8D0", bronze:"#CD7F32",
    textPrimary:"#EAF6FF", textSecond:"#8BBDD6", textMuted:"#4A7A9A", textFaint:"#1E4A62",
    // 다크 전용
    scanlineBg:"#ffffff",
    navBg:"rgba(1,6,12,0.98)",
    topBarBg:"rgba(1,6,12,0.97)",
    gridColor:"rgba(24,207,255,0.05)",
  },
  light: {
    bg:"#F2F4F6", bgCard:"#FFFFFF", bgCardHi:"#EBF0F5", bgStrip:"#E4EAF0",
    border:"#C5D4E0", borderHi:"#8DAABF", borderFx:"#6A8FA8",
    blue:"#0099CC", blueGlow:"rgba(0,153,204,0.18)", blueDim:"#CCE8F4",
    blueText:"#006E99", blueSub:"#3A7A9A",
    red:"#E03030", redDim:"#FDEAEA", orange:"#D4720A", yellow:"#B8900A",
    green:"#0A8A55", greenDim:"#E4F5EE", purple:"#6A35CC",
    gold:"#B8900A", silver:"#6A7A88", bronze:"#8B5020",
    textPrimary:"#0A1A2A", textSecond:"#2A4A62", textMuted:"#5A7A92", textFaint:"#8AAABB",
    // 라이트 전용
    scanlineBg:"#000000",
    navBg:"rgba(242,244,246,0.98)",
    topBarBg:"rgba(242,244,246,0.97)",
    gridColor:"rgba(0,153,204,0.04)",
  },
};

// ThemeContext — 전역 테마 상태
const ThemeCtx = createContext({ theme:"dark", C:THEMES.dark, toggleTheme:()=>{} });
function useTheme() { return useContext(ThemeCtx); }

// C는 항상 useTheme().C 로 가져오지만
// 컴포넌트 외부(데이터 정의 등)에서 기본값으로 사용할 fallback
let C = THEMES.dark;

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("armory_theme") || "dark"; } catch { return "dark"; }
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("armory_theme", next); } catch {}
  };

  C = THEMES[theme];

  return (
    <ThemeCtx.Provider value={{ theme, C:THEMES[theme], toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

// useC() — 어느 컴포넌트에서든 현재 테마 색상 반환
// AppCtx(로그인 후)와 ThemeCtx(로그인 전 포함) 모두 지원
function useC() {
  const themeCtx = useContext(ThemeCtx);
  const appCtx = useContext(AppCtx);
  return (appCtx?.C) || themeCtx?.C || THEMES.dark;
}

// ══════════════════════════════════════════════════════════════════
// AUTH SYSTEM
// ══════════════════════════════════════════════════════════════════

/* ── OAuth 엔드포인트 설정 ──────────────────────────────────────────
   실제 배포 시 아래 값을 교체하면 Google / Kakao OAuth 즉시 연동.

   Google:
     1. console.cloud.google.com → OAuth 2.0 Client ID 발급
     2. GOOGLE_CLIENT_ID 교체, redirect URI 등록

   Kakao:
     1. developers.kakao.com → 앱 생성 → REST API 키 복사
     2. KAKAO_REST_KEY 교체, Redirect URI 등록
   ───────────────────────────────────────────────────────────────── */
const getOrigin = () => (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

const AUTH_CONFIG = {
  google: {
    clientId: "YOUR_GOOGLE_CLIENT_ID",       // ← 교체
    get redirectUri() { return getOrigin() + "/auth/google/callback"; },
    scope: "openid email profile",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  },
  kakao: {
    restKey: "YOUR_KAKAO_REST_API_KEY",       // ← 교체
    get redirectUri() { return getOrigin() + "/auth/kakao/callback"; },
    authUrl: "https://kauth.kakao.com/oauth/authorize",
    scope: "profile_nickname profile_image account_email",
  },
};

// 실제 OAuth 팝업 열기 (PKCE flow 또는 redirect flow)
function openOAuth(provider) {
  const cfg = AUTH_CONFIG[provider];
  if (!cfg) return;

  const params = new URLSearchParams({
    ...(provider === "google" ? {
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      scope: cfg.scope,
      access_type: "offline",
    } : {
      client_id: cfg.restKey,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      scope: cfg.scope,
    }),
  });

  // 개발 환경에서는 mock 로그인으로 fallback
  const isDev = cfg.clientId.startsWith("YOUR_");
  if (isDev) return null; // caller handles mock

  const url = `${cfg.authUrl}?${params}`;
  if (typeof window === "undefined") return null;
  const popup = window.open(url, `${provider}_oauth`, "width=500,height=650,left=400,top=100");
  return popup;
}

// 세션 스토리지 기반 인증 상태 (실제 앱에서는 JWT / 서버 세션)
const AUTH_STORAGE_KEY = "armory_auth_v1";

function saveAuth(user) {
  try { sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user)); } catch {}
}
function loadAuth() {
  try { const r = sessionStorage.getItem(AUTH_STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function clearAuth() {
  try { sessionStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
}

// ── Auth Context ──────────────────────────────────────────────────
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadAuth());
  const [authState, setAuthState] = useState("idle"); // idle | loading | error

  const login = useCallback(async (provider) => {
    setAuthState("loading");
    try {
      const popup = openOAuth(provider);

      // Mock 로그인 (실제 키 없을 때 시뮬레이션)
      if (!popup) {
        await new Promise(r => setTimeout(r, 1400));
        const mockUser = {
          id: `mock_${provider}_${Date.now()}`,
          provider,
          name: provider === "google" ? "Kim Operator" : "김오퍼레이터",
          email: `operator@${provider}.mock`,
          avatar: null,
          joinedAt: new Date().toISOString(),
        };
        saveAuth(mockUser);
        setUser(mockUser);
        setAuthState("idle");
        return;
      }

      // 실제 OAuth: popup 메시지 수신
      const handleMessage = (e) => {
        if (typeof window === "undefined") return;
        if (e.origin !== window.location.origin) return;
        if (e.data?.type !== "OAUTH_SUCCESS") return;
        const authUser = { ...e.data.user, provider, joinedAt: new Date().toISOString() };
        saveAuth(authUser);
        setUser(authUser);
        setAuthState("idle");
        if (typeof window !== "undefined") window.removeEventListener("message", handleMessage);
        popup?.close();
      };
      if (typeof window !== "undefined") {
        window.addEventListener("message", handleMessage);
      }

      // 타임아웃 처리
      setTimeout(() => {
        if (typeof window !== "undefined") window.removeEventListener("message", handleMessage);
        if (!user) { setAuthState("error"); }
        popup?.close();
      }, 120_000);

    } catch (err) {
      setAuthState("error");
    }
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setAuthState("idle");
  }, []);

  return (
    <AuthCtx.Provider value={{ user, authState, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ══════════════════════════════════════════════════════════════════
// XP / LEVEL SYSTEM
// ══════════════════════════════════════════════════════════════════
const LEVELS = [
  { lv:1,  name:"RECRUIT",      minXP:0,    maxXP:100,  color:C.textMuted,  perk:"기본 스킨케어 루틴 해금" },
  { lv:2,  name:"OPERATIVE",    minXP:100,  maxXP:250,  color:C.blue,       perk:"수분 부스터 스캔 잠금해제" },
  { lv:3,  name:"SPECIALIST",   minXP:250,  maxXP:500,  color:C.blue,       perk:"세럼 집중 치료 루틴 해금" },
  { lv:4,  name:"SERGEANT",     minXP:500,  maxXP:800,  color:C.green,      perk:"야간 복구 프로토콜 해금" },
  { lv:5,  name:"LIEUTENANT",   minXP:800,  maxXP:1200, color:C.green,      perk:"환경 적응 스캔 모드 해금" },
  { lv:6,  name:"CAPTAIN",      minXP:1200, maxXP:1800, color:C.yellow,     perk:"피부 방어막 MAX 부스트" },
  { lv:7,  name:"MAJOR",        minXP:1800, maxXP:2600, color:C.yellow,     perk:"VIP 제품 할인 15%" },
  { lv:8,  name:"COLONEL",      minXP:2600, maxXP:3600, color:C.orange,     perk:"맞춤형 루틴 AI 생성" },
  { lv:9,  name:"COMMANDER",    minXP:3600, maxXP:5000, color:C.orange,     perk:"전용 성분 배합 레시피" },
  { lv:10, name:"ELITE OPERATOR",minXP:5000,maxXP:9999, color:C.purple,     perk:"ARMORY 레전드 등급" },
];

const XP_REWARDS = {
  SCAN:              30,   // 스캔 1회
  ROUTINE_ITEM:      10,   // 루틴 항목 1개 완료
  DAILY_FULL:        50,   // 하루 전체 루틴 완료 보너스
  STREAK_3:          30,   // 3일 연속
  STREAK_7:          100,  // 7일 연속
  // 패널티 — 미수행 시 XP 차감
  SKIP_DAY:         -30,   // 하루 루틴 전혀 안 함
  SKIP_PARTIAL:     -10,   // 절반 미만 완료
  MISSED_SCAN:      -15,   // 하루 스캔 미수행
};

// ── 피부 악화 테이블 (미션 미수행 시 다음날 적용)
// completionRate 0~1 → 각 지표 변화량
const DECAY_TABLE = [
  { maxRate:0.0, decay:{ moisture:-8, sebum:+6, sensitivity:+5, barrier:-7 } }, // 전혀 안 함
  { maxRate:0.3, decay:{ moisture:-5, sebum:+4, sensitivity:+3, barrier:-5 } }, // 30% 미만
  { maxRate:0.6, decay:{ moisture:-2, sebum:+2, sensitivity:+1, barrier:-2 } }, // 60% 미만
  { maxRate:1.0, decay:{ moisture: 0, sebum: 0, sensitivity: 0, barrier: 0 } }, // 완료
];

function getDecay(completionRate) {
  return DECAY_TABLE.find(t => completionRate <= t.maxRate)?.decay || DECAY_TABLE[0].decay;
}

function getLevelInfo(xp) {
  const lv = [...LEVELS].reverse().find(l => xp >= l.minXP) || LEVELS[0];
  return lv;
}
function getNextLevel(xp) {
  return LEVELS.find(l => xp < l.maxXP) || LEVELS[LEVELS.length-1];
}
function xpProgress(xp) {
  const cur = getLevelInfo(xp);
  const range = cur.maxXP - cur.minXP;
  return Math.min(((xp - cur.minXP) / range) * 100, 100);
}

// 오늘 날짜 키 (YYYY-MM-DD)
function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}
function formatDate(d) {
  return d.toLocaleDateString("ko", { month:"2-digit", day:"2-digit" }) + " " + d.toLocaleTimeString("ko", { hour:"2-digit", minute:"2-digit" });
}
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// ══════════════════════════════════════════════════════════════════
// ROUTINE SCHEDULE
// ══════════════════════════════════════════════════════════════════
const ROUTINE_SCHEDULE = [
  { id:"morning", time:"06:30", h:6,  m:30, op:"MORNING BREACH", items:["세안","토너","보습제"],       priority:"HIGH",     pc:C.blue,    graceMins:30 },
  { id:"midday",  time:"12:00", h:12, m:0,  op:"MIDDAY RECON",   items:["토너","선크림 SPF50+"],        priority:"MED",      pc:C.blueSub, graceMins:20 },
  { id:"night",   time:"22:00", h:22, m:0,  op:"NIGHT OPS",      items:["세안","토너","세럼","보습제"], priority:"CRITICAL", pc:C.red,     graceMins:45 },
];
const TOTAL_ITEMS = ROUTINE_SCHEDULE.reduce((s,r)=>s+r.items.length, 0);

// ══════════════════════════════════════════════════════════════════
// STATE HELPERS
// ══════════════════════════════════════════════════════════════════
function calcHP(metrics) { return Math.round(metrics.reduce((s,m)=>s+m.value,0)/metrics.length*0.8+10); }
function calcStatus(v) { if(v>=80)return"OPTIMAL"; if(v>=60)return"MODERATE"; if(v>=40)return"WARNING"; return"CRITICAL"; }
function metricColor(v) { if(v>=80)return C.green; if(v>=60)return C.blue; if(v>=40)return C.yellow; return C.red; }

const INIT_METRICS = [
  { id:"moisture",    label:"수분",   en:"HYDRATION",   value:38, status:"CRITICAL", color:C.red,    icon:"◉" },
  { id:"sebum",       label:"유분",   en:"SEBUM",       value:71, status:"ELEVATED", color:C.orange, icon:"◈" },
  { id:"sensitivity", label:"민감도", en:"SENSITIVITY", value:55, status:"MODERATE", color:C.blue,   icon:"◆" },
  { id:"barrier",     label:"방어막", en:"BARRIER",     value:44, status:"WARNING",  color:C.yellow, icon:"▣" },
];

const INIT_STATE = {
  // 피부 데이터
  metrics: INIT_METRICS,
  hp: calcHP(INIT_METRICS),
  env: { temp:22, hmd:31, cond:"건조함", threat:"HIGH" },
  scanHistory: [],
  lastScanDate: null,

  // XP / 레벨
  xp: 0,
  totalXPEarned: 0,
  levelUpQueue: [],        // 레벨업 시 팝업 큐

  // 일일 미션 (날짜별 관리)
  // { [dateKey]: { completedItems: Set, scanDone: bool, fullDone: bool } }
  dailyLog: {},

  // 스트릭
  streak: 0,              // 연속 완료 일수
  lastFullDay: null,       // 마지막으로 전체 루틴 완료한 날짜키

  // 장바구니
  cart: [],

  // 알림
  pushNotifs: [],
  toasts: [],
  dismissedAlerts: new Set(),

  // API 상태
  apiStatus: {
    loading: false,
    lastUpdate: null,
    source: null,      // "api" | "mock" | "scan"
    hpDelta: 0,
    xpChange: 0,
    error: null,
  },
};

let _uid = 0;
const uid = () => ++_uid;

function makeToast(msg, color=C.blue, xpGain=0) {
  return { id:uid(), msg, color, xpGain };
}

function reducer(state, action) {
  const today = todayKey();

  switch(action.type) {

    // ── 날짜 변경 → 전날 미수행 패널티 계산 후 당일 초기화
    case "NEW_DAY": {
      const dayLog = { ...state.dailyLog };
      let metrics = state.metrics;
      let xp = state.xp;
      let toasts = [...state.toasts];
      let lvQueue = [...state.levelUpQueue];
      let penaltyLog = [];

      // 전날 키 계산
      const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yKey = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth()+1).padStart(2,"0")}-${String(yesterdayDate.getDate()).padStart(2,"0")}`;
      const yLog = dayLog[yKey];

      // 전날 기록이 있고 오늘이 새로운 날인 경우에만 패널티 적용
      const isNewDay = !dayLog[today];
      if (isNewDay && yLog) {
        const completedCount = yLog.completedItems?.size || 0;
        const completionRate = completedCount / TOTAL_ITEMS;
        const decay = getDecay(completionRate);

        // 피부 수치 악화 적용
        const prevHP = state.hp;
        metrics = state.metrics.map(m => {
          const delta = decay[m.id] || 0;
          const v = Math.max(0, Math.min(100, m.value + delta));
          return { ...m, value:v, status:calcStatus(v), color:metricColor(v) };
        });
        const newHP = calcHP(metrics);

        // XP 차감 계산
        let xpPenalty = 0;
        if (!yLog.scanDone) {
          xpPenalty += XP_REWARDS.MISSED_SCAN;
          penaltyLog.push(`스캔 미수행 ${XP_REWARDS.MISSED_SCAN}XP`);
        }
        if (completionRate === 0) {
          xpPenalty += XP_REWARDS.SKIP_DAY;
          penaltyLog.push(`루틴 미수행 ${XP_REWARDS.SKIP_DAY}XP`);
        } else if (completionRate < 0.5) {
          xpPenalty += XP_REWARDS.SKIP_PARTIAL;
          penaltyLog.push(`루틴 부분 완료 ${XP_REWARDS.SKIP_PARTIAL}XP`);
        }

        xp = Math.max(0, xp + xpPenalty);

        // 레벨 다운 체크
        const oldLv = getLevelInfo(state.xp).lv;
        const newLv = getLevelInfo(xp).lv;

        if (xpPenalty < 0) {
          const hpDelta = newHP - prevHP;
          toasts.push({
            id:uid(),
            msg: `⚠ 전날 미수행 — HP${hpDelta} / XP${xpPenalty}`,
            color: C.red,
            xpGain: xpPenalty,
            isPenalty: true,
          });
        }

        // 패널티 적용된 전날 기록 저장
        dayLog[yKey] = { ...yLog, penaltyApplied:true, penaltyLog, xpPenalty, completionRate };
      }

      // 오늘 슬롯 초기화
      if (!dayLog[today]) dayLog[today] = { completedItems:new Set(), scanDone:false, fullDone:false };

      return {
        ...state, metrics, hp:calcHP(metrics), xp, dailyLog:dayLog,
        pushNotifs:[], dismissedAlerts:new Set(), toasts,
        levelUpQueue:lvQueue,
      };
    }

    // ── 스캔 완료
    case "APPLY_SCAN": {
      const newMetrics = action.results.map((r,i)=>{
        const v=r.value;
        return { ...state.metrics[i], value:v, status:calcStatus(v), color:metricColor(v) };
      });
      const newHP = calcHP(newMetrics);
      const now = new Date();
      const scan = { date:now, metrics:newMetrics, hp:newHP, id:uid() };

      const dayLog = { ...state.dailyLog };
      const today_log = { ...(dayLog[today]||{ completedItems:new Set(), scanDone:false, fullDone:false }) };

      let xpGain = 0;
      let toasts = [...state.toasts];
      let lvQueue = [...state.levelUpQueue];

      if (!today_log.scanDone) {
        xpGain += XP_REWARDS.SCAN;
        today_log.scanDone = true;
        toasts.push(makeToast(`◈ 스캔 완료 — HP ${newHP}/100`, C.blue, XP_REWARDS.SCAN));
      } else {
        toasts.push(makeToast(`◈ 재스캔 완료 — HP ${newHP}/100`, C.blue));
      }
      dayLog[today] = today_log;

      const newXP = state.xp + xpGain;
      const oldLv = getLevelInfo(state.xp).lv;
      const newLv = getLevelInfo(newXP).lv;
      if (newLv > oldLv) lvQueue.push({ lv:newLv, ...LEVELS[newLv-1] });

      return {
        ...state, metrics:newMetrics, hp:newHP,
        env:{ ...state.env, scanDate:now },
        scanHistory:[scan,...state.scanHistory].slice(0,30),
        lastScanDate:now, dailyLog:dayLog,
        xp:newXP, totalXPEarned:state.totalXPEarned+xpGain,
        levelUpQueue:lvQueue, toasts,
      };
    }

    // ── 루틴 항목 토글
    case "TOGGLE_ROUTINE": {
      const { key, slotIdx, itemIdx } = action;
      const dayLog = { ...state.dailyLog };
      const tLog = { ...(dayLog[today]||{ completedItems:new Set(), scanDone:false, fullDone:false }) };
      const items = new Set(tLog.completedItems);
      const wasChecked = items.has(key);
      wasChecked ? items.delete(key) : items.add(key);
      tLog.completedItems = items;

      // 메트릭 부스트
      const boostMap = {
        "0-0":{moisture:+4},"0-1":{moisture:+3,sensitivity:-2},"0-2":{barrier:+4,moisture:+2},
        "1-0":{moisture:+2},"1-1":{barrier:+3},
        "2-0":{moisture:+5,sensitivity:-3},"2-1":{moisture:+3,sensitivity:-2},"2-2":{sebum:-4,moisture:+3},"2-3":{barrier:+5},
      };
      let metrics = state.metrics;
      if (!wasChecked) {
        const boost = boostMap[key] || {};
        metrics = state.metrics.map(m=>{
          const delta = boost[m.id] || 0;
          const v = Math.max(0, Math.min(100, m.value+delta));
          return { ...m, value:v, status:calcStatus(v), color:metricColor(v) };
        });
      }
      const newHP = calcHP(metrics);

      // XP 계산
      let xpGain = 0;
      let toasts = [...state.toasts];
      let lvQueue = [...state.levelUpQueue];
      let streak = state.streak;
      let lastFullDay = state.lastFullDay;

      if (!wasChecked) {
        xpGain += XP_REWARDS.ROUTINE_ITEM;
        toasts.push(makeToast(`✓ ${ROUTINE_SCHEDULE[slotIdx]?.items[itemIdx] || "루틴"} 완료`, C.green, XP_REWARDS.ROUTINE_ITEM));

        // 하루 전체 완료 체크
        const allDone = items.size >= TOTAL_ITEMS;
        if (allDone && !tLog.fullDone) {
          tLog.fullDone = true;
          xpGain += XP_REWARDS.DAILY_FULL;
          toasts.push(makeToast(`🎖 오늘 루틴 ALL CLEAR! +${XP_REWARDS.DAILY_FULL}XP`, C.gold, XP_REWARDS.DAILY_FULL));

          // 스트릭 계산
          const prevKey = (() => { const d=new Date(); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
          const prevFull = dayLog[prevKey]?.fullDone;
          const newStreak = prevFull ? streak + 1 : 1;
          streak = newStreak;
          lastFullDay = today;

          if (newStreak === 3) { xpGain += XP_REWARDS.STREAK_3; toasts.push(makeToast(`🔥 3일 연속! +${XP_REWARDS.STREAK_3}XP`, C.orange, XP_REWARDS.STREAK_3)); }
          if (newStreak === 7) { xpGain += XP_REWARDS.STREAK_7; toasts.push(makeToast(`⚡ 7일 연속 달성! +${XP_REWARDS.STREAK_7}XP`, C.purple, XP_REWARDS.STREAK_7)); }
        }
      } else {
        toasts.push(makeToast("루틴 취소됨", C.textMuted));
      }

      dayLog[today] = tLog;
      const newXP = Math.max(0, state.xp + (wasChecked ? -XP_REWARDS.ROUTINE_ITEM : xpGain));
      const oldLv = getLevelInfo(state.xp).lv;
      const newLv = getLevelInfo(newXP).lv;
      if (newLv > oldLv) lvQueue.push({ lv:newLv, ...LEVELS[newLv-1] });

      return { ...state, metrics, hp:newHP, dailyLog:dayLog, xp:newXP, totalXPEarned:state.totalXPEarned+(wasChecked?0:xpGain), levelUpQueue:lvQueue, streak, lastFullDay, toasts };
    }

    case "DISMISS_LEVELUP":
      return { ...state, levelUpQueue: state.levelUpQueue.slice(1) };

    // ── API 피부 분석 결과 수신 → 점수 업데이트 + XP 계산
    case "APPLY_SKIN_ANALYSIS": {
      // action.scores: { moisture, sebum, sensitivity, barrier } (0-100)
      // action.source: "api" | "mock"
      const { scores, delta, source } = action;
      const now = new Date();

      const newMetrics = state.metrics.map(m => {
        const newVal = scores[m.id] !== undefined ? Math.max(0, Math.min(100, scores[m.id])) : m.value;
        return { ...m, value:newVal, status:calcStatus(newVal), color:metricColor(newVal) };
      });
      const newHP = calcHP(newMetrics);
      const prevHP = state.hp;

      // 점수 개선 여부에 따라 XP 가산/차감
      const hpDelta = newHP - prevHP;
      let xpChange = 0;
      let toastMsg = "";
      let toastColor = C.blue;

      if (hpDelta > 0) {
        // 피부 개선 → XP 보상 (개선 폭에 비례)
        xpChange = Math.min(50, Math.round(hpDelta * 1.5));
        toastMsg = `API 분석 완료 — 피부 개선 +${xpChange}XP`;
        toastColor = C.green;
      } else if (hpDelta < 0) {
        // 피부 악화 → XP 차감 (악화 폭에 비례)
        xpChange = Math.max(-50, Math.round(hpDelta * 1.5));
        toastMsg = `API 분석 완료 — 피부 악화 ${xpChange}XP`;
        toastColor = C.red;
      } else {
        toastMsg = "API 분석 완료 — 피부 상태 유지";
        toastColor = C.textMuted;
      }

      const newXP = Math.max(0, state.xp + xpChange);
      const oldLv = getLevelInfo(state.xp).lv;
      const newLvN = getLevelInfo(newXP).lv;
      const lvQueue = [...state.levelUpQueue];
      if (newLvN > oldLv) lvQueue.push({ lv:newLvN, ...LEVELS[newLvN-1] });

      const scan = { date:now, metrics:newMetrics, hp:newHP, id:uid(), source };
      const toasts = [...state.toasts, { id:uid(), msg:toastMsg, color:toastColor, xpGain:xpChange, isPenalty:xpChange<0 }];

      return {
        ...state, metrics:newMetrics, hp:newHP, xp:newXP,
        totalXPEarned: state.totalXPEarned + Math.max(0, xpChange),
        scanHistory:[scan,...state.scanHistory].slice(0,30),
        lastScanDate:now, levelUpQueue:lvQueue, toasts,
        apiStatus: { loading:false, lastUpdate:now, source, hpDelta, xpChange },
      };
    }

    // ── API 로딩 상태 업데이트
    case "SET_API_STATUS":
      return { ...state, apiStatus:{ ...state.apiStatus, ...action.payload } };

    case "ADD_TO_CART": {
      if (state.cart.includes(action.id)) return state;
      return { ...state, cart:[...state.cart, action.id], toasts:[...state.toasts, makeToast("KIT에 추가됨 ◈", C.blue)] };
    }
    case "REMOVE_FROM_CART":
      return { ...state, cart:state.cart.filter(x=>x!==action.id) };

    case "PUSH_ROUTINE_ALERT": {
      const { routineId, msg, urgent } = action;
      if (state.pushNotifs.some(n=>n.routineId===routineId&&!n.dismissed)) return state;
      if (state.dismissedAlerts.has(routineId)) return state;
      return { ...state, pushNotifs:[{ id:uid(), routineId, msg, urgent, ts:new Date(), dismissed:false }, ...state.pushNotifs] };
    }
    case "DISMISS_PUSH": {
      const next = new Set(state.dismissedAlerts).add(action.routineId);
      return { ...state,
        pushNotifs:state.pushNotifs.map(n=>n.routineId===action.routineId?{...n,dismissed:true}:n),
        dismissedAlerts:next };
    }
    case "DISMISS_TOAST":
      return { ...state, toasts:state.toasts.filter(t=>t.id!==action.id) };

    default: return state;
  }
}

// ══════════════════════════════════════════════════════════════════
// AUDIO
// ══════════════════════════════════════════════════════════════════
let _actx=null;
function getActx(){ if(!_actx&&typeof window!=="undefined") _actx=new(window.AudioContext||window.webkitAudioContext)(); return _actx; }
function tone(freq,dur,type="sine",vol=0.09){ const ctx=getActx(); if(!ctx) return; if(ctx.state==="suspended") ctx.resume(); const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type=type; o.frequency.value=freq; g.gain.setValueAtTime(vol,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+dur); o.start(); o.stop(ctx.currentTime+dur+0.02); }
const SFX={
  tap:  ()=>tone(880,0.04,"sine",0.08),
  nav:  ()=>tone(660,0.05,"sine",0.07),
  scan: ()=>{ tone(520,0.09,"sawtooth",0.1); setTimeout(()=>tone(780,0.07,"sine",0.08),80); },
  lock: ()=>{ tone(440,0.12,"square",0.09); setTimeout(()=>tone(660,0.1,"square",0.07),140); },
  boost:()=>{ tone(550,0.06,"sine",0.1); setTimeout(()=>tone(770,0.08,"sine",0.08),80); setTimeout(()=>tone(990,0.1,"sine",0.06),160); },
  add:  ()=>{ tone(660,0.06,"sine",0.1); setTimeout(()=>tone(880,0.08,"sine",0.08),90); },
  levelUp: ()=>{
    [0,150,300,450,600].forEach((d,i)=>setTimeout(()=>tone(440+i*110,0.1,"sine",0.12),d));
    setTimeout(()=>tone(1100,0.3,"sine",0.15),700);
  },
  alert:()=>{ tone(440,0.1,"square",0.13); setTimeout(()=>tone(370,0.1,"square",0.1),120); setTimeout(()=>tone(440,0.15,"square",0.13),240); },
  urgentAlert:()=>{ [0,140,280,420].forEach(d=>setTimeout(()=>tone(500,0.09,"square",0.15),d)); },
};
function haptic(p=[8]){ navigator?.vibrate?.(p); }

// ══════════════════════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════════════════════
const PRODUCTS=[
  { id:"p1",unit:"WPN-001",name:"HYDRO BREACH SERUM", tagline:"고농도 히알루론산 / 심층 침투",  price:"₩42,000",specs:[["용량","50ml"],["성분","HA 3%"],["지속","72h"],["등급","S-CLASS"]],metricId:"moisture",   icon:"◉",stock:7  },
  { id:"p2",unit:"WPN-002",name:"SEBUM CONTROL UNIT", tagline:"나이아신아마이드 10% / 피지 억제",price:"₩38,000",specs:[["용량","30ml"],["성분","NIA 10%"],["지속","48h"],["등급","A-CLASS"]],metricId:"sebum",      icon:"◈",stock:12 },
  { id:"p3",unit:"WPN-003",name:"BARRIER SHIELD PRO", tagline:"세라마이드 / 방어막 복구",        price:"₩35,000",specs:[["용량","60ml"],["성분","CER 5%"],["지속","24h"],["등급","A-CLASS"]],metricId:"sensitivity",icon:"◆",stock:3  },
  { id:"p4",unit:"WPN-004",name:"FULL LOADOUT KIT",   tagline:"4종 풀세트 / 완전 복구",         price:"₩98,000",specs:[["구성","4종"],["절감","22%"],["기간","30일"],["등급","S+"]],         metricId:"barrier",    icon:"▣",stock:5  },
];
// ── 랭킹 목데이터 (실제 서버 연동 시 API로 교체)
const MOCK_RANKING = [
  { rank:1,  name:"ShadowOp",    lv:9,  xp:4200, hp:94, streak:21, badge:"◆", badgeColor:C.purple },
  { rank:2,  name:"IronSkin",    lv:8,  xp:3100, hp:88, streak:14, badge:"▣", badgeColor:C.orange },
  { rank:3,  name:"NightWatch",  lv:7,  xp:2400, hp:82, streak:10, badge:"◈", badgeColor:C.yellow },
  { rank:4,  name:"TacOps",      lv:6,  xp:1850, hp:77, streak:7,  badge:"◉", badgeColor:C.blue   },
  { rank:5,  name:"GhostSkin",   lv:5,  xp:1300, hp:71, streak:5,  badge:"◆", badgeColor:C.blue   },
  { rank:6,  name:"AlphaUnit",   lv:5,  xp:1100, hp:68, streak:4,  badge:"▣", badgeColor:C.blue   },
  { rank:7,  name:"BreachPro",   lv:4,  xp:750,  hp:63, streak:3,  badge:"◈", badgeColor:C.green  },
  { rank:8,  name:"SkinForce",   lv:3,  xp:480,  hp:58, streak:2,  badge:"◉", badgeColor:C.green  },
  { rank:9,  name:"ReconUnit",   lv:2,  xp:210,  hp:52, streak:1,  badge:"◆", badgeColor:C.textMuted },
  { rank:10, name:"NewRecruit",  lv:1,  xp:40,   hp:44, streak:0,  badge:"▣", badgeColor:C.textMuted },
];

const SCAN_PHASES=[
  {key:"INIT",   msg:"얼굴을 프레임 안에 위치시키십시오",color:C.textMuted},
  {key:"DETECT", msg:"◈ 얼굴 감지됨 — 정렬 중...",       color:C.yellow  },
  {key:"LOCK",   msg:"◉ 타겟 확보 — 스캔 개시",          color:C.blue    },
  {key:"ANALYZE",msg:"■ 피부 데이터 분석 중...",          color:C.green   },
  {key:"DONE",   msg:"✓ 분석 완료 — 수치 적용됨",         color:C.green   },
];

// ══════════════════════════════════════════════════════════════════
// CONTEXT
// ══════════════════════════════════════════════════════════════════
const AppCtx = createContext(null);
function useApp(){ return useContext(AppCtx); }

// ══════════════════════════════════════════════════════════════════
// SKIN ANALYSIS API LAYER
// 실제 배포 시 아래 API_CONFIG.endpoint를 교체하면 즉시 연동됩니다.
// analyzeFrame(imageBase64) → { moisture, sebum, sensitivity, barrier }
// ══════════════════════════════════════════════════════════════════
const API_CONFIG = {
  // 실제 API URL로 교체: "https://your-api.com/v1/skin-analysis"
  endpoint: null,
  // API가 없을 때 호출할 목업 (현재 메트릭 기반으로 시뮬레이션)
  useMock: true,
};

// 목업 분석: 현재 수치에서 ±5 랜덤 변동 (실제 API 대체 용)
async function mockAnalyze(currentMetrics) {
  await new Promise(r => setTimeout(r, 1800)); // 네트워크 지연 시뮬레이션
  return currentMetrics.reduce((acc, m) => {
    acc[m.id] = Math.max(10, Math.min(98, m.value + Math.floor(Math.random() * 14) - 6));
    return acc;
  }, {});
}

// 실제 API 호출 (이미지 base64 → 분석 결과)
async function callSkinAPI(imageBase64, currentMetrics) {
  if (API_CONFIG.useMock || !API_CONFIG.endpoint) {
    return { scores: await mockAnalyze(currentMetrics), source: "mock" };
  }
  const res = await fetch(API_CONFIG.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64 }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  // API 응답 스키마: { moisture, sebum, sensitivity, barrier } (0-100)
  return { scores: data, source: "api" };
}

// 미션 미수행 악화 시뮬레이션 (자정 NEW_DAY 없이도 테스트 가능)
async function simulateDecay(currentMetrics, completionRate) {
  const decay = getDecay(completionRate);
  return currentMetrics.reduce((acc, m) => {
    acc[m.id] = Math.max(0, Math.min(100, m.value + (decay[m.id] || 0)));
    return acc;
  }, {});
}

// ══════════════════════════════════════════════════════════════════
// DATE WATCHER — midnight reset
// ══════════════════════════════════════════════════════════════════
function DateWatcher() {
  const C = useC();
  const { dispatch } = useApp();
  useEffect(() => {
    dispatch({ type:"NEW_DAY" });
    const checkMidnight = () => {
      const now = new Date();
      const msToMidnight = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,5).getTime() - now.getTime();
      return setTimeout(() => { dispatch({ type:"NEW_DAY" }); checkMidnight(); }, msToMidnight);
    };
    const t = checkMidnight();
    return () => clearTimeout(t);
  }, []);
  return null;
}

// ══════════════════════════════════════════════════════════════════
// ROUTINE ALERT ENGINE
// ══════════════════════════════════════════════════════════════════
function RoutineAlertEngine() {
  const C = useC();
  const { state, dispatch } = useApp();
  const today = todayKey();
  const todayLog = state.dailyLog[today];

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const nowMins = now.getHours()*60 + now.getMinutes();
      ROUTINE_SCHEDULE.forEach((slot, si) => {
        const slotMins = slot.h*60 + slot.m;
        const graceEnd = slotMins + slot.graceMins;
        if (nowMins < graceEnd) return;
        if (nowMins > graceEnd + 120) return;
        const allDone = slot.items.every((_,j)=>todayLog?.completedItems?.has(`${si}-${j}`));
        if (allDone) return;
        const doneCnt = slot.items.filter((_,j)=>todayLog?.completedItems?.has(`${si}-${j}`)).length;
        const isUrgent = nowMins > graceEnd + 30;
        dispatch({ type:"PUSH_ROUTINE_ALERT", routineId:slot.id, msg:`${slot.time} ${slot.op} — ${slot.items.length-doneCnt}개 미완료`, urgent:isUrgent });
        if (isUrgent) { SFX.urgentAlert(); haptic([10,50,10,50,20]); }
        else { SFX.alert(); haptic([10,60,10]); }
      });
    };
    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, [todayLog?.completedItems, state.dismissedAlerts]);
  return null;
}

// ══════════════════════════════════════════════════════════════════
// LEVEL UP POPUP
// ══════════════════════════════════════════════════════════════════
function LevelUpOverlay() {
  const C = useC();
  const { state, dispatch } = useApp();
  const lv = state.levelUpQueue[0];

  useEffect(() => {
    if (lv) { SFX.levelUp(); haptic([20,80,20,80,40]); }
  }, [lv?.lv]);

  if (!lv) return null;
  return (
    <div style={{ position:"absolute", inset:0, zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.85)", backdropFilter:"blur(12px)" }}>
      <motion.div
        initial={{ scale:0.7, opacity:0 }} animate={{ scale:1, opacity:1 }}
        exit={{ scale:1.1, opacity:0 }}
        transition={{ type:"spring", stiffness:260, damping:22 }}
        style={{ position:"relative", width:"82%", maxWidth:340 }}>

        {/* Outer glow frame */}
        <motion.div animate={{ boxShadow:[`0 0 0px ${lv.color}`, `0 0 60px ${lv.color}88`, `0 0 20px ${lv.color}44`] }} transition={{ duration:1.5, repeat:Infinity }}
          style={{ position:"absolute", inset:-2, border:`2px solid ${lv.color}`, clipPath:"polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))" }}/>

        <div style={{ background:C.bgCard, clipPath:"polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))", padding:"28px 24px 24px" }}>

          {/* Particle sparks */}
          {[...Array(8)].map((_,i) => (
            <motion.div key={i}
              initial={{ opacity:0, scale:0, x:0, y:0 }}
              animate={{ opacity:[1,0], scale:[0,1], x:(i%2===0?1:-1)*((i+1)*18), y:-((i+1)*14) }}
              transition={{ delay:i*0.06, duration:0.8 }}
              style={{ position:"absolute", top:"50%", left:"50%", width:5, height:5, borderRadius:"50%", background:lv.color, pointerEvents:"none" }}/>
          ))}

          <div style={{ textAlign:"center", marginBottom:20 }}>
            <motion.div animate={{ opacity:[0.6,1,0.6] }} transition={{ duration:1.2, repeat:Infinity }}
              style={{ fontFamily:C.mono, fontSize:10, letterSpacing:"0.4em", color:lv.color, marginBottom:8 }}>
              ▲ LEVEL UP ▲
            </motion.div>
            <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:52, color:lv.color, lineHeight:1 }}>{lv.lv}</div>
            <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:18, color:C.textPrimary, marginTop:6, letterSpacing:"0.15em" }}>{lv.name}</div>
          </div>

          <div style={{ borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, padding:"12px 0", marginBottom:16, textAlign:"center" }}>
            <div style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted, letterSpacing:"0.15em", marginBottom:4 }}>신규 능력 해금</div>
            <div style={{ fontFamily:C.mono, fontSize:12, color:lv.color }}>{lv.perk}</div>
          </div>

          <motion.button whileTap={{ scale:0.96 }}
            onClick={() => { SFX.tap(); haptic([8]); dispatch({ type:"DISMISS_LEVELUP" }); }}
            style={{ width:"100%", padding:"13px 0", fontFamily:C.mono, fontWeight:900, fontSize:13, letterSpacing:"0.25em",
              color:C.bg, background:`linear-gradient(135deg,${lv.color},${lv.color}AA)`, border:"none", cursor:"pointer",
              clipPath:"polygon(8px 0%,calc(100% - 8px) 0%,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0% calc(100% - 8px),0% 8px)" }}>
            ◆ CONTINUE MISSION
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ══════════════════════════════════════════════════════════════════
function LoginScreen() {
  const C = useC();
  const { theme, toggleTheme } = useTheme();
  const { login, authState } = useAuth();
  const [activeBtn, setActiveBtn] = useState(null);
  const [dots, setDots] = useState(".");
  const isDark = theme === "dark";

  // 로딩 점 애니메이션
  useEffect(() => {
    if (authState !== "loading") return;
    const iv = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 400);
    return () => clearInterval(iv);
  }, [authState]);

  const handleLogin = async (provider) => {
    setActiveBtn(provider);
    haptic([10, 50, 10]);
    tone(550, 0.08, "sine", 0.1);
    await login(provider);
    setActiveBtn(null);
  };

  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    dur: 4 + Math.random() * 5,
    delay: Math.random() * 8,
    size: 1 + Math.random() * 2,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        padding: "0 0 32px",
        background: C.bg,
        backgroundImage: "radial-gradient(ellipse at 30% 20%, #001B2E 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, #000E1A 0%, transparent 50%)",
        fontFamily: C.mono,
        overflow: "hidden",
      }}>

      {/* Background grid */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:`linear-gradient(${C.blue}06 1px,transparent 1px),linear-gradient(90deg,${C.blue}06 1px,transparent 1px)`, backgroundSize:"32px 32px" }}/>

      {/* Scanline */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", opacity:0.025 }}>
        <motion.div animate={{ top:["0%","100%"] }} transition={{ duration:7, repeat:Infinity, ease:"linear" }} style={{ position:"absolute", left:0, right:0, height:2, background:"#fff" }}/>
      </div>

      {/* Ambient particles */}
      {particles.map(p => (
        <motion.div key={p.id}
          animate={{ opacity:[0, 0.7, 0], scale:[0, 1, 0] }}
          transition={{ duration:p.dur, delay:p.delay, repeat:Infinity }}
          style={{ position:"absolute", left:`${p.x}%`, top:`${p.y}%`, width:p.size, height:p.size, borderRadius:"50%", background:C.blue, pointerEvents:"none" }}/>
      ))}

      {/* 테마 토글 — 우상단 */}
      <div style={{ position:"absolute", top:14, right:14, zIndex:10 }}>
        <motion.button whileTap={{ scale:0.85 }} onClick={()=>{ SFX.tap(); toggleTheme(); }}
          style={{ background:"none", border:`1px solid ${C.border}`, cursor:"pointer", padding:"5px 7px",
            borderRadius:6, display:"flex", alignItems:"center", gap:4 }}>
          <AnimatePresence mode="wait">
            {isDark ? (
              <motion.div key="sun" initial={{ rotate:-90, opacity:0 }} animate={{ rotate:0, opacity:1 }} exit={{ rotate:90, opacity:0 }} transition={{ duration:0.22 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" stroke={C.yellow} strokeWidth="2"/>
                  {[0,45,90,135,180,225,270,315].map(deg=>{
                    const r=Math.PI/180,x1=12+7*Math.cos(deg*r),y1=12+7*Math.sin(deg*r),x2=12+9*Math.cos(deg*r),y2=12+9*Math.sin(deg*r);
                    return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.yellow} strokeWidth="1.5" strokeLinecap="round"/>;
                  })}
                </svg>
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ rotate:90, opacity:0 }} animate={{ rotate:0, opacity:1 }} exit={{ rotate:-90, opacity:0 }} transition={{ duration:0.22 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke={C.blue} strokeWidth="2" fill={`${C.blue}33`}/>
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
          <span style={{ fontFamily:C.mono, fontSize:8, color:C.textMuted, letterSpacing:"0.1em" }}>
            {isDark?"LIGHT":"DARK"}
          </span>
        </motion.button>
      </div>

      {/* ── HERO SECTION ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 32px 0" }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.2, type:"spring", stiffness:200 }}>

          {/* Animated hexagon emblem */}
          <div style={{ position:"relative", width:96, height:96, marginBottom:20 }}>
            <motion.div
              animate={{ rotate:[0, 360] }}
              transition={{ duration:20, repeat:Infinity, ease:"linear" }}
              style={{ position:"absolute", inset:0 }}>
              <svg width="96" height="96" viewBox="0 0 96 96">
                <polygon points="48,4 88,26 88,70 48,92 8,70 8,26"
                  fill="none" stroke={C.blue} strokeWidth="1" opacity="0.4"/>
              </svg>
            </motion.div>
            <motion.div
              animate={{ rotate:[0, -360] }}
              transition={{ duration:14, repeat:Infinity, ease:"linear" }}
              style={{ position:"absolute", inset:8 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <polygon points="40,3 73,21 73,59 40,77 7,59 7,21"
                  fill="none" stroke={C.blue} strokeWidth="1.5" opacity="0.6"/>
              </svg>
            </motion.div>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <motion.div
                animate={{ opacity:[0.6, 1, 0.6], scale:[0.95, 1, 0.95] }}
                transition={{ duration:2.5, repeat:Infinity }}>
                {/* Center reticle */}
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="8" stroke={C.blue} strokeWidth="1.5"/>
                  <circle cx="20" cy="20" r="3" fill={C.blue} opacity="0.8"/>
                  <line x1="20" y1="4" x2="20" y2="11" stroke={C.blue} strokeWidth="1.5"/>
                  <line x1="20" y1="29" x2="20" y2="36" stroke={C.blue} strokeWidth="1.5"/>
                  <line x1="4" y1="20" x2="11" y2="20" stroke={C.blue} strokeWidth="1.5"/>
                  <line x1="29" y1="20" x2="36" y2="20" stroke={C.blue} strokeWidth="1.5"/>
                </svg>
              </motion.div>
            </div>
          </div>

          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }}
            style={{ textAlign:"center" }}>
            <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:32, letterSpacing:"0.45em", color:C.blue,
              textShadow:`0 0 30px ${C.blueGlow}`, lineHeight:1 }}>
              ARMORY
            </div>
            <div style={{ fontFamily:C.mono, fontSize:9, letterSpacing:"0.22em", color:C.textFaint, marginTop:6 }}>
              TACTICAL SKINCARE SYSTEM
            </div>
          </motion.div>
        </motion.div>

        {/* Tagline */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.55 }}
          style={{ marginTop:32, textAlign:"center" }}>
          <div style={{ fontFamily:C.mono, fontSize:13, color:C.textSecond, lineHeight:1.7 }}>
            피부는 <span style={{ color:C.blue }}>전장</span>이다.<br/>
            매일 루틴이 <span style={{ color:C.green }}>방어막</span>이 된다.
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.75 }}
          style={{ display:"flex", gap:8, marginTop:20, flexWrap:"wrap", justifyContent:"center" }}>
          {["AI 피부 스캔", "일일 미션 XP", "레벨업 시스템"].map(label => (
            <Clip key={label} cut={5} style={{ padding:"5px 10px", border:`1px solid ${C.border}`, background:C.bgCard }}>
              <span style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted, letterSpacing:"0.1em" }}>{label}</span>
            </Clip>
          ))}
        </motion.div>
      </div>

      {/* ── LOGIN BUTTONS ── */}
      <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.9, type:"spring", stiffness:200 }}
        style={{ width:"100%", padding:"0 24px", display:"flex", flexDirection:"column", gap:12 }}>

        {authState === "loading" ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <motion.div animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:0.8, repeat:Infinity }}
              style={{ fontFamily:C.mono, fontSize:13, color:C.blue, letterSpacing:"0.2em" }}>
              ◈ 인증 처리 중{dots}
            </motion.div>
            <div style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted, marginTop:6 }}>
              {activeBtn === "google" ? "Google" : "Kakao"} 계정 확인 중
            </div>
          </div>
        ) : (
          <>
            {/* Google 로그인 */}
            <motion.button
              whileTap={{ scale:0.97 }}
              onClick={() => handleLogin("google")}
              style={{
                width:"100%", padding:"15px 20px",
                fontFamily:C.mono, fontWeight:700, fontSize:13, letterSpacing:"0.08em",
                color:"#ffffff",
                background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.18)",
                cursor:"pointer", position:"relative", overflow:"hidden",
                display:"flex", alignItems:"center", justifyContent:"center", gap:12,
                clipPath:"polygon(10px 0%,calc(100% - 10px) 0%,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0% calc(100% - 10px),0% 10px)",
              }}>
              {/* Google SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 계속하기
            </motion.button>

            {/* Kakao 로그인 */}
            <motion.button
              whileTap={{ scale:0.97 }}
              onClick={() => handleLogin("kakao")}
              style={{
                width:"100%", padding:"15px 20px",
                fontFamily:C.mono, fontWeight:700, fontSize:13, letterSpacing:"0.08em",
                color:"#191919",
                background:"#FEE500",
                border:"none",
                cursor:"pointer", position:"relative", overflow:"hidden",
                display:"flex", alignItems:"center", justifyContent:"center", gap:12,
                clipPath:"polygon(10px 0%,calc(100% - 10px) 0%,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0% calc(100% - 10px),0% 10px)",
              }}>
              {/* Kakao SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.75 1.63 5.17 4.1 6.6L5.2 21l5.5-3.6c.43.05.87.07 1.3.07 5.523 0 10-3.477 10-7.8S17.523 3 12 3z"/>
              </svg>
              카카오로 계속하기
            </motion.button>
          </>
        )}

        {authState === "error" && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            style={{ textAlign:"center", fontFamily:C.mono, fontSize:10, color:C.red, padding:"8px 0" }}>
            ⚠ 로그인 실패. 다시 시도하십시오.
          </motion.div>
        )}

        <div style={{ textAlign:"center", marginTop:4 }}>
          <span style={{ fontFamily:C.mono, fontSize:9, color:C.textFaint }}>
            로그인 시 서비스 이용약관 및 개인정보처리방침에 동의합니다
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════
// PRIMITIVES
// ══════════════════════════════════════════════════════════════════
function HUDCorners({ color=C.blue, size=12, thick=2 }) {
  const C = useC();
  const b=`${thick}px solid ${color}`,s={position:"absolute",width:size,height:size};
  return (<><span style={{...s,top:0,left:0,borderTop:b,borderLeft:b}}/><span style={{...s,top:0,right:0,borderTop:b,borderRight:b}}/><span style={{...s,bottom:0,left:0,borderBottom:b,borderLeft:b}}/><span style={{...s,bottom:0,right:0,borderBottom:b,borderRight:b}}/></>);
}
function Clip({ children, cut=10, style, onClick }) {
  const C = useC();
  return <div onClick={onClick} style={{ clipPath:`polygon(0 0,calc(100% - ${cut}px) 0,100% ${cut}px,100% 100%,${cut}px 100%,0 calc(100% - ${cut}px))`, ...style }}>{children}</div>;
}
function GlowBar({ value, max=100, color, h=7, anim=true, delay=0 }) {
  const C = useC();
  const pct=Math.min((value/max)*100,100);
  return (
    <Clip cut={4} style={{ height:h, background:C.bgStrip, border:`1px solid ${C.border}` }}>
      <motion.div initial={anim?{width:0}:{width:`${pct}%`}} animate={{width:`${pct}%`}}
        transition={{ delay, duration:0.9, ease:[0.16,1,0.3,1] }}
        style={{ height:"100%", background:`linear-gradient(90deg,${color}44,${color})`, boxShadow:`0 0 10px ${color}66` }}/>
    </Clip>
  );
}
function Dot({ on=true, color=C.green, size=6 }) {
  const C = useC();
  return <motion.span animate={{ opacity:on?[1,0.25,1]:0.25 }} transition={{ duration:1.6,repeat:Infinity }}
    style={{ display:"inline-block", width:size, height:size, borderRadius:"50%", background:on?color:C.textFaint }}/>;
}
function SecLabel({ children }) {
  const C = useC();
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
      <span style={{ fontFamily:C.mono, fontSize:9, letterSpacing:"0.2em", color:C.blueSub }}>{children}</span>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${C.border},transparent)` }}/>
    </div>
  );
}
function LiveClock() {
  const C = useC();
  const [t,setT]=useState("--:--:--");
  useEffect(()=>{ const tick=()=>{ const n=new Date(); setT(`${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:${String(n.getSeconds()).padStart(2,"0")}`); }; tick(); const id=setInterval(tick,1000); return()=>clearInterval(id); },[]);
  return <>{t}</>;
}
function LiveDateLabel() {
  const C = useC();
  const [d,setD]=useState("");
  useEffect(()=>{ const tick=()=>{ const n=new Date(); setD(n.toLocaleDateString("ko",{month:"2-digit",day:"2-digit",weekday:"short"})); }; tick(); const id=setInterval(tick,60000); return()=>clearInterval(id); },[]);
  return <>{d}</>;
}

// ══════════════════════════════════════════════════════════════════
// XP BAR WIDGET (mini, for TopBar)
// ══════════════════════════════════════════════════════════════════
function MiniXPBar() {
  const C = useC();
  const { state } = useApp();
  const lvInfo = getLevelInfo(state.xp);
  const pct = xpProgress(state.xp);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:90 }}>
      <div style={{ fontFamily:C.mono, fontSize:9, fontWeight:900, color:lvInfo.color, letterSpacing:"0.05em", whiteSpace:"nowrap" }}>
        LV.{lvInfo.lv}
      </div>
      <div style={{ flex:1, height:4, background:C.bgStrip, border:`1px solid ${C.border}`, position:"relative", overflow:"hidden", minWidth:50 }}>
        <motion.div animate={{ width:`${pct}%` }} transition={{ duration:0.6, ease:"easeOut" }}
          style={{ height:"100%", background:`linear-gradient(90deg,${lvInfo.color}44,${lvInfo.color})`, boxShadow:`0 0 6px ${lvInfo.color}` }}/>
      </div>
      <div style={{ fontFamily:C.mono, fontSize:8, color:C.textMuted, whiteSpace:"nowrap" }}>{state.xp}XP</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TOAST LAYER
// ══════════════════════════════════════════════════════════════════
function ToastLayer() {
  const C = useC();
  const { state, dispatch } = useApp();
  const visible = state.toasts.slice(-3);
  useEffect(() => {
    if (!state.toasts.length) return;
    const latest = state.toasts[state.toasts.length-1];
    const t = setTimeout(() => dispatch({ type:"DISMISS_TOAST", id:latest.id }), 2800);
    return () => clearTimeout(t);
  }, [state.toasts]);
  return (
    <div style={{ position:"absolute", top:64, left:14, right:14, zIndex:300, pointerEvents:"none", display:"flex", flexDirection:"column", gap:5 }}>
      <AnimatePresence>
        {visible.map(n=>(
          <motion.div key={n.id} initial={{ opacity:0, y:-10, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-6, scale:0.95 }}
            transition={{ type:"spring", stiffness:340, damping:28 }}
            style={{
              padding: n.isPenalty ? "9px 14px" : "7px 12px",
              border:`1px solid ${n.color}66`,
              background: n.isPenalty ? `rgba(40,5,5,0.97)` : "rgba(7,21,32,0.97)",
              fontFamily:C.mono, fontSize:11, display:"flex", alignItems:"center", justifyContent:"space-between",
              clipPath:"polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))",
              backdropFilter:"blur(14px)",
            }}>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {n.isPenalty && <span style={{ color:C.red, fontSize:9, letterSpacing:"0.15em" }}>⚠ PENALTY APPLIED</span>}
              <span style={{ color:n.color }}>{n.msg}</span>
            </div>
            {n.xpGain > 0 && <span style={{ color:C.gold, fontSize:10, fontWeight:900, marginLeft:8 }}>+{n.xpGain}XP</span>}
            {n.xpGain < 0 && <span style={{ color:C.red, fontSize:10, fontWeight:900, marginLeft:8 }}>{n.xpGain}XP</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TOP BAR ICONS
// ══════════════════════════════════════════════════════════════════
function WatchIcon({ alertCount, urgent, onClick }) {
  const C = useC();
  const hasAlert=alertCount>0, borderCol=urgent?C.red:hasAlert?C.orange:C.blue;
  return (
    <motion.button whileTap={{ scale:0.86 }} onClick={onClick} style={{ background:"none", border:"none", cursor:"pointer", position:"relative", padding:4 }}>
      {hasAlert&&<motion.div animate={{ scale:[1,1.4,1], opacity:[0.7,0,0.7] }} transition={{ duration:urgent?1.2:2, repeat:Infinity }} style={{ position:"absolute", inset:2, borderRadius:"50%", border:`1px solid ${borderCol}`, pointerEvents:"none" }}/>}
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="10" y="1" width="8" height="5" rx="1.5" stroke={borderCol} strokeWidth="1.4"/>
        <rect x="10" y="22" width="8" height="5" rx="1.5" stroke={borderCol} strokeWidth="1.4"/>
        <circle cx="14" cy="14" r="9" stroke={borderCol} strokeWidth="1.8" fill={hasAlert?`${borderCol}18`:"none"}/>
        <rect x="23" y="12" width="3" height="4" rx="0.8" stroke={borderCol} strokeWidth="1.2"/>
        <line x1="14" y1="9" x2="14" y2="14" stroke={borderCol} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="14" y1="14" x2={urgent?"17.5":"16.5"} y2={urgent?"11":"17"} stroke={borderCol} strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="14" cy="14" r="1.5" fill={borderCol}/>
        {[0,60,120,180,240,300].map((deg,i)=>{ const r=7.2,rad=(deg-90)*Math.PI/180,x1=14+r*Math.cos(rad),y1=14+r*Math.sin(rad),x2=14+(r-1.8)*Math.cos(rad),y2=14+(r-1.8)*Math.sin(rad); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={borderCol} strokeWidth="0.9" opacity="0.5"/>; })}
      </svg>
      {hasAlert&&<motion.div initial={{ scale:0 }} animate={{ scale:1 }} style={{ position:"absolute", top:0, right:0, minWidth:15, height:15, borderRadius:8, padding:"0 3px", background:urgent?C.red:C.orange, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:C.mono, fontSize:8, fontWeight:900, color:"#000" }}>{alertCount}</motion.div>}
    </motion.button>
  );
}
function AmmoIcon({ count, onClick }) {
  const C = useC();
  return (
    <motion.button whileTap={{ scale:0.88 }} onClick={onClick} style={{ background:"none", border:"none", cursor:"pointer", position:"relative", padding:4 }}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="4" y="6" width="12" height="16" rx="1" stroke={C.blue} strokeWidth="1.5"/>
        <path d="M4 8 Q10 4 16 8" stroke={C.blue} strokeWidth="1.5" fill="none"/>
        <rect x="6.5" y="10" width="3" height="5" rx="0.5" fill={C.blue} opacity="0.75"/>
        <rect x="11"  y="10" width="3" height="5" rx="0.5" fill={C.blue} opacity="0.75"/>
        <rect x="6.5" y="16.5" width="3" height="3" rx="0.5" fill={C.blue} opacity="0.4"/>
        <rect x="11"  y="16.5" width="3" height="3" rx="0.5" fill={C.blue} opacity="0.4"/>
        <rect x="3" y="21" width="14" height="2.5" rx="0.5" stroke={C.blue} strokeWidth="1"/>
        <line x1="20" y1="8" x2="20" y2="20" stroke={C.borderFx} strokeWidth="1.2"/>
        <line x1="17" y1="14" x2="23" y2="14" stroke={C.borderFx} strokeWidth="1.2"/>
      </svg>
      {count>0&&<motion.div initial={{ scale:0 }} animate={{ scale:1 }} style={{ position:"absolute", top:0, right:0, width:14, height:14, borderRadius:"50%", background:C.red, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:C.mono, fontSize:8, fontWeight:900, color:"#fff" }}>{count}</motion.div>}
    </motion.button>
  );
}

// ══════════════════════════════════════════════════════════════════
// TOP BAR
// ══════════════════════════════════════════════════════════════════
function TopBar({ onWatchOpen, onCartOpen }) {
  const C = useC();
  const { state, theme, toggleTheme } = useApp();
  const activeAlerts = state.pushNotifs.filter(n=>!n.dismissed);
  const hasUrgent = activeAlerts.some(n=>n.urgent);
  const isDark = theme === "dark";
  return (
    <motion.div animate={{ background:C.topBarBg, borderColor:C.border }}
      style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"8px 12px 7px 16px", borderBottom:`1px solid ${C.border}`,
        backdropFilter:"blur(16px)", zIndex:30 }}>
      {/* Brand + date */}
      <div>
        <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:18, letterSpacing:"0.32em", color:C.blue, textShadow:`0 0 20px ${C.blueGlow}`, lineHeight:1 }}>ARMORY</div>
        <div style={{ fontFamily:C.mono, fontSize:8, color:C.textFaint, marginTop:2, letterSpacing:"0.15em" }}><LiveDateLabel /></div>
      </div>

      {/* Center: XP bar */}
      <div style={{ flex:1, padding:"0 12px" }}>
        <MiniXPBar />
      </div>

      {/* Right: icons + clock */}
      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
        {/* 테마 토글 버튼 */}
        <motion.button whileTap={{ scale:0.85 }} onClick={()=>{ SFX.tap(); haptic([6]); toggleTheme(); }}
          style={{ background:"none", border:"none", cursor:"pointer", padding:4, position:"relative" }}>
          <AnimatePresence mode="wait">
            {isDark ? (
              <motion.div key="sun" initial={{ rotate:-90, opacity:0 }} animate={{ rotate:0, opacity:1 }} exit={{ rotate:90, opacity:0 }} transition={{ duration:0.22 }}>
                {/* 태양 아이콘 */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4.5" stroke={C.blue} strokeWidth="1.6"/>
                  <line x1="12" y1="2" x2="12" y2="5"    stroke={C.blue} strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="22"  stroke={C.blue} strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="2" y1="12" x2="5" y2="12"    stroke={C.blue} strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="19" y1="12" x2="22" y2="12"  stroke={C.blue} strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="4.9" y1="4.9" x2="7.1" y2="7.1"   stroke={C.blue} strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="16.9" y1="16.9" x2="19.1" y2="19.1" stroke={C.blue} strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="4.9" y1="19.1" x2="7.1" y2="16.9" stroke={C.blue} strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="16.9" y1="7.1" x2="19.1" y2="4.9"  stroke={C.blue} strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ rotate:90, opacity:0 }} animate={{ rotate:0, opacity:1 }} exit={{ rotate:-90, opacity:0 }} transition={{ duration:0.22 }}>
                {/* 달 아이콘 */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke={C.blue} strokeWidth="1.6" fill="none"/>
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <WatchIcon alertCount={activeAlerts.length} urgent={hasUrgent} onClick={()=>{ SFX.tap(); haptic([8]); onWatchOpen(); }}/>
        <AmmoIcon count={state.cart.length} onClick={()=>{ SFX.tap(); haptic([8]); onCartOpen(); }}/>
        <div style={{ width:1, height:22, background:C.border, margin:"0 3px" }}/>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:C.mono, fontWeight:700, fontSize:12, color:C.blue }}><LiveClock /></div>
          <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end", marginTop:1 }}>
            <Dot on color={C.green} size={5}/>
            <span style={{ fontFamily:C.mono, fontSize:7, color:isDark?"#1A8A4A":C.green }}>ONLINE</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════
// PUSH PANEL
// ══════════════════════════════════════════════════════════════════
function PushPanel({ onClose, onGoLoadout }) {
  const C = useC();
  const { state, dispatch } = useApp();
  const active = state.pushNotifs.filter(n=>!n.dismissed);
  const today = todayKey();
  const slot = (id) => ROUTINE_SCHEDULE.find(s=>s.id===id);
  const dismiss = (routineId) => { SFX.tap(); haptic([6]); dispatch({ type:"DISMISS_PUSH", routineId }); };

  return (
    <motion.div initial={{ y:"-100%", opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:"-100%", opacity:0 }}
      transition={{ type:"spring", stiffness:340, damping:34 }}
      style={{ position:"absolute", top:58, left:0, right:0, zIndex:150, background:"rgba(4,14,24,0.98)", borderBottom:`2px solid ${active.length>0?C.orange:C.border}`, backdropFilter:"blur(20px)", maxHeight:"60vh", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px 10px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="8" y="1" width="8" height="4" rx="1" stroke={C.orange} strokeWidth="1.4"/>
            <rect x="8" y="19" width="8" height="4" rx="1" stroke={C.orange} strokeWidth="1.4"/>
            <circle cx="12" cy="12" r="8" stroke={C.orange} strokeWidth="1.5"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke={C.orange} strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="12" x2="15" y2="14" stroke={C.orange} strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:13, color:C.textPrimary }}>ROUTINE ALERTS</div>
            <div style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted, marginTop:1 }}>{active.length===0?"모든 루틴 처리됨":`${active.length}개 미완료 루틴`}</div>
          </div>
        </div>
        <motion.button whileTap={{ scale:0.9 }} onClick={onClose} style={{ background:"none", border:`1px solid ${C.border}`, color:C.textMuted, fontFamily:C.mono, fontSize:9, padding:"3px 10px", cursor:"pointer" }}>CLOSE ✕</motion.button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"10px 14px" }}>
        {active.length===0?(
          <div style={{ textAlign:"center", padding:"24px 0", fontFamily:C.mono }}>
            <div style={{ fontSize:22, marginBottom:8, color:C.green, opacity:0.6 }}>✓</div>
            <div style={{ fontSize:11, color:C.textMuted }}>오늘의 루틴 완료!</div>
          </div>
        ):active.map((n,i)=>{
          const s=slot(n.routineId);
          const si=ROUTINE_SCHEDULE.indexOf(s);
          const doneCnt=s?s.items.filter((_,j)=>state.dailyLog[today]?.completedItems?.has(`${si}-${j}`)).length:0;
          const total=s?s.items.length:0;
          return (
            <motion.div key={n.id} initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.07 }}>
              <Clip cut={10} style={{ border:`1px solid ${n.urgent?`${C.red}77`:`${C.orange}66`}`, background:n.urgent?`rgba(255,85,85,0.06)`:`rgba(255,153,51,0.06)`, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <motion.div animate={{ opacity:n.urgent?[1,0.3,1]:1 }} transition={{ duration:0.7, repeat:Infinity }} style={{ width:7, height:7, borderRadius:"50%", background:n.urgent?C.red:C.orange, flexShrink:0 }}/>
                  <span style={{ fontFamily:C.mono, fontSize:9, fontWeight:900, color:n.urgent?C.red:C.orange, letterSpacing:"0.15em" }}>{n.urgent?"⚠ OVERDUE":"⏱ 미완료"}</span>
                  <span style={{ fontFamily:C.mono, fontSize:8, color:C.textFaint, marginLeft:"auto" }}>{n.ts.toLocaleTimeString("ko",{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:14, color:C.textPrimary, marginBottom:4 }}>{s?.time} {s?.op}</div>
                <div style={{ fontFamily:C.mono, fontSize:10, color:C.textMuted, marginBottom:10 }}>{n.msg}</div>
                {s&&<div style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted }}>진행률</span>
                    <span style={{ fontFamily:C.mono, fontSize:9, fontWeight:900, color:n.urgent?C.red:C.orange }}>{doneCnt}/{total}</span>
                  </div>
                  <GlowBar value={doneCnt} max={total} color={n.urgent?C.red:C.orange} h={5} anim={false}/>
                </div>}
                <div style={{ display:"flex", gap:8 }}>
                  <motion.button whileTap={{ scale:0.96 }} onClick={()=>{ SFX.boost(); haptic([8]); onGoLoadout(); onClose(); }}
                    style={{ flex:2, padding:"9px 0", fontFamily:C.mono, fontWeight:900, fontSize:11, letterSpacing:"0.15em", color:C.bg, background:n.urgent?`linear-gradient(135deg,${C.red},#CC2222)`:`linear-gradient(135deg,${C.orange},#CC6600)`, border:"none", cursor:"pointer", clipPath:"polygon(6px 0%,calc(100% - 6px) 0%,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0% calc(100% - 6px),0% 6px)" }}>
                    ▶ LOADOUT으로 이동
                  </motion.button>
                  <motion.button whileTap={{ scale:0.96 }} onClick={()=>dismiss(n.routineId)} style={{ flex:1, padding:"9px 0", fontFamily:C.mono, fontSize:10, color:C.textMuted, background:"none", border:`1px solid ${C.border}`, cursor:"pointer" }}>무시</motion.button>
                </div>
              </Clip>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════
// LIVE METRIC CARD
// ══════════════════════════════════════════════════════════════════
function LiveMetricCard({ metric }) {
  const C = useC();
  const prev=useRef(metric.value);
  const [delta,setDelta]=useState(null);
  useEffect(()=>{ const d=metric.value-prev.current; if(d!==0){setDelta(d); setTimeout(()=>setDelta(null),1800);} prev.current=metric.value; },[metric.value]);
  return (
    <Clip cut={5} style={{ padding:"9px 6px", background:C.bgCard, border:`1px solid ${metric.color}44`, textAlign:"center", position:"relative" }}>
      <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:16, color:metric.color, position:"relative" }}>
        <motion.span key={metric.value} initial={{ scale:1.3, opacity:0.5 }} animate={{ scale:1, opacity:1 }} transition={{ type:"spring", stiffness:300 }}>{metric.value}</motion.span>
        {delta!==null&&<motion.span initial={{ opacity:1, y:0 }} animate={{ opacity:0, y:-16 }} transition={{ duration:1.4 }} style={{ position:"absolute", right:-2, top:-2, fontFamily:C.mono, fontSize:9, fontWeight:900, color:delta>0?C.green:C.red }}>{delta>0?"+":""}{delta}</motion.span>}
      </div>
      <div style={{ fontSize:8, color:C.textMuted, marginTop:2 }}>{metric.label}</div>
      <div style={{ marginTop:4 }}><GlowBar value={metric.value} max={100} color={metric.color} h={3} anim={false}/></div>
    </Clip>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCAN BASE
// ══════════════════════════════════════════════════════════════════
function ScanBase({ onEngage }) {
  const C = useC();
  const { state } = useApp();
  const { hp, metrics, env } = state;

  const scannedToday = state.lastScanDate ? isSameDay(new Date(state.lastScanDate), new Date()) : false;
  const lastScanLabel = state.lastScanDate ? formatDate(new Date(state.lastScanDate)) : null;
  const lvInfo = getLevelInfo(state.xp);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", fontFamily:C.mono }}>

      {/* ENV STRIP */}
      <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        style={{ margin:"10px 14px 0", padding:"10px 14px",
          border:`1px solid ${scannedToday?`${C.red}55`:`${C.yellow}44`}`,
          background:scannedToday?C.redDim:"rgba(255,215,0,0.04)",
          clipPath:"polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))",
          display:"flex", alignItems:"center", gap:12 }}>
        {scannedToday?(
          <>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, letterSpacing:"0.18em", color:C.orange, fontWeight:700 }}>◈ 현재 작전 환경</div>
              <div style={{ fontWeight:900, fontSize:14, color:C.textPrimary, marginTop:3 }}>환경 상태: <span style={{ color:C.orange }}>{env.cond}</span></div>
            </div>
            <div style={{ display:"flex", gap:14, textAlign:"center", alignItems:"center" }}>
              {[["TEMP",`${env.temp}°`,C.orange],["HMD",`${env.hmd}%`,C.red]].map(([k,v,cl])=>(
                <div key={k}><div style={{ fontWeight:900, fontSize:17, color:cl }}>{v}</div><div style={{ fontSize:8, color:C.textMuted, marginTop:1 }}>{k}</div></div>
              ))}
              <Clip cut={5} style={{ padding:"5px 9px", background:`${C.red}22`, border:`1px solid ${C.red}66` }}>
                <div style={{ fontSize:8, fontWeight:700, color:C.red }}>THREAT</div>
                <div style={{ fontSize:11, fontWeight:900, color:C.red }}>{env.threat}</div>
              </Clip>
            </div>
          </>
        ):(
          <>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <motion.div animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.2, repeat:Infinity }} style={{ width:6, height:6, borderRadius:"50%", background:C.yellow, flexShrink:0 }}/>
                <div style={{ fontSize:9, letterSpacing:"0.15em", color:C.yellow, fontWeight:700 }}>{lastScanLabel?"이전 작전 환경 데이터":"스캔 데이터 없음"}</div>
              </div>
              <div style={{ fontWeight:900, fontSize:13, color:C.textPrimary }}>
                {lastScanLabel?<><span style={{ color:C.yellow }}>{env.cond}</span><span style={{ fontSize:10, color:C.textMuted, fontWeight:400 }}> ({lastScanLabel} 기준)</span></>
                :<span style={{ color:C.textMuted }}>스캔하여 오늘 환경을 분석하십시오</span>}
              </div>
            </div>
            <motion.button whileTap={{ scale:0.94 }} onClick={onEngage}
              style={{ flexShrink:0, padding:"7px 12px", fontFamily:C.mono, fontWeight:900, fontSize:10, letterSpacing:"0.12em", color:C.bg, background:`linear-gradient(135deg,${C.yellow},#CC9900)`, border:"none", cursor:"pointer", clipPath:"polygon(6px 0%,100% 0%,100% calc(100% - 6px),calc(100% - 6px) 100%,0% 100%,0% 6px)" }}>
              NOW SCAN
            </motion.button>
          </>
        )}
      </motion.div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 20px", gap:12 }}>
        {/* Silhouette */}
        <motion.div initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.2, type:"spring", stiffness:180 }}
          style={{ position:"relative", width:168, height:178 }}>
          <HUDCorners color={`${lvInfo.color}66`} size={16}/>
          <motion.div animate={{ opacity:[0.2,0.06,0.2] }} transition={{ duration:3.2, repeat:Infinity }} style={{ position:"absolute", inset:-8, border:`1px solid ${lvInfo.color}33` }}/>
          <svg width="168" height="178" viewBox="0 0 168 178" fill="none">
            <defs>
              <linearGradient id="sG2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lvInfo.color} stopOpacity="0.85"/>
                <stop offset="100%" stopColor="#003850" stopOpacity="0.18"/>
              </linearGradient>
              <filter id="gf4"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <ellipse cx="84" cy="42" rx="30" ry="35" fill="url(#sG2)" filter="url(#gf4)" opacity="0.9"/>
            <rect x="73" y="74" width="18" height="13" fill="url(#sG2)" opacity="0.7"/>
            <path d="M16 96 Q84 82 152 96 L158 152 L10 152 Z" fill="url(#sG2)" opacity="0.55"/>
            {[96,110,124,138].map((y,i)=>(
              <motion.line key={i} x1="16" y1={y} x2="152" y2={y} stroke={lvInfo.color} strokeWidth="0.5"
                animate={{ opacity:[0.06,0.2,0.06] }} transition={{ duration:2.5, delay:i*0.4, repeat:Infinity }}/>
            ))}
            <circle cx="84" cy="42" r="19" stroke={lvInfo.color} strokeWidth="1" fill="none" opacity="0.65"/>
            {[[65,42,73,42],[95,42,103,42],[84,23,84,31],[84,53,84,61]].map(([x1,y1,x2,y2],i)=>(
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lvInfo.color} strokeWidth="1" opacity="0.7"/>
            ))}
            <circle cx="84" cy="42" r="4" stroke={lvInfo.color} strokeWidth="1" fill={`${lvInfo.color}33`}/>
            <motion.rect x="16" width="136" height="3" fill={lvInfo.color} opacity="0.1" animate={{ y:[88,152,88] }} transition={{ duration:3, repeat:Infinity, ease:"linear" }}/>
            <text x="84" y="126" textAnchor="middle" fontSize="9" fill={lvInfo.color} opacity="0.9" fontFamily="monospace">{hp} HP</text>
            {/* Level badge */}
            <text x="84" y="142" textAnchor="middle" fontSize="7" fill={lvInfo.color} opacity="0.6" fontFamily="monospace">LV.{lvInfo.lv} {lvInfo.name}</text>
          </svg>
          <div style={{ position:"absolute", top:6, left:8, fontSize:7, color:`${lvInfo.color}99`, letterSpacing:"0.15em" }}>SCAN READY</div>
          {state.lastScanDate&&<div style={{ position:"absolute", bottom:4, right:6, fontSize:7, color:`${C.green}99` }}>{formatDate(new Date(state.lastScanDate))}</div>}
        </motion.div>

        {/* HP BAR */}
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35 }} style={{ width:"100%", maxWidth:300 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:10, letterSpacing:"0.15em", color:C.textMuted, fontWeight:700 }}>SKIN DURABILITY</span>
            <motion.span key={hp} animate={{ color:hp<50?C.red:hp<70?C.yellow:C.green }} style={{ fontSize:11, fontWeight:900 }}>{hp} / 100 HP</motion.span>
          </div>
          <div style={{ position:"relative", height:13, background:C.bgStrip, border:`1px solid ${C.border}`, clipPath:"polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,7px 100%,0 calc(100% - 7px))" }}>
            <motion.div animate={{ width:`${hp}%` }} transition={{ duration:0.8, ease:[0.16,1,0.3,1] }}
              style={{ height:"100%", background:`linear-gradient(90deg,#3A0000,${hp<50?C.red:hp<70?C.yellow:C.green})`, boxShadow:`0 0 12px ${hp<50?C.red:C.green}` }}/>
            {[25,50,75].map(p=><div key={p} style={{ position:"absolute", top:0, bottom:0, left:`${p}%`, width:1, background:C.bg }}/>)}
          </div>
          <div style={{ marginTop:4, fontSize:9, color:hp<50?C.red:C.textMuted, fontWeight:700 }}>
            {hp<50?"⚠ CRITICAL":hp<70?"⚡ 주의":"✓ 안정 상태"}
          </div>
        </motion.div>

        {/* METRICS */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
          style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, width:"100%", maxWidth:300 }}>
          {metrics.map(m=><LiveMetricCard key={m.id} metric={m}/>)}
        </motion.div>
      </div>

      {/* ENGAGE */}
      <div style={{ padding:"6px 16px 14px" }}>
        <motion.button initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.65 }}
          whileTap={{ scale:0.96 }} onClick={()=>{ SFX.scan(); haptic([15]); onEngage(); }}
          style={{ width:"100%", padding:"17px 0", fontFamily:C.mono, fontWeight:900, fontSize:16, letterSpacing:"0.3em", color:lvInfo.color,
            background:`linear-gradient(135deg,${C.bgCard},${C.bgCardHi})`, border:`2px solid ${lvInfo.color}`,
            clipPath:"polygon(14px 0%,calc(100% - 14px) 0%,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0% calc(100% - 14px),0% 14px)",
            boxShadow:`0 0 36px ${lvInfo.color}44,inset 0 0 36px ${lvInfo.color}0A`, position:"relative", overflow:"hidden", cursor:"pointer" }}>
          <HUDCorners color={lvInfo.color} size={9}/>
          <motion.div animate={{ x:["-100%","200%"] }} transition={{ duration:3, repeat:Infinity, ease:"linear" }}
            style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${lvInfo.color}18,transparent)`, pointerEvents:"none" }}/>
          ◈ ENGAGE SCAN
        </motion.button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCAN CAMERA
// ══════════════════════════════════════════════════════════════════
function ScanCamera({ onComplete, onBack }) {
  const C = useC();
  const { state, dispatch } = useApp();
  const videoRef=useRef(null);
  const [phaseIdx,setPhaseIdx]=useState(0);
  const [scanPct,setScanPct]=useState(0);
  const timerRef=useRef(null);
  const intRef=useRef(null);
  useEffect(()=>{
    navigator.mediaDevices?.getUserMedia({ video:{facingMode:"user"}, audio:false }).then(s=>{ if(videoRef.current){videoRef.current.srcObject=s; videoRef.current.play();} }).catch(()=>{});
    const TIMINGS=[1400,1300,900,null];
    const advance=(idx)=>{
      if(idx===1) SFX.scan();
      if(idx===2){SFX.lock(); haptic([12,50,12]);}
      if(idx===3){
        let p=0;
        intRef.current=setInterval(()=>{
          p+=Math.random()*5+2;
          if(p>=100){ clearInterval(intRef.current); setScanPct(100); setPhaseIdx(4); SFX.lock(); haptic([20,80,20]);
            // API 연동 분석 시작
            dispatch({ type:"SET_API_STATUS", payload:{ loading:true, error:null } });
            callSkinAPI(null, state.metrics)
              .then(({ scores, source }) => {
                dispatch({ type:"APPLY_SKIN_ANALYSIS", scores, source });
              })
              .catch(err => {
                dispatch({ type:"SET_API_STATUS", payload:{ loading:false, error:err.message } });
                // fallback: 기존 랜덤 방식
                const results=state.metrics.map(m=>({ value:Math.max(15,Math.min(98,m.value+Math.floor(Math.random()*16)-5)) }));
                dispatch({ type:"APPLY_SCAN", results });
              });
            setTimeout(onComplete,800); return;
          }
          setScanPct(Math.min(p,100));
        },70);
        return;
      }
      const next=idx+1;
      if(TIMINGS[idx]!=null) timerRef.current=setTimeout(()=>{setPhaseIdx(next); advance(next);},TIMINGS[idx]);
    };
    timerRef.current=setTimeout(()=>{setPhaseIdx(1); advance(1);},800);
    return()=>{ clearTimeout(timerRef.current); clearInterval(intRef.current); videoRef.current?.srcObject?.getTracks().forEach(t=>t.stop()); };
  },[]);
  const phase=SCAN_PHASES[Math.min(phaseIdx,SCAN_PHASES.length-1)];
  return (
    <div style={{ position:"relative", height:"100%", background:"#000", overflow:"hidden" }}>
      <video ref={videoRef} muted playsInline style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)", opacity:0.8 }}/>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 65% 75% at 50% 42%,transparent 40%,rgba(0,0,0,0.88) 100%)" }}/>
      <div style={{ position:"absolute", top:0, left:0, right:0, padding:"12px 16px", background:"linear-gradient(to bottom,rgba(0,0,0,0.9),transparent)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button onClick={()=>{SFX.tap(); onBack();}} style={{ fontFamily:C.mono, fontSize:11, color:C.textMuted, background:"none", border:"none", cursor:"pointer" }}>◀ ABORT</button>
          <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:17, letterSpacing:"0.35em", color:C.blue }}>ARMORY</div>
          <motion.div animate={{ color:phase.color }} style={{ fontFamily:C.mono, fontSize:9 }}>■ AI SCAN</motion.div>
        </div>
      </div>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ position:"relative", width:232, height:292 }}>
          <motion.div animate={{ borderColor:phase.color, opacity:phaseIdx>=1?1:0.35 }} transition={{ duration:0.4 }} style={{ position:"absolute", inset:0, border:`1px solid ${C.textMuted}` }}>
            <HUDCorners color={phase.color} size={22} thick={2}/>
          </motion.div>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <motion.div animate={{ borderColor:phase.color, boxShadow:phaseIdx>=1?`0 0 28px ${phase.color}55`:"none" }} transition={{ duration:0.4 }}
              style={{ width:164, height:214, borderRadius:"50%", border:`1.5px solid ${C.textMuted}`, position:"relative" }}>
              <div style={{ position:"absolute", top:"50%", left:-26, right:-26, height:1, background:phase.color, opacity:0.45 }}/>
              <div style={{ position:"absolute", left:"50%", top:-26, bottom:-26, width:1, background:phase.color, opacity:0.45 }}/>
              {phaseIdx>=2&&state.metrics.slice(0,3).map((m,i)=>{
                const pos=[{top:"12%",left:-76},{top:"45%",right:-76},{bottom:"15%",left:-76}];
                return (<motion.div key={m.id} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:i*0.12 }}
                  style={{ position:"absolute", ...pos[i], textAlign:"center", fontFamily:C.mono }}>
                  <div style={{ fontSize:12, fontWeight:900, color:m.color }}>{m.value}%</div>
                  <div style={{ fontSize:8, color:C.textSecond }}>{m.label}</div>
                  <div style={{ position:"absolute", top:"50%", ...(pos[i].left!==undefined?{right:-15,width:13}:{left:-15,width:13}), height:1, background:`${m.color}55` }}/>
                </motion.div>);
              })}
              {phaseIdx===3&&<div style={{ position:"absolute", inset:0, borderRadius:"50%", overflow:"hidden" }}>
                <motion.div animate={{ top:["-15%","115%"] }} transition={{ duration:1.3, repeat:Infinity, ease:"linear" }} style={{ position:"absolute", left:0, right:0, height:"22%", background:`linear-gradient(to bottom,transparent,${C.blue}33,transparent)` }}/>
              </div>}
            </motion.div>
          </div>
        </div>
      </div>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 20px 28px", background:"linear-gradient(to top,rgba(0,0,0,0.95),transparent)" }}>
        <motion.div key={phaseIdx} initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} style={{ fontFamily:C.mono, fontSize:12, letterSpacing:"0.15em", color:phase.color, textAlign:"center", marginBottom:10 }}>{phase.msg}</motion.div>
        <div style={{ height:5, background:C.bgStrip, marginBottom:8 }}>
          <motion.div style={{ height:"100%", width:`${scanPct}%`, background:`linear-gradient(90deg,${C.blueDim},${C.blue})`, boxShadow:`0 0 8px ${C.blue}` }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          {SCAN_PHASES.map((p,i)=>(
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <motion.div animate={{ background:i<=phaseIdx?C.blue:C.border }} style={{ width:6, height:6 }} transition={{ duration:0.3 }}/>
              <span style={{ fontFamily:C.mono, fontSize:7, color:C.textFaint }}>{p.key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SCAN REPORT
// ══════════════════════════════════════════════════════════════════
function ScanReport({ onBack }) {
  const C = useC();
  const { state, dispatch } = useApp();
  const [idx,setIdx]=useState(0);
  const [toast,setToast]=useState(null);
  const touchX=useRef(null);
  const go=useCallback((n)=>{ const next=Math.max(0,Math.min(PRODUCTS.length-1,n)); if(next===idx)return; SFX.nav(); haptic([6]); setIdx(next); },[idx]);
  const addKit=()=>{ SFX.add(); haptic([10,50,10]); dispatch({ type:"ADD_TO_CART", id:PRODUCTS[idx].id }); setToast(PRODUCTS[idx].name); setTimeout(()=>setToast(null),2200); };
  const metric=state.metrics.find(m=>m.id===PRODUCTS[idx].metricId)||state.metrics[idx];
  const product=PRODUCTS[idx];
  const inCart=state.cart.includes(product.id);
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", fontFamily:C.mono }}>
      <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px", borderBottom:`1px solid ${C.border}`, background:C.bgStrip }}>
        <button onClick={()=>{SFX.tap(); onBack();}} style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted, background:"none", border:"none", cursor:"pointer" }}>◀ RESCAN</button>
        <div style={{ fontSize:10, letterSpacing:"0.22em", color:C.blueSub, fontWeight:700 }}>ANALYSIS REPORT</div>
        <div style={{ fontSize:9, color:state.cart.length>0?C.blue:C.textMuted }}>KIT ({state.cart.length})</div>
      </div>
      <Clip cut={0} style={{ margin:"10px 14px 0", padding:"10px 14px", background:C.bgCard, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:8, color:C.textMuted }}>{state.lastScanDate?formatDate(new Date(state.lastScanDate)):"—"}</div>
          <div style={{ fontWeight:900, fontSize:14, color:C.textPrimary, marginTop:3 }}>피부 내구도: <motion.span key={state.hp} animate={{ color:state.hp<50?C.red:state.hp<70?C.yellow:C.green }} style={{ fontWeight:900 }}>{state.hp} HP</motion.span></div>
        </div>
        <Clip cut={5} style={{ padding:"5px 10px", border:`1px solid ${metric.color}66`, background:`${metric.color}18` }}>
          <div style={{ fontSize:9, fontWeight:900, color:metric.color }}>{metric.status}</div>
        </Clip>
      </Clip>
      <div style={{ flexShrink:0, display:"flex", justifyContent:"center", gap:8, padding:"10px 0 6px" }}>
        {PRODUCTS.map((_,i)=>(<motion.button key={i} onClick={()=>go(i)} animate={{ width:i===idx?22:7, background:i===idx?C.blue:C.border }} transition={{ type:"spring", stiffness:380, damping:30 }} style={{ height:4, borderRadius:2, border:"none", cursor:"pointer" }}/>))}
      </div>
      <div style={{ flex:1, overflow:"hidden", padding:"0 14px" }}
        onTouchStart={e=>{touchX.current=e.touches[0].clientX;}} onTouchEnd={e=>{ if(!touchX.current)return; const dx=touchX.current-e.changedTouches[0].clientX; if(Math.abs(dx)>48)go(dx>0?idx+1:idx-1); touchX.current=null; }}>
        <AnimatePresence mode="popLayout">
          <motion.div key={idx} initial={{ x:60, opacity:0, scale:0.96 }} animate={{ x:0, opacity:1, scale:1 }} exit={{ x:-60, opacity:0, scale:0.96 }} transition={{ type:"spring", stiffness:320, damping:32 }}
            style={{ height:"100%", display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ position:"relative", border:`1px solid ${metric.color}55`, background:C.bgCard, clipPath:"polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))", padding:16 }}>
              <HUDCorners color={`${metric.color}88`} size={10}/>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div><div style={{ fontSize:9, letterSpacing:"0.2em", color:C.textMuted }}>LIVE DATA // {idx+1}/{PRODUCTS.length}</div><div style={{ fontWeight:900, fontSize:18, color:C.textPrimary, marginTop:3 }}>{metric.label} // {metric.en}</div></div>
                <div style={{ textAlign:"right" }}><motion.div key={metric.value} initial={{ scale:1.3, opacity:0.6 }} animate={{ scale:1, opacity:1 }} style={{ fontWeight:900, fontSize:42, color:metric.color, lineHeight:1 }}>{metric.value}</motion.div><div style={{ fontSize:10, color:`${metric.color}99` }}>/ 100</div></div>
              </div>
              <div style={{ marginBottom:6, fontSize:9, color:C.textMuted, letterSpacing:"0.15em" }}>THREAT GAUGE</div>
              <GlowBar value={metric.value} max={100} color={metric.color} h={10} anim={false}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, marginBottom:10 }}>{[0,25,50,75,100].map(v=><span key={v} style={{ fontSize:8, color:C.textMuted }}>{v}</span>)}</div>
              <Clip cut={4} style={{ display:"inline-block", padding:"4px 9px", border:`1px solid ${metric.color}66`, background:`${metric.color}18` }}><span style={{ fontSize:9, fontWeight:900, color:metric.color }}>◈ {metric.status}</span></Clip>
            </div>
            <div style={{ border:`1px solid ${C.border}`, background:C.bgCard, clipPath:"polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))", padding:14 }}>
              <div style={{ fontSize:9, letterSpacing:"0.18em", color:C.textMuted, marginBottom:10, fontWeight:700 }}>◆ 전술 무기 제원</div>
              <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:10 }}>
                <Clip cut={7} style={{ width:64, height:64, flexShrink:0, border:`1px solid ${C.borderHi}`, background:C.bgCardHi, display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ fontSize:26, color:C.blue }}>{product.icon}</div></Clip>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:8, letterSpacing:"0.15em", color:C.textMuted }}>{product.unit}</div>
                  <div style={{ fontWeight:900, fontSize:13, color:C.textPrimary, marginTop:2 }}>{product.name}</div>
                  <div style={{ fontSize:10, color:C.blueText, marginTop:2 }}>{product.tagline}</div>
                  <div style={{ fontWeight:900, fontSize:17, color:C.blue, marginTop:5 }}>{product.price}</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 10px", marginBottom:10 }}>
                {product.specs.map(([k,v])=>(<div key={k} style={{ display:"flex", justifyContent:"space-between", borderBottom:`1px solid ${C.border}`, paddingBottom:4 }}><span style={{ fontSize:9, color:C.textMuted }}>{k}</span><span style={{ fontSize:9, fontWeight:900, color:C.blueText }}>{v}</span></div>))}
              </div>
              <motion.button whileTap={{ scale:0.97 }} onClick={addKit}
                style={{ width:"100%", padding:"13px 0", fontFamily:C.mono, fontWeight:900, fontSize:13, letterSpacing:"0.25em", color:inCart?C.green:C.blue, background:inCart?`${C.green}0D`:`linear-gradient(135deg,${C.bgCard},${C.bgCardHi})`, border:`2px solid ${inCart?`${C.green}88`:C.blue}`, clipPath:"polygon(8px 0%,calc(100% - 8px) 0%,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0% calc(100% - 8px),0% 8px)", position:"relative", overflow:"hidden", cursor:"pointer" }}>
                {!inCart&&<motion.div animate={{ x:["-100%","200%"] }} transition={{ duration:2.8, repeat:Infinity, ease:"linear" }} style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${C.blue}18,transparent)`, pointerEvents:"none" }}/>}
                {inCart?"✓ ADDED TO KIT":"[ ADD TO KIT ]"}
              </motion.button>
            </div>
            <div style={{ display:"flex", gap:8, paddingBottom:8 }}>
              {[["◀ PREV",()=>go(idx-1),idx===0],["NEXT ▶",()=>go(idx+1),idx===PRODUCTS.length-1]].map(([label,fn,disabled])=>(
                <motion.button key={label} whileTap={{ scale:0.94 }} onClick={fn} disabled={disabled} style={{ flex:1, padding:"9px 0", fontFamily:C.mono, fontSize:11, color:disabled?C.border:C.textSecond, background:"none", border:`1px solid ${disabled?C.border:C.borderHi}`, cursor:disabled?"default":"pointer" }}>{label}</motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence>{toast&&<motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:60, opacity:0 }} style={{ position:"absolute", bottom:16, left:14, right:14, padding:"10px 16px", border:`1px solid ${C.green}77`, background:C.greenDim, fontFamily:C.mono, fontSize:10, color:C.green, textAlign:"center", clipPath:"polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))" }}>✓ {toast} — KIT에 추가됨</motion.div>}</AnimatePresence>
    </div>
  );
}

function ScanTab() {
  const C = useC();
  const [view,setView]=useState("base");
  return (<div style={{ height:"100%", position:"relative" }}>
    <AnimatePresence mode="wait">
      {view==="base"  &&<motion.div key="b" style={{position:"absolute",inset:0}} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,scale:0.97}}><ScanBase  onEngage={()=>setView("camera")}/></motion.div>}
      {view==="camera"&&<motion.div key="c" style={{position:"absolute",inset:0}} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><ScanCamera onComplete={()=>setView("report")} onBack={()=>setView("base")}/></motion.div>}
      {view==="report"&&<motion.div key="r" style={{position:"absolute",inset:0}} initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{type:"spring",stiffness:300,damping:32}}><ScanReport onBack={()=>setView("base")}/></motion.div>}
    </AnimatePresence>
  </div>);
}

// ══════════════════════════════════════════════════════════════════
// LOADOUT TAB
// ══════════════════════════════════════════════════════════════════
function LoadoutTab() {
  const C = useC();
  const { state, dispatch } = useApp();
  const today = todayKey();
  const todayLog = state.dailyLog[today] || { completedItems:new Set(), scanDone:false, fullDone:false };
  const done = todayLog.completedItems;
  const donePct = Math.round((done.size / TOTAL_ITEMS) * 100);
  const lvInfo = getLevelInfo(state.xp);

  const toggle=(key, slotIdx, itemIdx)=>{ SFX.boost(); haptic([6]); dispatch({ type:"TOGGLE_ROUTINE", key, slotIdx, itemIdx }); };

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px", fontFamily:C.mono }}>

      {/* Daily mission progress */}
      <Clip cut={10} style={{ border:`1px solid ${donePct===100?`${C.green}66`:C.border}`, background:donePct===100?`${C.green}08`:C.bgCard, padding:"12px 14px", marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:9, color:C.textMuted, letterSpacing:"0.15em" }}>오늘의 일일 미션</div>
            <div style={{ fontWeight:900, fontSize:13, color:C.textPrimary, marginTop:2 }}><LiveDateLabel /></div>
          </div>
          <div style={{ textAlign:"right" }}>
            <motion.div key={donePct} animate={{ color:donePct===100?C.green:C.blue }} style={{ fontWeight:900, fontSize:20 }}>{donePct}%</motion.div>
            <div style={{ fontSize:9, color:C.textMuted }}>{done.size}/{TOTAL_ITEMS} 완료</div>
          </div>
        </div>
        <GlowBar value={donePct} max={100} color={donePct===100?C.green:C.blue} h={7} anim={false}/>
        {donePct===100&&<motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} style={{ marginTop:8, fontFamily:C.mono, fontSize:10, color:C.green, textAlign:"center" }}>
          🎖 미션 완료 — 전체 보너스 +{XP_REWARDS.DAILY_FULL}XP 획득!
        </motion.div>}

        {/* XP reward preview */}
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          {[["스캔",XP_REWARDS.SCAN,todayLog.scanDone],["항목당",XP_REWARDS.ROUTINE_ITEM,false],["전체완료",XP_REWARDS.DAILY_FULL,todayLog.fullDone]].map(([label,xp,done])=>(
            <Clip key={label} cut={4} style={{ flex:1, padding:"5px 4px", background:done?`${C.green}11`:C.bgStrip, border:`1px solid ${done?`${C.green}44`:C.border}`, textAlign:"center" }}>
              <div style={{ fontSize:9, fontWeight:900, color:done?C.green:C.gold }}>+{xp}XP</div>
              <div style={{ fontSize:7, color:C.textMuted, marginTop:1 }}>{label}</div>
            </Clip>
          ))}
        </div>
      </Clip>

      {/* 전날 패널티 경고 */}
      {(() => {
        const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate()-1);
        const yKey = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth()+1).padStart(2,"0")}-${String(yesterdayDate.getDate()).padStart(2,"0")}`;
        const yLog = state.dailyLog[yKey];
        if (!yLog || !yLog.penaltyApplied || yLog.xpPenalty >= 0) return null;
        return (
          <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
            style={{ marginBottom:14 }}>
            <Clip cut={8} style={{ border:`1px solid ${C.red}66`, background:`${C.red}0A`, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ duration:1, repeat:Infinity }}
                  style={{ width:7, height:7, borderRadius:"50%", background:C.red, flexShrink:0 }}/>
                <span style={{ fontSize:10, fontWeight:900, color:C.red, letterSpacing:"0.1em" }}>어제 루틴 미수행 — 피부 악화</span>
              </div>
              <div style={{ fontSize:9, color:C.textMuted, marginBottom:6 }}>
                전날 완료율 {Math.round((yLog.completionRate||0)*100)}% — XP {yLog.xpPenalty} / 피부 수치 하락 적용됨
              </div>
              <GlowBar value={Math.round((yLog.completionRate||0)*100)} max={100} color={C.red} h={4} anim={false}/>
            </Clip>
          </motion.div>
        );
      })()}

      <SecLabel>◈ DAILY LOADOUT SCHEDULE</SecLabel>
      {ROUTINE_SCHEDULE.map((s,i)=>{
        const slotDone=s.items.every((_,j)=>done.has(`${i}-${j}`));
        return (
          <motion.div key={i} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.1, type:"spring", stiffness:260, damping:26 }} style={{ marginBottom:12 }}>
            <Clip cut={10} style={{ border:`1px solid ${slotDone?`${C.green}55`:C.border}`, background:slotDone?`${C.green}07`:C.bgCard, padding:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <span style={{ fontWeight:900, fontSize:19, color:slotDone?C.green:C.blue }}>{s.time}</span>
                <div style={{ flex:1, height:1, background:C.border }}/>
                <Clip cut={4} style={{ padding:"3px 9px", border:`1px solid ${s.pc}66`, background:`${s.pc}18` }}>
                  <span style={{ fontSize:9, fontWeight:900, color:s.pc }}>{s.priority}</span>
                </Clip>
                {slotDone&&<motion.span initial={{ scale:0 }} animate={{ scale:1 }} style={{ fontSize:13, color:C.green }}>✓</motion.span>}
              </div>
              <div style={{ fontWeight:900, fontSize:14, color:C.textPrimary, marginBottom:10 }}>{s.op}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {s.items.map((item,j)=>{
                  const k=`${i}-${j}`, checked=done.has(k);
                  return (
                    <motion.button key={j} whileTap={{ scale:0.98 }} onClick={()=>toggle(k,i,j)}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", border:`1px solid ${checked?`${C.blue}66`:C.border}`, background:checked?"#001C30":"transparent", cursor:"pointer", textAlign:"left" }}>
                      <div style={{ width:16, height:16, border:`1.5px solid ${checked?C.blue:C.borderHi}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:checked?`${C.blue}22`:"transparent" }}>
                        {checked&&<motion.span initial={{ scale:0 }} animate={{ scale:1 }} style={{ color:C.blue, fontSize:11, fontWeight:900 }}>✓</motion.span>}
                      </div>
                      <span style={{ fontFamily:C.mono, fontSize:12, color:checked?C.blue:C.textSecond, textDecoration:checked?"line-through":"none", flex:1 }}>{item}</span>
                      {!checked&&<span style={{ fontSize:8, color:C.gold }}>+{XP_REWARDS.ROUTINE_ITEM}XP</span>}
                      {checked&&<span style={{ fontSize:8, color:`${C.green}99` }}>+HP</span>}
                    </motion.button>
                  );
                })}
              </div>
            </Clip>
          </motion.div>
        );
      })}

      {/* Live metrics */}
      <SecLabel>◉ 실시간 피부 수치</SecLabel>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:14 }}>
        {state.metrics.map(m=>(
          <Clip key={m.id} cut={7} style={{ border:`1px solid ${m.color}44`, background:C.bgCard, padding:"10px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
              <span style={{ fontSize:10, color:C.textMuted }}>{m.label}</span>
              <motion.span key={m.value} initial={{ scale:1.2 }} animate={{ scale:1 }} style={{ fontSize:16, fontWeight:900, color:m.color }}>{m.value}</motion.span>
            </div>
            <GlowBar value={m.value} max={100} color={m.color} h={4} anim={false}/>
          </Clip>
        ))}
      </div>

      {/* Streak */}
      <SecLabel>◉ STREAK & BONUS XP</SecLabel>
      <Clip cut={10} style={{ border:`1px solid ${C.border}`, background:C.bgCard, padding:14, marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:10, color:C.textMuted }}>연속 완료 스트릭</span>
          <div style={{ textAlign:"right" }}>
            <span style={{ fontSize:14, fontWeight:900, color:state.streak>=7?C.purple:state.streak>=3?C.orange:C.blue }}>{state.streak}일</span>
            {state.streak>=3&&<span style={{ fontSize:8, color:C.gold, marginLeft:6 }}>+{state.streak>=7?XP_REWARDS.STREAK_7:XP_REWARDS.STREAK_3}XP</span>}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:8 }}>
          {["M","T","W","T","F","S","S"].map((d,i)=>(
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:8, color:C.textFaint, marginBottom:3 }}>{d}</div>
              <div style={{ height:30, border:`1px solid ${i<state.streak?`${C.blue}66`:C.border}`, background:i<state.streak?"#001828":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ color:i<state.streak?C.green:C.textFaint, fontSize:12 }}>{i<state.streak?"✓":"·"}</span>
              </div>
            </div>
          ))}
        </div>
        <GlowBar value={(state.streak/7)*100} max={100} color={state.streak>=7?C.purple:state.streak>=3?C.orange:C.blue} h={5} anim={false}/>
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          {[["3일",XP_REWARDS.STREAK_3,state.streak>=3],["7일",XP_REWARDS.STREAK_7,state.streak>=7]].map(([label,xp,achieved])=>(
            <Clip key={label} cut={4} style={{ flex:1, padding:"5px", background:achieved?`${C.gold}18`:C.bgStrip, border:`1px solid ${achieved?`${C.gold}55`:C.border}`, textAlign:"center" }}>
              <div style={{ fontSize:10, fontWeight:900, color:achieved?C.gold:C.textFaint }}>+{xp}XP</div>
              <div style={{ fontSize:8, color:C.textMuted }}>{label} 연속</div>
            </Clip>
          ))}
        </div>
      </Clip>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// BASE TAB — 오퍼레이터 프로필 + 레벨 트리
// ══════════════════════════════════════════════════════════════════
function BaseTab() {
  const { state, user, logout } = useApp();
  const [settings, setSettings] = useState([
    {id:"notif", label:"작전 알림",   sub:"루틴 시간 푸시 알림",  on:true },
    {id:"haptic",label:"햅틱 피드백", sub:"버튼 터치 진동",       on:true },
    {id:"sound", label:"전술 사운드", sub:"UI 클릭 사운드",       on:true },
    {id:"night", label:"야간 모드",   sub:"저조도 자동 전환",     on:false},
  ]);
  const toggle=(id)=>{ SFX.tap(); haptic([6]); setSettings(s=>s.map(x=>x.id===id?{...x,on:!x.on}:x)); };
  const lvInfo = getLevelInfo(state.xp);
  const nextLv = getNextLevel(state.xp);
  const pct = xpProgress(state.xp);

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px", fontFamily:C.mono }}>

      {/* OPERATOR CARD */}
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
        <Clip cut={12} style={{ border:`1px solid ${lvInfo.color}55`, background:C.bgCard, padding:16, marginBottom:14, boxShadow:`0 0 28px ${lvInfo.color}14` }}>
          <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:14 }}>
            {/* Level badge */}
            <div style={{ position:"relative" }}>
              <Clip cut={8} style={{ width:58, height:58, border:`2px solid ${lvInfo.color}`, background:`${lvInfo.color}11`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                <div style={{ fontFamily:C.mono, fontWeight:900, fontSize:18, color:lvInfo.color, lineHeight:1 }}>{lvInfo.lv}</div>
                <div style={{ fontFamily:C.mono, fontSize:6, color:`${lvInfo.color}99`, letterSpacing:"0.1em" }}>LV</div>
              </Clip>
              <motion.div animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:2, repeat:Infinity }} style={{ position:"absolute", inset:-2, border:`1px solid ${lvInfo.color}44`, clipPath:"polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }}/>
            </div>
            <div style={{ flex:1 }}>
              {/* 실제 유저 이름 */}
              <div style={{ fontWeight:900, fontSize:16, color:C.textPrimary }}>{user?.name || "OPERATOR"}</div>
              <div style={{ fontSize:9, color:C.textMuted, marginTop:1 }}>{user?.email || ""}</div>
              <div style={{ fontSize:10, color:lvInfo.color, marginTop:2, letterSpacing:"0.08em" }}>{lvInfo.name} // LV.{lvInfo.lv}</div>
              <div style={{ marginTop:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontSize:8, color:C.textMuted }}>XP {state.xp} / {nextLv.maxXP}</span>
                  <span style={{ fontSize:8, color:lvInfo.color, fontWeight:900 }}>{Math.round(pct)}%</span>
                </div>
                <GlowBar value={state.xp} max={nextLv.maxXP} color={lvInfo.color} h={5} anim={false}/>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
            {[["STREAK",`${state.streak}일`],["HP",`${state.hp}pt`],["TOTAL XP",`${state.totalXPEarned}`]].map(([k,v])=>(
              <Clip key={k} cut={4} style={{ padding:"8px 4px", border:`1px solid ${C.border}`, textAlign:"center" }}>
                <motion.div key={v} initial={{ scale:1.15, opacity:0.6 }} animate={{ scale:1, opacity:1 }} style={{ fontWeight:900, fontSize:14, color:C.textPrimary }}>{v}</motion.div>
                <div style={{ fontSize:8, color:C.textMuted, marginTop:2 }}>{k}</div>
              </Clip>
            ))}
          </div>

          {/* Current perk */}
          <div style={{ marginTop:12, padding:"8px 10px", border:`1px solid ${lvInfo.color}44`, background:`${lvInfo.color}08`, clipPath:"polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))" }}>
            <div style={{ fontSize:8, color:`${lvInfo.color}99`, letterSpacing:"0.15em" }}>현재 레벨 특전</div>
            <div style={{ fontSize:11, color:lvInfo.color, marginTop:2, fontWeight:700 }}>{lvInfo.perk}</div>
          </div>
        </Clip>
      </motion.div>

      {/* LEVEL TREE */}
      <SecLabel>◆ OPERATOR LEVEL TREE</SecLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:14 }}>
        {LEVELS.map((lv, i) => {
          const isCur = lv.lv === lvInfo.lv;
          const isUnlocked = state.xp >= lv.minXP;
          return (
            <motion.div key={lv.lv} initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.04 }}>
              <Clip cut={7} style={{
                border:`1px solid ${isCur?`${lv.color}88`:isUnlocked?`${lv.color}33`:C.border}`,
                background:isCur?`${lv.color}12`:isUnlocked?`${lv.color}05`:C.bgStrip,
                padding:"8px 12px", display:"flex", alignItems:"center", gap:10,
              }}>
                <div style={{ width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                  border:`1.5px solid ${isUnlocked?lv.color:C.border}`,
                  background:isUnlocked?`${lv.color}18`:"transparent" }}>
                  <span style={{ fontFamily:C.mono, fontWeight:900, fontSize:11, color:isUnlocked?lv.color:C.textFaint }}>{lv.lv}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:C.mono, fontWeight:700, fontSize:11, color:isUnlocked?C.textPrimary:C.textFaint }}>{lv.name}</div>
                  <div style={{ fontFamily:C.mono, fontSize:9, color:isUnlocked?C.textMuted:C.textFaint, marginTop:1 }}>{lv.perk}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  {isCur&&<div style={{ fontFamily:C.mono, fontSize:8, fontWeight:900, color:lv.color }}>◀ NOW</div>}
                  {isUnlocked&&!isCur&&<div style={{ fontSize:10, color:C.green }}>✓</div>}
                  {!isUnlocked&&<div style={{ fontFamily:C.mono, fontSize:8, color:C.textFaint }}>{lv.minXP}XP</div>}
                </div>
              </Clip>
            </motion.div>
          );
        })}
      </div>

      {/* API 상태 */}
      {state.apiStatus?.lastUpdate && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <SecLabel>◈ API 분석 연동 상태</SecLabel>
          <Clip cut={8} style={{ border:`1px solid ${C.border}`, background:C.bgCard, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:state.apiStatus.error?C.red:C.green, flexShrink:0 }}/>
              <span style={{ fontSize:10, color:C.textPrimary, fontWeight:700 }}>
                {state.apiStatus.error ? "API 연결 오류" : `연결됨 // ${state.apiStatus.source?.toUpperCase()}`}
              </span>
              <span style={{ fontSize:8, color:C.textFaint, marginLeft:"auto" }}>
                {formatDate(new Date(state.apiStatus.lastUpdate))}
              </span>
            </div>
            {state.apiStatus.error && <div style={{ fontSize:9, color:C.red }}>{state.apiStatus.error}</div>}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:6 }}>
              <Clip cut={4} style={{ padding:"5px 8px", background:C.bgStrip, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:8, color:C.textMuted }}>HP 변화</div>
                <div style={{ fontSize:12, fontWeight:900, color:state.apiStatus.hpDelta>0?C.green:state.apiStatus.hpDelta<0?C.red:C.textMuted }}>
                  {state.apiStatus.hpDelta>0?"+":""}{state.apiStatus.hpDelta || 0}
                </div>
              </Clip>
              <Clip cut={4} style={{ padding:"5px 8px", background:C.bgStrip, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:8, color:C.textMuted }}>XP 변화</div>
                <div style={{ fontSize:12, fontWeight:900, color:state.apiStatus.xpChange>0?C.green:state.apiStatus.xpChange<0?C.red:C.textMuted }}>
                  {state.apiStatus.xpChange>0?"+":""}{state.apiStatus.xpChange || 0}
                </div>
              </Clip>
            </div>
          </Clip>
        </motion.div>
      )}

      {/* 패널티 로그 */}
      {(() => {
        const penaltyDays = Object.entries(state.dailyLog)
          .filter(([,v]) => v.penaltyApplied && v.xpPenalty < 0)
          .sort(([a],[b]) => b.localeCompare(a))
          .slice(0, 3);
        if (!penaltyDays.length) return null;
        return (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}>
            <SecLabel>⚠ 피부 악화 패널티 로그</SecLabel>
            <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
              {penaltyDays.map(([dateKey, log]) => (
                <Clip key={dateKey} cut={6} style={{ border:`1px solid ${C.red}44`, background:`${C.red}08`, padding:"9px 12px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                    <span style={{ fontSize:10, color:C.textMuted }}>{dateKey}</span>
                    <span style={{ fontSize:10, fontWeight:900, color:C.red }}>XP {log.xpPenalty}</span>
                  </div>
                  <div style={{ fontSize:9, color:C.textMuted }}>
                    완료율 {Math.round((log.completionRate||0)*100)}% — {log.penaltyLog?.join(", ")}
                  </div>
                  <div style={{ marginTop:6 }}>
                    <GlowBar value={Math.round((log.completionRate||0)*100)} max={100} color={C.red} h={4} anim={false}/>
                  </div>
                </Clip>
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* Scan history */}
      {state.scanHistory.length>0&&(<>
        <SecLabel>◈ 스캔 히스토리</SecLabel>
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
          {state.scanHistory.slice(0,5).map((scan,i)=>(
            <Clip key={scan.id} cut={6} style={{ border:`1px solid ${C.border}`, background:C.bgCard, padding:"8px 12px", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:C.textMuted }}>#{state.scanHistory.length-i} — {formatDate(new Date(scan.date))}</div>
                {scan.source && <div style={{ fontSize:8, color:C.textFaint, marginTop:1 }}>via {scan.source.toUpperCase()}</div>}
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:900, fontSize:13, color:scan.hp<50?C.red:scan.hp<70?C.yellow:C.green }}>{scan.hp} HP</div>
              </div>
            </Clip>
          ))}
        </div>
      </>)}

      {/* Settings */}
      <SecLabel>⚙ SYSTEM CONFIGURATION</SecLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {settings.map((s,i)=>(
          <motion.div key={s.id} initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.07 }}>
            <Clip cut={8} style={{ border:`1px solid ${C.border}`, background:C.bgCard }}>
              <motion.button whileTap={{ scale:0.98 }} onClick={()=>toggle(s.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.textPrimary }}>{s.label}</div>
                  <div style={{ fontSize:10, color:C.textMuted, marginTop:3 }}>{s.sub}</div>
                </div>
                <div style={{ width:44, height:23, flexShrink:0, position:"relative", border:`1px solid ${s.on?C.blue:C.border}`, background:s.on?"#001C2E":"transparent", clipPath:"polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))", transition:"border-color 0.2s,background 0.2s" }}>
                  <motion.div animate={{ x:s.on?22:3 }} transition={{ type:"spring", stiffness:420, damping:30 }} style={{ position:"absolute", top:3, width:15, height:15, border:`1.5px solid ${s.on?C.blue:C.borderHi}`, background:s.on?C.blue:"transparent", transition:"background 0.2s" }}/>
                </div>
              </motion.button>
            </Clip>
          </motion.div>
        ))}
      </div>
      {/* 로그아웃 */}
      <motion.button whileTap={{ scale:0.97 }} onClick={() => { SFX.tap(); haptic([8]); logout?.(); }}
        style={{ width:"100%", padding:"12px 0", fontFamily:C.mono, fontWeight:700, fontSize:12, letterSpacing:"0.15em",
          color:C.red, background:"transparent", border:`1px solid ${C.red}44`, cursor:"pointer", marginBottom:6,
          clipPath:"polygon(8px 0%,calc(100% - 8px) 0%,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0% calc(100% - 8px),0% 8px)" }}>
        ◀ LOGOUT // {user?.provider?.toUpperCase()}
      </motion.button>

      <div style={{ textAlign:"center", padding:"8px 0 8px", fontSize:8, color:C.textFaint, letterSpacing:"0.15em" }}>ARMORY TACTICAL v6.0 // XP SYSTEM</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CART DRAWER
// ══════════════════════════════════════════════════════════════════
function CartDrawer({ onClose }) {
  const C = useC();
  const { state, dispatch } = useApp();
  const items=PRODUCTS.filter(p=>state.cart.includes(p.id));
  const total=items.reduce((s,p)=>s+parseInt(p.price.replace(/[^0-9]/g,"")),0);
  return (
    <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }} transition={{ type:"spring", stiffness:320, damping:34 }}
      style={{ position:"absolute", bottom:0, left:0, right:0, zIndex:100, background:C.bgCard, borderTop:`2px solid ${C.blue}`, clipPath:"polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)", maxHeight:"70vh", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"16px 16px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div><div style={{ fontFamily:C.mono, fontWeight:900, fontSize:14, color:C.textPrimary }}>◈ AMMO LOADOUT</div><div style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted, marginTop:2 }}>{items.length}종</div></div>
        <motion.button whileTap={{ scale:0.9 }} onClick={onClose} style={{ background:"none", border:`1px solid ${C.border}`, color:C.textMuted, fontFamily:C.mono, fontSize:10, padding:"4px 10px", cursor:"pointer" }}>CLOSE ✕</motion.button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"10px 14px" }}>
        {items.length===0?(<div style={{ textAlign:"center", padding:"28px 0", fontFamily:C.mono, fontSize:11, color:C.textMuted }}><div style={{ fontSize:24, marginBottom:8, opacity:0.4 }}>◈</div>장바구니가 비어 있습니다.</div>)
        :items.map(p=>(
          <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
            <Clip cut={6} style={{ width:40, height:40, background:C.bgCardHi, border:`1px solid ${C.borderHi}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><span style={{ color:C.blue, fontSize:18 }}>{p.icon}</span></Clip>
            <div style={{ flex:1 }}><div style={{ fontFamily:C.mono, fontWeight:700, fontSize:11, color:C.textPrimary }}>{p.name}</div><div style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted }}>{p.unit}</div></div>
            <div style={{ textAlign:"right" }}><div style={{ fontFamily:C.mono, fontWeight:900, fontSize:13, color:C.blue }}>{p.price}</div><button onClick={()=>dispatch({ type:"REMOVE_FROM_CART", id:p.id })} style={{ background:"none", border:"none", color:C.red, fontFamily:C.mono, fontSize:8, cursor:"pointer" }}>REMOVE</button></div>
          </div>
        ))}
      </div>
      {items.length>0&&(<div style={{ padding:"12px 14px 16px", borderTop:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontFamily:C.mono, fontSize:10, color:C.textMuted }}>총 전술 비용</span>
          <span style={{ fontFamily:C.mono, fontWeight:900, fontSize:16, color:C.blue }}>₩{total.toLocaleString()}</span>
        </div>
        <motion.button whileTap={{ scale:0.97 }} style={{ width:"100%", padding:"14px 0", fontFamily:C.mono, fontWeight:900, fontSize:13, letterSpacing:"0.25em", color:C.bg, background:`linear-gradient(135deg,${C.blue},#0090CC)`, border:"none", cursor:"pointer", clipPath:"polygon(8px 0%,calc(100% - 8px) 0%,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0% calc(100% - 8px),0% 8px)" }}>◆ DEPLOY ORDER</motion.button>
      </div>)}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB: 피부 분석 대시보드 (DASHBOARD)
// ══════════════════════════════════════════════════════════════════
function DashboardTab() {
  const C = useC();
  const { state } = useApp();
  const { metrics, hp, scanHistory } = state;
  const lvInfo = getLevelInfo(state.xp);

  // 게이지 각도 계산 (반원 계기판)
  function gaugeAngle(v, max=100) { return -135 + (v/max)*270; }

  function GaugeArc({ value, max=100, color, size=80 }) {
    const pct = value/max;
    const r = size/2 - 8;
    const cx = size/2, cy = size/2;
    const startAngle = -225 * Math.PI/180;
    const endAngle = (startAngle + pct * 270 * Math.PI/180);
    const x1 = cx + r*Math.cos(startAngle), y1 = cy + r*Math.sin(startAngle);
    const x2 = cx + r*Math.cos(endAngle),   y2 = cy + r*Math.sin(endAngle);
    const large = pct*270 > 180 ? 1 : 0;
    // bg arc
    const bx2 = cx + r*Math.cos((-225+270)*Math.PI/180);
    const by2 = cy + r*Math.sin((-225+270)*Math.PI/180);
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${bx2} ${by2}`}
          fill="none" stroke={C.border} strokeWidth="5" strokeLinecap="round"/>
        {pct > 0 && <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"/>}
        <text x={cx} y={cy+5} textAnchor="middle" fontSize="13" fontWeight="900"
          fill={color} fontFamily="monospace">{value}</text>
        <text x={cx} y={cy+16} textAnchor="middle" fontSize="6"
          fill={C.textMuted} fontFamily="monospace">/ {max}</text>
      </svg>
    );
  }

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px", fontFamily:C.mono }}>

      {/* 오늘 날짜 + HP 헤더 */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}>
        <Clip cut={12} style={{ border:`1px solid ${lvInfo.color}44`, background:C.bgCard, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:8, color:C.textMuted, letterSpacing:"0.15em" }}>◈ 오늘의 피부 상태</div>
              <div style={{ fontSize:12, fontWeight:900, color:C.textPrimary, marginTop:3 }}><LiveDateLabel /></div>
            </div>
            <div style={{ textAlign:"right" }}>
              <motion.div key={hp} animate={{ color:hp<50?C.red:hp<70?C.yellow:C.green }}
                style={{ fontSize:28, fontWeight:900, lineHeight:1 }}>{hp}</motion.div>
              <div style={{ fontSize:9, color:C.textMuted }}>HP</div>
            </div>
          </div>
          <div style={{ marginTop:10 }}>
            <GlowBar value={hp} max={100} color={hp<50?C.red:hp<70?C.yellow:C.green} h={8} anim={false}/>
          </div>
        </Clip>
      </motion.div>

      {/* 4-gauge 계기판 */}
      <SecLabel>◉ SKIN GAUGES // 실시간</SecLabel>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
        {metrics.map((m,i) => (
          <motion.div key={m.id} initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:i*0.08 }}>
            <Clip cut={8} style={{ border:`1px solid ${m.color}44`, background:C.bgCard, padding:"12px 8px", textAlign:"center" }}>
              <GaugeArc value={m.value} max={100} color={m.color} size={90}/>
              <div style={{ fontSize:11, fontWeight:900, color:m.color, marginTop:4 }}>{m.label}</div>
              <div style={{ fontSize:8, color:C.textMuted, marginTop:2 }}>{m.en} // {m.status}</div>
              <div style={{ marginTop:6 }}>
                <GlowBar value={m.value} max={100} color={m.color} h={3} anim={false}/>
              </div>
            </Clip>
          </motion.div>
        ))}
      </div>

      {/* 7일 HP 추이 그래프 */}
      <SecLabel>◈ HP HISTORY // 최근 스캔</SecLabel>
      <Clip cut={10} style={{ border:`1px solid ${C.border}`, background:C.bgCard, padding:14, marginBottom:14 }}>
        {scanHistory.length === 0 ? (
          <div style={{ textAlign:"center", padding:"16px 0", fontSize:10, color:C.textMuted }}>
            스캔 기록이 없습니다. SCAN 탭에서 시작하세요.
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80, paddingBottom:4 }}>
            {[...scanHistory].reverse().slice(0,8).map((s,i) => {
              const pct = s.hp/100;
              const col = s.hp<50?C.red:s.hp<70?C.yellow:C.green;
              return (
                <div key={s.id} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{ fontSize:7, color:col, fontWeight:900 }}>{s.hp}</div>
                  <motion.div initial={{ height:0 }} animate={{ height:`${pct*60}px` }} transition={{ delay:i*0.06, duration:0.7, ease:[0.16,1,0.3,1] }}
                    style={{ width:"100%", background:`linear-gradient(to top,${col}44,${col})`, minHeight:2 }}/>
                  <div style={{ fontSize:6, color:C.textFaint }}>
                    {new Date(s.date).toLocaleDateString("ko",{month:"2-digit",day:"2-digit"})}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Clip>

      {/* 위협 분석 요약 */}
      <SecLabel>⚠ THREAT ANALYSIS</SecLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {metrics.map(m => {
          const threatColor = m.value>=80?C.green:m.value>=60?C.blue:m.value>=40?C.yellow:C.red;
          const threatLabel = m.value>=80?"OPTIMAL":m.value>=60?"MODERATE":m.value>=40?"WARNING":"CRITICAL";
          const advice = {
            moisture:"수분 보충 세럼 즉시 투입 권장",
            sebum:"피지 억제 토너로 T존 집중 관리",
            sensitivity:"저자극 보습제로 방어막 강화",
            barrier:"세라마이드 성분 크림 야간 적용",
          }[m.id] || "";
          return (
            <Clip key={m.id} cut={7} style={{ border:`1px solid ${threatColor}33`, background:C.bgCard, padding:"10px 12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:m.value<60?6:0 }}>
                <div style={{ width:28, height:28, border:`1px solid ${threatColor}66`, background:`${threatColor}11`,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                  {m.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:900, color:C.textPrimary }}>{m.label} // {m.en}</div>
                  <div style={{ fontSize:8, color:C.textMuted, marginTop:1 }}>현재 {m.value}% — {m.status}</div>
                </div>
                <Clip cut={4} style={{ padding:"3px 8px", border:`1px solid ${threatColor}55`, background:`${threatColor}11` }}>
                  <span style={{ fontSize:8, fontWeight:900, color:threatColor }}>{threatLabel}</span>
                </Clip>
              </div>
              {m.value < 60 && <div style={{ fontSize:9, color:C.textMuted, marginTop:4, paddingLeft:38 }}>▶ {advice}</div>}
            </Clip>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB: 제품 상세 (ARSENAL)
// ══════════════════════════════════════════════════════════════════
function ArsenalTab() {
  const C = useC();
  const [selected, setSelected] = useState(null);
  const { state, dispatch } = useApp();

  const handleAdd = (id) => { SFX.add(); haptic([10,50,10]); dispatch({ type:"ADD_TO_CART", id }); };

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px", fontFamily:C.mono }}>
      <SecLabel>◆ WEAPON ARSENAL // 무기 제원표</SecLabel>

      {PRODUCTS.map((p, i) => {
        const metric = state.metrics.find(m=>m.id===p.metricId);
        const isOpen = selected === p.id;
        const inCart = state.cart.includes(p.id);

        return (
          <motion.div key={p.id} initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.08 }}
            style={{ marginBottom:10 }}>
            <Clip cut={12} style={{ border:`1px solid ${isOpen?`${C.blue}77`:C.border}`, background: isOpen?C.bgCardHi:C.bgCard,
              boxShadow: isOpen?`0 0 20px ${C.blue}11`:"none" }}>

              {/* Header row */}
              <motion.button whileTap={{ scale:0.99 }} onClick={()=>{ SFX.tap(); setSelected(isOpen?null:p.id); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                <Clip cut={6} style={{ width:48, height:48, border:`1px solid ${C.blue}55`, background:`${C.blue}11`,
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:22, color:C.blue }}>
                  {p.icon}
                </Clip>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:8, color:C.textMuted, letterSpacing:"0.12em" }}>{p.unit}</div>
                  <div style={{ fontSize:13, fontWeight:900, color:C.textPrimary, marginTop:2 }}>{p.name}</div>
                  <div style={{ fontSize:9, color:C.blueText, marginTop:1 }}>{p.tagline}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:15, fontWeight:900, color:C.blue }}>{p.price}</div>
                  <div style={{ fontSize:8, color:p.stock<5?C.red:C.green, marginTop:2 }}>
                    {p.stock<5?"⚠ 품절임박":"재고있음"} {p.stock}개
                  </div>
                </div>
              </motion.button>

              {/* 펼쳐지는 제원표 */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                    exit={{ height:0, opacity:0 }} transition={{ duration:0.22 }}
                    style={{ overflow:"hidden" }}>
                    <div style={{ padding:"0 14px 14px" }}>
                      {/* 피부 연관 수치 */}
                      {metric && (
                        <div style={{ marginBottom:12, padding:"8px 10px", border:`1px solid ${metric.color}44`, background:`${metric.color}08`,
                          clipPath:"polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))" }}>
                          <div style={{ fontSize:8, color:C.textMuted, marginBottom:4 }}>현재 {metric.label} 수치 — 이 무기로 개선 가능</div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:18, fontWeight:900, color:metric.color }}>{metric.value}%</span>
                            <div style={{ flex:1 }}><GlowBar value={metric.value} max={100} color={metric.color} h={5} anim={false}/></div>
                            <span style={{ fontSize:9, color:metric.color, fontWeight:700 }}>{metric.status}</span>
                          </div>
                        </div>
                      )}

                      {/* 스펙 그리드 */}
                      <div style={{ fontSize:8, color:C.textMuted, letterSpacing:"0.15em", marginBottom:6 }}>◆ 무기 제원</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 12px", marginBottom:12 }}>
                        {p.specs.map(([k,v])=>(
                          <div key={k} style={{ display:"flex", justifyContent:"space-between", borderBottom:`1px solid ${C.border}`, paddingBottom:5 }}>
                            <span style={{ fontSize:9, color:C.textMuted }}>{k}</span>
                            <span style={{ fontSize:9, fontWeight:900, color:C.blueText }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* ADD TO KIT */}
                      <motion.button whileTap={{ scale:0.97 }} onClick={()=>handleAdd(p.id)}
                        style={{ width:"100%", padding:"12px 0", fontFamily:C.mono, fontWeight:900, fontSize:12,
                          letterSpacing:"0.25em", color:inCart?C.green:C.blue,
                          background:inCart?`${C.green}0D`:`linear-gradient(135deg,${C.bgCard},${C.bgCardHi})`,
                          border:`2px solid ${inCart?`${C.green}88`:C.blue}`, cursor:"pointer",
                          clipPath:"polygon(8px 0%,calc(100% - 8px) 0%,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0% calc(100% - 8px),0% 8px)",
                          position:"relative", overflow:"hidden" }}>
                        {!inCart&&<motion.div animate={{ x:["-100%","200%"] }} transition={{ duration:2.8, repeat:Infinity, ease:"linear" }}
                          style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${C.blue}18,transparent)`, pointerEvents:"none" }}/>}
                        {inCart?"✓ ADDED TO KIT":"[ ADD TO KIT ]"}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Clip>
          </motion.div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB: 랭킹 / 리더보드 (RANKING)
// ══════════════════════════════════════════════════════════════════
function RankingTab() {
  const C = useC();
  const { state, user } = useApp();
  const myLv = getLevelInfo(state.xp);
  const myHP = state.hp;
  const [filter, setFilter] = useState("xp"); // xp | hp | streak

  const sorted = [...MOCK_RANKING].sort((a,b) => {
    if (filter==="hp") return b.hp - a.hp;
    if (filter==="streak") return b.streak - a.streak;
    return b.xp - a.xp;
  });

  // 내 순위 추가 (목데이터에 없으면 마지막에 추가)
  const myEntry = { rank:99, name:user?.name||"ME", lv:myLv.lv, xp:state.xp, hp:myHP, streak:state.streak, badge:"◉", badgeColor:C.blue, isMe:true };
  const myRank = sorted.findIndex(r=>r.name===myEntry.name);

  const rankColor = (rank) => {
    if (rank===1) return C.gold;
    if (rank===2) return C.silver;
    if (rank===3) return C.bronze;
    return C.textMuted;
  };
  const rankIcon = (rank) => rank===1?"◆":rank===2?"◈":rank===3?"◉":"·";

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px", fontFamily:C.mono }}>

      {/* 내 순위 카드 */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}>
        <Clip cut={10} style={{ border:`1px solid ${C.blue}55`, background:C.bgCardHi, padding:"12px 14px", marginBottom:14, boxShadow:`0 0 20px ${C.blue}11` }}>
          <div style={{ fontSize:8, color:C.blueSub, letterSpacing:"0.15em", marginBottom:6 }}>◈ 내 현재 순위</div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:28, fontWeight:900, color:C.blue, width:36, textAlign:"center" }}>
              {myRank>=0 ? myRank+1 : "—"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:900, color:C.textPrimary }}>{user?.name||"OPERATOR"}</div>
              <div style={{ fontSize:9, color:myLv.color, marginTop:1 }}>LV.{myLv.lv} {myLv.name}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:14, fontWeight:900, color:C.gold }}>{state.xp} XP</div>
              <div style={{ fontSize:9, color:C.textMuted }}>HP {myHP} · {state.streak}일 연속</div>
            </div>
          </div>
          <div style={{ marginTop:8 }}>
            <GlowBar value={xpProgress(state.xp)} max={100} color={myLv.color} h={4} anim={false}/>
          </div>
        </Clip>
      </motion.div>

      {/* 필터 탭 */}
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {[["xp","XP 순"],["hp","HP 순"],["streak","스트릭"]].map(([key,label])=>(
          <motion.button key={key} whileTap={{ scale:0.94 }} onClick={()=>{ SFX.tap(); setFilter(key); }}
            style={{ flex:1, padding:"7px 0", fontFamily:C.mono, fontSize:9, fontWeight:900,
              letterSpacing:"0.1em", cursor:"pointer",
              color:filter===key?C.bg:C.textMuted,
              background:filter===key?C.blue:"transparent",
              border:`1px solid ${filter===key?C.blue:C.border}`,
              clipPath:"polygon(5px 0%,calc(100% - 5px) 0%,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0% calc(100% - 5px),0% 5px)" }}>
            {label}
          </motion.button>
        ))}
      </div>

      <SecLabel>◆ GLOBAL RANKING</SecLabel>

      {/* 랭킹 리스트 */}
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {sorted.map((entry, i) => {
          const isTop3 = entry.rank <= 3;
          const col = rankColor(entry.rank);
          return (
            <motion.div key={entry.rank} initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.04 }}>
              <Clip cut={isTop3?10:7} style={{
                border:`1px solid ${isTop3?`${col}55`:C.border}`,
                background:isTop3?`${col}08`:C.bgCard,
                padding:isTop3?"11px 12px":"9px 12px",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  {/* Rank */}
                  <div style={{ width:28, textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:isTop3?16:12, fontWeight:900, color:col }}>{rankIcon(entry.rank)}</div>
                    <div style={{ fontSize:7, color:col, fontWeight:700 }}>#{entry.rank}</div>
                  </div>
                  {/* Badge */}
                  <div style={{ width:30, height:30, border:`1px solid ${entry.badgeColor}55`, background:`${entry.badgeColor}11`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:entry.badgeColor, flexShrink:0 }}>
                    {entry.badge}
                  </div>
                  {/* Name + level */}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:isTop3?13:11, fontWeight:900, color:C.textPrimary }}>{entry.name}</div>
                    <div style={{ fontSize:8, color:C.textMuted, marginTop:1 }}>LV.{entry.lv} · {entry.streak}일 스트릭</div>
                  </div>
                  {/* Score */}
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:900, color:filter==="hp"?entry.hp<50?C.red:entry.hp<70?C.yellow:C.green:filter==="streak"?C.orange:C.gold }}>
                      {filter==="xp"?`${entry.xp}XP`:filter==="hp"?`${entry.hp}HP`:`${entry.streak}일`}
                    </div>
                    <div style={{ fontSize:7, color:C.textFaint }}>HP {entry.hp}</div>
                  </div>
                </div>
              </Clip>
            </motion.div>
          );
        })}
      </div>

      <div style={{ textAlign:"center", padding:"16px 0 6px", fontSize:8, color:C.textFaint, letterSpacing:"0.1em" }}>
        * 랭킹은 실시간 서버 연동 시 업데이트됩니다
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB: 프로필 / 오퍼레이터 카드 (PROFILE)  — BASE 탭 강화 버전
// ══════════════════════════════════════════════════════════════════
function ProfileTab() {
  const C = useC();
  const { state, user, logout } = useApp();
  const [settings, setSettings] = useState([
    {id:"notif", label:"작전 알림",   sub:"루틴 시간 푸시 알림",  on:true },
    {id:"haptic",label:"햅틱 피드백", sub:"버튼 터치 진동",       on:true },
    {id:"sound", label:"전술 사운드", sub:"UI 클릭 사운드",       on:true },
    {id:"night", label:"야간 모드",   sub:"저조도 자동 전환",     on:false},
  ]);
  const toggle=(id)=>{ SFX.tap(); haptic([6]); setSettings(s=>s.map(x=>x.id===id?{...x,on:!x.on}:x)); };
  const lvInfo = getLevelInfo(state.xp);
  const nextLv = getNextLevel(state.xp);
  const pct = xpProgress(state.xp);

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px", fontFamily:C.mono }}>

      {/* ── 오퍼레이터 ID 카드 (강화) */}
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}>
        <Clip cut={14} style={{ border:`2px solid ${lvInfo.color}55`, background:C.bgCard, padding:"18px 16px", marginBottom:14, position:"relative", overflow:"hidden" }}>
          {/* 배경 글로우 */}
          <div style={{ position:"absolute", top:-40, right:-40, width:120, height:120, borderRadius:"50%",
            background:`radial-gradient(circle, ${lvInfo.color}18 0%, transparent 70%)`, pointerEvents:"none" }}/>

          {/* 상단 배지 */}
          <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:14 }}>
            <div style={{ fontSize:7, letterSpacing:"0.2em", color:lvInfo.color }}>◈ OPERATOR ID CARD</div>
            <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${lvInfo.color}44,transparent)` }}/>
            <div style={{ fontSize:7, color:C.textFaint }}>{user?.provider?.toUpperCase()||"LOCAL"}</div>
          </div>

          {/* 아바타 + 정보 */}
          <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:16 }}>
            {/* 아바타 */}
            <div style={{ position:"relative" }}>
              <Clip cut={10} style={{ width:64, height:64, border:`2px solid ${lvInfo.color}`,
                background:`${lvInfo.color}18`, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center" }}>
                {user?.avatar
                  ? <img src={user.avatar} width={64} height={64} style={{ objectFit:"cover" }} alt="avatar"/>
                  : <>
                      <div style={{ fontWeight:900, fontSize:22, color:lvInfo.color, lineHeight:1 }}>{lvInfo.lv}</div>
                      <div style={{ fontSize:7, color:`${lvInfo.color}88` }}>LV</div>
                    </>
                }
              </Clip>
              <motion.div animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:2, repeat:Infinity }}
                style={{ position:"absolute", inset:-3, border:`1px solid ${lvInfo.color}44`,
                  clipPath:"polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)" }}/>
            </div>

            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900, fontSize:17, color:C.textPrimary }}>{user?.name||"OPERATOR"}</div>
              <div style={{ fontSize:9, color:C.textMuted, marginTop:1 }}>{user?.email||""}</div>
              <div style={{ fontSize:10, color:lvInfo.color, marginTop:4, fontWeight:700, letterSpacing:"0.08em" }}>
                {lvInfo.name}
              </div>
              <div style={{ fontSize:8, color:C.textMuted, marginTop:1 }}>CLEARANCE LEVEL {lvInfo.lv}</div>
            </div>
          </div>

          {/* XP 진행바 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:8, color:C.textMuted }}>XP {state.xp.toLocaleString()} / {nextLv.maxXP.toLocaleString()}</span>
              <span style={{ fontSize:8, color:lvInfo.color, fontWeight:900 }}>NEXT: LV.{nextLv.lv} — {Math.round(pct)}%</span>
            </div>
            <GlowBar value={state.xp} max={nextLv.maxXP} color={lvInfo.color} h={8} anim={false}/>
          </div>

          {/* 스탯 4종 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
            {[
              ["HP",`${state.hp}`,state.hp<50?C.red:state.hp<70?C.yellow:C.green],
              ["XP",state.xp.toLocaleString(),C.gold],
              ["STREAK",`${state.streak}일`,C.orange],
              ["SCAN",`${state.scanHistory.length}회`,C.blue],
            ].map(([k,v,col])=>(
              <Clip key={k} cut={4} style={{ padding:"7px 3px", border:`1px solid ${C.border}`, textAlign:"center" }}>
                <motion.div key={v} initial={{ scale:1.15, opacity:0.6 }} animate={{ scale:1, opacity:1 }}
                  style={{ fontSize:13, fontWeight:900, color:col }}>{v}</motion.div>
                <div style={{ fontSize:7, color:C.textMuted, marginTop:2 }}>{k}</div>
              </Clip>
            ))}
          </div>

          {/* 현재 레벨 특전 */}
          <div style={{ marginTop:12, padding:"8px 10px", border:`1px solid ${lvInfo.color}44`, background:`${lvInfo.color}08`,
            clipPath:"polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))" }}>
            <div style={{ fontSize:8, color:`${lvInfo.color}99`, letterSpacing:"0.12em" }}>현재 레벨 특전</div>
            <div style={{ fontSize:11, color:lvInfo.color, marginTop:3, fontWeight:700 }}>{lvInfo.perk}</div>
          </div>
        </Clip>
      </motion.div>

      {/* 레벨 트리 */}
      <SecLabel>◆ OPERATOR LEVEL TREE</SecLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:14 }}>
        {LEVELS.map((lv,i)=>{
          const isCur=lv.lv===lvInfo.lv, isUnlocked=state.xp>=lv.minXP;
          return (
            <motion.div key={lv.lv} initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.03 }}>
              <Clip cut={7} style={{ border:`1px solid ${isCur?`${lv.color}88`:isUnlocked?`${lv.color}33`:C.border}`,
                background:isCur?`${lv.color}12`:isUnlocked?`${lv.color}05`:C.bgStrip, padding:"8px 12px",
                display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                  border:`1.5px solid ${isUnlocked?lv.color:C.border}`, background:isUnlocked?`${lv.color}18`:"transparent" }}>
                  <span style={{ fontFamily:C.mono, fontWeight:900, fontSize:11, color:isUnlocked?lv.color:C.textFaint }}>{lv.lv}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:C.mono, fontWeight:700, fontSize:11, color:isUnlocked?C.textPrimary:C.textFaint }}>{lv.name}</div>
                  <div style={{ fontFamily:C.mono, fontSize:9, color:isUnlocked?C.textMuted:C.textFaint, marginTop:1 }}>{lv.perk}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  {isCur&&<div style={{ fontFamily:C.mono, fontSize:8, fontWeight:900, color:lv.color }}>◀ NOW</div>}
                  {isUnlocked&&!isCur&&<div style={{ fontSize:10, color:C.green }}>✓</div>}
                  {!isUnlocked&&<div style={{ fontFamily:C.mono, fontSize:8, color:C.textFaint }}>{lv.minXP}XP</div>}
                </div>
              </Clip>
            </motion.div>
          );
        })}
      </div>

      {/* 스캔 히스토리 */}
      {state.scanHistory.length>0&&(<>
        <SecLabel>◈ 스캔 히스토리</SecLabel>
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
          {state.scanHistory.slice(0,5).map((scan,i)=>(
            <Clip key={scan.id} cut={6} style={{ border:`1px solid ${C.border}`, background:C.bgCard, padding:"8px 12px", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1 }}><div style={{ fontSize:10, color:C.textMuted }}>#{state.scanHistory.length-i} — {formatDate(new Date(scan.date))}</div></div>
              <div style={{ fontWeight:900, fontSize:13, color:scan.hp<50?C.red:scan.hp<70?C.yellow:C.green }}>{scan.hp} HP</div>
            </Clip>
          ))}
        </div>
      </>)}

      {/* 설정 */}
      <SecLabel>⚙ SYSTEM CONFIGURATION</SecLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {settings.map((s,i)=>(
          <motion.div key={s.id} initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.07 }}>
            <Clip cut={8} style={{ border:`1px solid ${C.border}`, background:C.bgCard }}>
              <motion.button whileTap={{ scale:0.98 }} onClick={()=>toggle(s.id)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.textPrimary }}>{s.label}</div>
                  <div style={{ fontSize:10, color:C.textMuted, marginTop:3 }}>{s.sub}</div>
                </div>
                <div style={{ width:44, height:23, flexShrink:0, position:"relative",
                  border:`1px solid ${s.on?C.blue:C.border}`, background:s.on?"#001C2E":"transparent",
                  clipPath:"polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,5px 100%,0 calc(100% - 5px))", transition:"border-color 0.2s,background 0.2s" }}>
                  <motion.div animate={{ x:s.on?22:3 }} transition={{ type:"spring", stiffness:420, damping:30 }}
                    style={{ position:"absolute", top:3, width:15, height:15, border:`1.5px solid ${s.on?C.blue:C.borderHi}`, background:s.on?C.blue:"transparent", transition:"background 0.2s" }}/>
                </div>
              </motion.button>
            </Clip>
          </motion.div>
        ))}
      </div>

      {/* 로그아웃 */}
      <motion.button whileTap={{ scale:0.97 }} onClick={()=>{ SFX.tap(); haptic([8]); logout?.(); }}
        style={{ width:"100%", padding:"12px 0", fontFamily:C.mono, fontWeight:700, fontSize:12, letterSpacing:"0.15em",
          color:C.red, background:"transparent", border:`1px solid ${C.red}44`, cursor:"pointer", marginTop:10, marginBottom:6,
          clipPath:"polygon(8px 0%,calc(100% - 8px) 0%,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0% calc(100% - 8px),0% 8px)" }}>
        ◀ LOGOUT // {user?.provider?.toUpperCase()||"—"}
      </motion.button>

      <div style={{ textAlign:"center", padding:"8px 0", fontSize:8, color:C.textFaint, letterSpacing:"0.15em" }}>
        ARMORY TACTICAL v6.0 // XP SYSTEM
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// BOTTOM NAV
// ══════════════════════════════════════════════════════════════════
function ScanSVG({active}){const c=active?C.blue:C.textFaint;return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="1" y="1" width="7" height="7" stroke={c} strokeWidth="1.5"/><rect x="16" y="1" width="7" height="7" stroke={c} strokeWidth="1.5"/><rect x="1" y="16" width="7" height="7" stroke={c} strokeWidth="1.5"/><rect x="16" y="16" width="7" height="7" stroke={c} strokeWidth="1.5"/><circle cx="12" cy="12" r="3.5" stroke={c} strokeWidth="1.5"/><line x1="12" y1="1" x2="12" y2="8" stroke={c} strokeWidth="1"/><line x1="12" y1="16" x2="12" y2="23" stroke={c} strokeWidth="1"/><line x1="1" y1="12" x2="8" y2="12" stroke={c} strokeWidth="1"/><line x1="16" y1="12" x2="23" y2="12" stroke={c} strokeWidth="1"/></svg>);}
  const C = useC();
function LoadoutSVG({active}){const c=active?C.blue:C.textFaint;return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polygon points="12,1 23,7 23,17 12,23 1,17 1,7" stroke={c} strokeWidth="1.5"/><polygon points="12,5 19,9 19,15 12,19 5,15 5,9" stroke={c} strokeWidth="1"/><rect x="9.5" y="9.5" width="5" height="5" stroke={c} strokeWidth="1" fill={active?`${C.blue}33`:"none"}/></svg>);}
  const C = useC();
function BaseSVG({active}){const c=active?C.blue:C.textFaint;return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="1" y="13" width="22" height="10" stroke={c} strokeWidth="1.5"/><polyline points="1,13 12,2 23,13" stroke={c} strokeWidth="1.5"/><rect x="9" y="16" width="6" height="7" stroke={c} strokeWidth="1"/><line x1="9" y1="19.5" x2="15" y2="19.5" stroke={c} strokeWidth="0.8"/></svg>);}
  const C = useC();

// SVG icons for new tabs
function DashSVG({active}){const c=active?C.blue:C.textFaint;return(<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.5"/><path d="M12 12 L7 8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><line x1="12" y1="12" x2="15" y2="9" stroke={c} strokeWidth="1.2" strokeLinecap="round"/><circle cx="12" cy="12" r="1.5" fill={c}/><path d="M5 17 Q8.5 13 12 12 Q15.5 11 19 12" stroke={c} strokeWidth="1" fill="none" opacity="0.5"/></svg>);}
  const C = useC();
function ArsenalSVG({active}){const c=active?C.blue:C.textFaint;return(<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="8" width="14" height="9" rx="1" stroke={c} strokeWidth="1.5"/><path d="M3 10 Q10 6 17 10" stroke={c} strokeWidth="1.3" fill="none"/><rect x="17" y="10" width="4" height="5" rx="0.5" stroke={c} strokeWidth="1"/><line x1="6" y1="11.5" x2="6" y2="14.5" stroke={c} strokeWidth="1" opacity="0.7"/><line x1="9" y1="11.5" x2="9" y2="14.5" stroke={c} strokeWidth="1" opacity="0.7"/><line x1="12" y1="11.5" x2="12" y2="14.5" stroke={c} strokeWidth="1" opacity="0.7"/><rect x="6" y="17" width="5" height="2" rx="0.5" stroke={c} strokeWidth="1"/></svg>);}
  const C = useC();
function RankSVG({active}){const c=active?C.blue:C.textFaint;return(<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="20" rx="1" stroke={c} strokeWidth="1.5"/><rect x="2" y="8" width="6" height="14" rx="1" stroke={c} strokeWidth="1.5"/><rect x="16" y="5" width="6" height="17" rx="1" stroke={c} strokeWidth="1.5"/><line x1="10" y1="5" x2="14" y2="5" stroke={c} strokeWidth="0.8"/></svg>);}
  const C = useC();
function ProfileSVG({active}){const c=active?C.blue:C.textFaint;return(<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.5"/><path d="M4 20 C4 16 7.6 13 12 13 C16.4 13 20 16 20 20" stroke={c} strokeWidth="1.5" fill="none"/><polygon points="12,1 15,6 21,7 17,11 18,17 12,14 6,17 7,11 3,7 9,6" stroke={c} strokeWidth="0.7" fill="none" opacity="0.4"/></svg>);}
  const C = useC();

function BottomNav({ active, onSelect }) {
  const C = useC();
  // SCAN은 중앙 고정, 나머지 4탭이 양옆에 2개씩
  const leftTabs  = [{id:"dashboard",label:"DASH",   Icon:DashSVG   },{id:"arsenal",  label:"ARMS",   Icon:ArsenalSVG}];
  const rightTabs = [{id:"ranking",  label:"RANK",   Icon:RankSVG   },{id:"profile",  label:"PROFILE",Icon:ProfileSVG}];

  const NavBtn = ({id, label, Icon}) => {
    const isActive = active===id;
    return (
      <motion.button whileTap={{ scale:0.88 }} onClick={()=>{ SFX.nav(); haptic([8]); onSelect(id); }}
        style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 0 9px",
          background:"none", border:"none", cursor:"pointer", position:"relative" }}>
        {isActive&&<motion.div layoutId="nl" style={{ position:"absolute", top:0, left:"15%", right:"15%", height:2, background:C.blue, boxShadow:`0 0 10px ${C.blue}` }} transition={{ type:"spring", stiffness:400, damping:34 }}/>}
        <motion.div animate={{ scale:isActive?1.1:1 }} transition={{ type:"spring", stiffness:340 }}><Icon active={isActive}/></motion.div>
        <motion.span animate={{ color:isActive?C.blue:C.textFaint }} style={{ fontFamily:C.mono, fontSize:7, letterSpacing:"0.1em", marginTop:3 }}>{label}</motion.span>
      </motion.button>
    );
  };

  const isScanActive = active==="scan";
  return (
    <ThemeBottomNav active={active} onSelect={onSelect}/>
  );
}
function ThemeBottomNav({ active, onSelect }) {
  const { C:TC } = useTheme();
  const leftTabs  = [{id:"dashboard",label:"DASH",   Icon:DashSVG   },{id:"arsenal",  label:"ARMS",   Icon:ArsenalSVG}];
  const rightTabs = [{id:"ranking",  label:"RANK",   Icon:RankSVG   },{id:"profile",  label:"PROFILE",Icon:ProfileSVG}];
  const NavBtn = ({id, label, Icon}) => {
    const isActive = active===id;
    return (
      <motion.button whileTap={{ scale:0.88 }} onClick={()=>{ SFX.nav(); haptic([8]); onSelect(id); }}
        style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 0 9px",
          background:"none", border:"none", cursor:"pointer", position:"relative" }}>
        {isActive&&<motion.div layoutId="nl2" style={{ position:"absolute", top:0, left:"15%", right:"15%", height:2, background:C.blue, boxShadow:`0 0 10px ${C.blue}` }} transition={{ type:"spring", stiffness:400, damping:34 }}/>}
        <motion.div animate={{ scale:isActive?1.1:1 }} transition={{ type:"spring", stiffness:340 }}><Icon active={isActive} C={TC}/></motion.div>
        <motion.span animate={{ color:isActive?C.blue:C.textFaint }} style={{ fontFamily:C.mono, fontSize:7, letterSpacing:"0.1em", marginTop:3 }}>{label}</motion.span>
      </motion.button>
    );
  };
  const isScanActive = active==="scan";
  return (
    <motion.div animate={{ background:C.navBg, borderTopColor:C.border }}
      style={{ flexShrink:0, position:"relative", borderTop:`1px solid ${C.border}`,
        backdropFilter:"blur(20px)", paddingBottom:"env(safe-area-inset-bottom,6px)", zIndex:20 }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${C.blue}55,transparent)` }}/>
      <div style={{ display:"flex", alignItems:"flex-end" }}>
        {leftTabs.map(t=><NavBtn key={t.id} {...t}/>)}

        {/* SCAN — 중앙 돌출 버튼 */}
        <motion.button whileTap={{ scale:0.88 }} onClick={()=>{ SFX.nav(); haptic([8]); onSelect("scan"); }}
          style={{ flex:"1.3 1 0", display:"flex", flexDirection:"column", alignItems:"center",
            padding:"5px 0 9px", background:"none", border:"none", cursor:"pointer", position:"relative" }}>
          {isScanActive&&<motion.div layoutId="nl" style={{ position:"absolute", top:0, left:"15%", right:"15%", height:2, background:C.blue, boxShadow:`0 0 10px ${C.blue}` }} transition={{ type:"spring", stiffness:400, damping:34 }}/>}
          <div style={{ marginTop:-20, position:"relative" }}>
            {isScanActive&&<motion.div animate={{ scale:[1,1.3,1], opacity:[0.5,0,0.5] }} transition={{ duration:2.4, repeat:Infinity }}
              style={{ position:"absolute", inset:-4, border:`1px solid ${C.blue}`, clipPath:"polygon(12% 0%,88% 0%,100% 12%,100% 88%,88% 100%,12% 100%,0% 88%,0% 12%)" }}/>}
            <motion.div animate={{ boxShadow:isScanActive?`0 0 28px ${C.blue}77,0 0 8px ${C.blue}`:`0 0 10px ${C.blue}22` }}
              style={{ width:60, height:60, display:"flex", alignItems:"center", justifyContent:"center",
                border:`2px solid ${isScanActive?C.blue:C.border}`,
                background:isScanActive?`linear-gradient(135deg,#001F32,#002D48)`:C.bgCard,
                clipPath:"polygon(12% 0%,88% 0%,100% 12%,100% 88%,88% 100%,12% 100%,0% 88%,0% 12%)" }}>
              <ScanSVG active={isScanActive}/>
            </motion.div>
          </div>
          <motion.span animate={{ color:isScanActive?C.blue:C.textFaint }} style={{ fontFamily:C.mono, fontSize:7, letterSpacing:"0.1em", marginTop:4 }}>SCAN</motion.span>
        </motion.button>

        {rightTabs.map(t=><NavBtn key={t.id} {...t}/>)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════
const TAB_ORDER=["dashboard","arsenal","scan","ranking","profile"];
const TAB_PAGES={
  dashboard: DashboardTab,
  arsenal:   ArsenalTab,
  scan:      ScanTab,
  ranking:   RankingTab,
  profile:   ProfileTab,
};

// ══════════════════════════════════════════════════════════════════
// INNER APP (requires auth)
// ══════════════════════════════════════════════════════════════════
function ArmoryInner() {
  const { user, logout } = useAuth();
  const { C: TC, theme, toggleTheme } = useTheme();
  const [state, dispatch] = useReducer(reducer, INIT_STATE);
  const [tab, setTab] = useState("scan");
  const [prevTab, setPrevTab] = useState("scan");
  const [showWatch, setShowWatch] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const handleSelect=(id)=>{ setPrevTab(tab); setTab(id); };
  const tIdx = TAB_ORDER.indexOf(tab), pIdx = TAB_ORDER.indexOf(prevTab);
  const dir = tIdx > pIdx ? 1 : tIdx < pIdx ? -1 : 1;
  const Page=TAB_PAGES[tab]||ScanTab;

  const { theme, C:TC, toggleTheme } = useTheme();

  return (
    <AppCtx.Provider value={{ state, dispatch, user, logout, theme, C:TC, toggleTheme }}>
      <motion.div
        animate={{ background: C.bg }}
        transition={{ duration:0.35 }}
        style={{ height:"100dvh", maxWidth:430, margin:"0 auto",
          backgroundImage: theme==="dark"
            ? `radial-gradient(ellipse at 22% 0%,#001B2E 0%,transparent 55%),radial-gradient(ellipse at 85% 100%,#000E1A 0%,transparent 40%)`
            : `radial-gradient(ellipse at 22% 0%,#D8E8F4 0%,transparent 55%),radial-gradient(ellipse at 85% 100%,#EBF2F8 0%,transparent 40%)`,
          fontFamily:C.mono, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          backgroundImage:`linear-gradient(${C.gridColor} 1px,transparent 1px),linear-gradient(90deg,${C.gridColor} 1px,transparent 1px)`,
          backgroundSize:"30px 30px" }}/>
        {theme === "dark" && (
          <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:50, overflow:"hidden", opacity:0.02 }}>
            <motion.div animate={{ top:["0%","100%"] }} transition={{ duration:6, repeat:Infinity, ease:"linear" }} style={{ position:"absolute", left:0, right:0, height:2, background:"#fff" }}/>
          </div>
        )}

        {/* Background systems */}
        <DateWatcher/>
        <RoutineAlertEngine/>

        {/* Layers */}
        <ToastLayer/>

        <TopBar onWatchOpen={()=>{ setShowCart(false); setShowWatch(v=>!v); }} onCartOpen={()=>{ setShowWatch(false); setShowCart(v=>!v); }}/>

        <div style={{ flexShrink:0, display:"flex", gap:4, padding:"5px 14px 0" }}>
          {TAB_ORDER.map(t=>(
            <motion.div key={t} animate={{ flex:t===tab?1.8:1, background:t===tab?C.blue:C.border }} transition={{ type:"spring", stiffness:340, damping:30 }} style={{ height:3, borderRadius:1 }}/>
          ))}
        </div>

        <div style={{ flex:1, position:"relative", overflow:"hidden", marginTop:4 }}>
          <AnimatePresence mode="popLayout" custom={dir}>
            <motion.div key={tab} custom={dir}
              initial={{ x:`${dir*100}%`, opacity:0 }}
              animate={{ x:0, opacity:1, transition:{ type:"spring", stiffness:310, damping:32 } }}
              exit={{ x:`${dir*-60}%`, opacity:0, scale:0.97, transition:{ duration:0.18, ease:"easeIn" } }}
              style={{ position:"absolute", inset:0, willChange:"transform" }}>
              <Page/>
            </motion.div>
          </AnimatePresence>
        </div>

        <BottomNav active={tab} onSelect={handleSelect}/>

        {/* Overlays */}
        <AnimatePresence>
          {showWatch&&(<>
            <motion.div key="wb" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={()=>setShowWatch(false)} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.55)", zIndex:90 }}/>
            <PushPanel key="wp" onClose={()=>setShowWatch(false)} onGoLoadout={()=>{ handleSelect("loadout"); }}/>
          </>)}
          {showCart&&(<>
            <motion.div key="cb" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={()=>setShowCart(false)} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", zIndex:90 }}/>
            <CartDrawer key="cd" onClose={()=>setShowCart(false)}/>
          </>)}
        </AnimatePresence>

        {/* Level up overlay — always on top */}
        <AnimatePresence>
          {state.levelUpQueue.length>0&&<LevelUpOverlay key="lvup"/>}
        </AnimatePresence>
      </motion.div>
    </AppCtx.Provider>
  );
}

// ══════════════════════════════════════════════════════════════════
// ROOT — Auth gate: 미로그인 시 LoginScreen, 로그인 시 ArmoryInner
// ══════════════════════════════════════════════════════════════════
export default function ArmoryApp() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthGate() {
  const C = useC();
  const { user } = useAuth();
  return (
    <motion.div animate={{ background:C.bg }} transition={{ duration:0.35 }}
      style={{
        height:"100dvh", maxWidth:430, margin:"0 auto",
        position:"relative", overflow:"hidden", fontFamily:C.mono,
      }}>
      <AnimatePresence mode="wait">
        {!user
          ? <motion.div key="login" style={{ position:"absolute", inset:0 }}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0, scale:0.96 }}
              transition={{ duration:0.3 }}>
              <LoginScreen />
            </motion.div>
          : <motion.div key="app" style={{ position:"absolute", inset:0 }}
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              transition={{ type:"spring", stiffness:260, damping:28 }}>
              <ArmoryInner />
            </motion.div>
        }
      </AnimatePresence>
    </div>
  );
}
