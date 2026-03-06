import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";
import { ScreenLinkCard } from "../components/ScreenLinkCard";

interface EquipmentLatestResponse {
  source: string;
  sourceUrl: string;
  capturedAt: string;
  ytCount: number;
  ytKnown: number;
  gcStates: Array<{
    gcNo: number;
    equipmentId: string;
    driverName: string | null;
    hkName: string | null;
    loginTime: string | null;
    stopReason: string | null;
  }>;
}

interface EquipmentConfigResponse {
  ytThresholdLow: number;
  ytThresholdRecover: number;
  ytStateInitialized: boolean;
  ytState: "NORMAL" | "LOW" | null;
  ytEnabled?: boolean;
  gcStaffEnabled?: boolean;
}

function fmtTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ko-KR", { hour12: false });
}

export default function EquipmentScreen() {
  const latest = useEndpoint<EquipmentLatestResponse>(API_URLS.equipmentLatest, { pollMs: 25000 });
  const config = useEndpoint<EquipmentConfigResponse>(API_URLS.equipmentConfig, { pollMs: 30000 });

  const refreshing = latest.loading || config.loading;
  const hasError = Boolean(latest.error || config.error);

  const status = useMemo(() => {
    if (config.data?.ytState) {
      return config.data.ytState;
    }
    const count = latest.data?.ytCount ?? 0;
    const low = config.data?.ytThresholdLow ?? 0;
    return count <= low ? "LOW" : "NORMAL";
  }, [config.data, latest.data]);

  const onRefresh = async () => {
    await Promise.all([latest.refresh(), config.refresh()]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      {hasError ? <Text style={styles.error}>서버 연결 실패, 재시도중…</Text> : null}

      <View style={styles.ytCard}>
        <Text style={styles.ytLabel}>YT 로그인 대수</Text>
        <Text style={[styles.ytCount, status === "LOW" ? styles.low : styles.normal]}>
          {latest.data?.ytCount ?? 0}
        </Text>
        <Text style={styles.meta}>
          상태: {status} · Low {config.data?.ytThresholdLow ?? "-"} / Recover {config.data?.ytThresholdRecover ?? "-"}
        </Text>
        <Text style={styles.meta}>
          감시설정: YT {config.data?.ytEnabled ? "ON" : "OFF"} / GC Cabin-Under {config.data?.gcStaffEnabled ? "ON" : "OFF"}
        </Text>
        <Text style={styles.meta}>마지막 업데이트: {fmtTime(latest.data?.capturedAt)}</Text>
      </View>

      <ScreenLinkCard href="/monitor-equipment" title="장비 감시 설정" subtitle="YT 기준값 + GC Cabin/Under 감시 Confirm/Cancel" />

      {(latest.data?.gcStates || []).map((gc) => {
        const hasStopReason = Boolean(gc.stopReason);
        return (
          <View key={gc.gcNo} style={styles.gcCard}>
            <Text style={styles.gcTitle}>GC{gc.gcNo}</Text>
            <Text style={styles.row}>Cabin: {gc.driverName || "-"}</Text>
            <Text style={styles.row}>Under: {gc.hkName || "-"}</Text>
            <Text style={styles.row}>로그인: {gc.loginTime || "-"}</Text>
            <Text style={[styles.row, hasStopReason ? styles.stopReason : styles.normalReason]}>
              중단사유: {gc.stopReason || "-"}
            </Text>
          </View>
        );
      })}

      {!latest.data?.gcStates?.length ? <Text style={styles.empty}>장비 데이터가 없습니다.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16, gap: 10 },
  error: {
    backgroundColor: "#fde8e8",
    borderWidth: 1,
    borderColor: "#e8a8a8",
    color: "#8b1a1a",
    padding: 10,
    borderRadius: 10,
    fontWeight: "700",
  },
  ytCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  ytLabel: { fontSize: 15, fontWeight: "700", color: "#123b60" },
  ytCount: { fontSize: 42, fontWeight: "800" },
  normal: { color: "#145b1f" },
  low: { color: "#9d1f1f" },
  meta: { fontSize: 12, color: "#2e5a80" },
  gcCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  gcTitle: { fontSize: 16, fontWeight: "800", color: "#123a5c" },
  row: { fontSize: 13, color: "#2d5378" },
  stopReason: {
    color: "#8b1a1a",
    backgroundColor: "#feeaea",
    borderWidth: 1,
    borderColor: "#efb6b6",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
    fontWeight: "700",
  },
  normalReason: { color: "#2d5378" },
  empty: { textAlign: "center", marginTop: 30, color: "#5f7890" },
});
