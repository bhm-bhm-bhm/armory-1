import dynamic from "next/dynamic";

// window, localStorage 등 브라우저 API 사용으로 SSR 비활성화
const ArmoryApp = dynamic(() => import("@/components/ArmoryApp"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "100dvh",
      background: "#01080F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'JetBrains Mono', monospace",
      color: "#18CFFF",
      fontSize: 13,
      letterSpacing: "0.3em",
    }}>
      ARMORY LOADING...
    </div>
  ),
});

export default function Home() {
  return <ArmoryApp />;
}
