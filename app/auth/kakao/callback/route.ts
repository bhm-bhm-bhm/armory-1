import { NextRequest, NextResponse } from "next/server";
import { exchangeKakaoCode } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=no_code", req.url));
  }

  try {
    const user = await exchangeKakaoCode(code);
    return new NextResponse(
      `<script>
        window.opener?.postMessage({ type: "OAUTH_SUCCESS", user: ${JSON.stringify(user)} }, window.location.origin);
        window.close();
      </script>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return NextResponse.redirect(new URL("/?auth_error=exchange_failed", req.url));
  }
}
