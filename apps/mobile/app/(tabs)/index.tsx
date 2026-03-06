import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatDashboardMetric } from "@gwct/shared";
import { useEndpoint } from "../../hooks/useEndpoint";
import { useSseAlerts } from "../../hooks/useSseAlerts";
import { API_URLS } from "../../lib/config";
import { ScreenLinkCard } from "../../components/ScreenLinkCard";

interface SummaryResponse {
  lastUpdatedAt: string | null;
  trackedVesselCount: number;
  workingCraneCount: number;
  supportEquipmentLoginCount: number;
  ytLoggedInCount: number;
  weatherState: "none" | "partial" | "all";
  alertCount24h: number;
}

export default function HomeScreen() {
  const { data, loading, refresh, updatedAt } = useEndpoint<SummaryResponse>(API_URLS.summary);
  const { connected, lastAlert } = useSseAlerts();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>GWCT 운영 요약</Text>
        <Text style={styles.summaryText}>{formatDashboardMetric("선박(ETA 추적)", data?.trackedVesselCount ?? 0)}</Text>
        <Text style={styles.summaryText}>{formatDashboardMetric("크레인(GC181~190 작업중)", data?.workingCraneCount ?? 0)}</Text>
        <Text style={styles.summaryText}>
          {formatDashboardMetric("장비 로그인(LEASE/REPAIR/RS/TC/TH)", data?.supportEquipmentLoginCount ?? 0)}
        </Text>
        <Text style={styles.summaryText}>{formatDashboardMetric("YT 로그인", data?.ytLoggedInCount ?? 0)}</Text>
        <Text style={styles.summaryText}>도선 상태: {data?.weatherState ?? "none"}</Text>
        <Text style={styles.meta}>마지막 갱신: {updatedAt || "-"}</Text>
      </View>

      <View style={styles.liveCard}>
        <Text style={styles.liveTitle}>실시간 스트림</Text>
        <Text style={styles.liveText}>연결 상태: {connected ? "연결됨" : "끊김"}</Text>
        <Text style={styles.liveText}>최근 이벤트: {lastAlert ? `${lastAlert.title}` : "없음"}</Text>
      </View>

      <View style={styles.links}>
        <ScreenLinkCard href="/monitor" title="모니터링 설정" subtitle="기능별 Confirm/Cancel 및 기준값 설정" />
        <ScreenLinkCard href="/vessels" title="선박 스케줄" subtitle="ETA/ETD 변경, 신규/삭제 확인" />
        <ScreenLinkCard href="/cranes" title="크레인 현황" subtitle="GC 잔량 및 임계치 추적" />
        <ScreenLinkCard href="/equipment" title="장비 현황" subtitle="GC180~190 Cabin/Under/중단사유 확인" />
        <ScreenLinkCard href="/yt" title="YT 로그인 수" subtitle="최소 인원 임계치 모니터링" />
        <ScreenLinkCard href="/weather" title="도선 중지 알림" subtitle="배선팀근무 + 대기호출자 기반 중지 감지" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16, gap: 14 },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e4f0",
    padding: 16,
    gap: 6,
  },
  summaryTitle: { fontSize: 20, fontWeight: "800", color: "#123555" },
  summaryText: { fontSize: 15, color: "#234d74" },
  meta: { marginTop: 6, fontSize: 12, color: "#5d7892" },
  liveCard: {
    backgroundColor: "#f8fbff",
    borderColor: "#bfd3e7",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  liveTitle: { fontSize: 16, fontWeight: "700", color: "#173a5e" },
  liveText: { fontSize: 13, color: "#325e85" },
  links: { gap: 10 },
});
