import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";
import { ScreenLinkCard } from "../components/ScreenLinkCard";

interface WeatherResponse {
  forecast: {
    suspensionState: "none" | "partial" | "all";
    semanticState: "NORMAL" | "SUSPENDED" | "UNKNOWN";
    dispatchTeamDutyText: string | null;
    standbyCallText: string | null;
    normalizedReason: string | null;
    dutyText: string | null;
    seenAt: string;
  } | null;
  notice: {
    noticeHeadline: string | null;
    suspensionState: "none" | "partial" | "all";
  } | null;
  monitor?: {
    enabled: boolean;
    lastChangedAt: string | null;
  };
}

export default function WeatherScreen() {
  const { data, loading, refresh } = useEndpoint<WeatherResponse>(API_URLS.weather);
  const semantic = data?.forecast?.semanticState || "UNKNOWN";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <View style={styles.card}>
        <Text style={styles.title}>도선 상태 (배선팀근무 + 대기호출자)</Text>
        <Text
          style={[
            styles.state,
            semantic === "SUSPENDED" ? styles.critical : semantic === "UNKNOWN" ? styles.warning : styles.normal,
          ]}
        >
          {semantic}
        </Text>
        <Text style={styles.meta}>배선팀근무: {data?.forecast?.dispatchTeamDutyText || "-"}</Text>
        <Text style={styles.meta}>대기호출자: {data?.forecast?.standbyCallText || data?.forecast?.dutyText || "-"}</Text>
        <Text style={styles.text}>판정 근거: {data?.forecast?.normalizedReason || "-"}</Text>
        <Text style={styles.meta}>감시설정: {data?.monitor?.enabled ? "ON" : "OFF"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>공지 보조 신호</Text>
        <Text style={styles.text}>{data?.notice?.noticeHeadline || "없음"}</Text>
      </View>

      <ScreenLinkCard href="/monitor-yeosu" title="여수 도선중지 감시 설정" subtitle="Confirm/Cancel로 감시 활성/비활성" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16, gap: 10 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8e4f0", borderRadius: 12, padding: 12 },
  title: { fontSize: 16, fontWeight: "700", color: "#123b60" },
  state: { fontSize: 26, fontWeight: "900", marginTop: 8 },
  critical: { color: "#a01919" },
  warning: { color: "#9d6a00" },
  normal: { color: "#1c6b26" },
  text: { fontSize: 14, color: "#204a70", marginTop: 6 },
  meta: { fontSize: 12, color: "#587692", marginTop: 4 },
});
