/**
 * ARMORY — OAuth 서버 사이드 헬퍼
 *
 * Google / Kakao OAuth 토큰 교환 엔드포인트
 * 실제 배포 시 환경 변수를 .env.local에 설정하세요.
 *
 * .env.local 예시:
 *   GOOGLE_CLIENT_ID=your_google_client_id
 *   GOOGLE_CLIENT_SECRET=your_google_client_secret
 *   KAKAO_REST_KEY=your_kakao_rest_api_key
 *   KAKAO_CLIENT_SECRET=your_kakao_client_secret
 *   NEXTAUTH_SECRET=random_32char_string
 *   NEXTAUTH_URL=https://your-domain.com
 */

export interface OAuthUser {
  id: string;
  provider: "google" | "kakao";
  name: string;
  email: string;
  avatar: string | null;
  joinedAt: string;
}

// ── Google token exchange ─────────────────────────────────────────
export async function exchangeGoogleCode(code: string): Promise<OAuthUser> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${process.env.NEXTAUTH_URL}/auth/google/callback`,
      grant_type:    "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  return {
    id:        `google_${profile.id}`,
    provider:  "google",
    name:      profile.name,
    email:     profile.email,
    avatar:    profile.picture ?? null,
    joinedAt:  new Date().toISOString(),
  };
}

// ── Kakao token exchange ──────────────────────────────────────────
export async function exchangeKakaoCode(code: string): Promise<OAuthUser> {
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     process.env.KAKAO_REST_KEY!,
      client_secret: process.env.KAKAO_CLIENT_SECRET ?? "",
      redirect_uri:  `${process.env.NEXTAUTH_URL}/auth/kakao/callback`,
      code,
    }),
  });
  const tokens = await tokenRes.json();

  const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();

  return {
    id:       `kakao_${profile.id}`,
    provider: "kakao",
    name:     profile.kakao_account?.profile?.nickname ?? "카카오 유저",
    email:    profile.kakao_account?.email ?? "",
    avatar:   profile.kakao_account?.profile?.profile_image_url ?? null,
    joinedAt: new Date().toISOString(),
  };
}
