import { useMemo } from "react";
import type { YTUnitSnapshot } from "@gwct/shared";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";

type SemanticState = YTUnitSnapshot["semanticState"];

interface YtResponse {
  source: string;
  threshold: number;
  thresholdLow: number;
  thresholdRecover: number;
  state: "NORMAL" | "LOW" | null;
  enabled: boolean;
  ytCount: number;
  ytKnown: number;
  capturedAt: string | null;
  units: YTUnitSnapshot[];
  snapshot: {
    totalLoggedIn: number;
    totalKnown: number;
    seenAt: string;
  } | null;
}

const STATE_ORDER: Record<SemanticState, number> = {
  active: 0,
  stopped: 1,
  logged_out: 2,
};

function compareYtNo(a: string, b: string): number {
  const aNo = Number(a.replace(/^\D+/, ""));
  const bNo = Number(b.replace(/^\D+/, ""));
  if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) {
    return aNo - bNo;
  }
  return a.localeCompare(b);
}

function semanticLabel(state: SemanticState): string {
  if (state === "active") {
    return "운영";
  }
  if (state === "stopped") {
    return "중단";
  }
  return "로그아웃";
}

export default function YtScreen() {
  const { data, loading, refresh, error } = useEndpoint<YtResponse>(API_URLS.yt, { pollMs: 20000 });

  const count = data?.ytCount ?? data?.snapshot?.totalLoggedIn ?? 0;
  const known = data?.ytKnown ?? data?.snapshot?.totalKnown ?? 0;
  const threshold = data?.threshold ?? 0;
  const isLow = count < threshold;
  const sortedUnits = useMemo(() => {
    return [...(data?.units || [])].sort((a, b) => {
      const order = STATE_ORDER[a.semanticState] - STATE_ORDER[b.semanticState];
      if (order !== 0) {
        return order;
      }
      return compareYtNo(a.ytNo, b.ytNo);
    });
  }, [data?.units]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {error ? <Text style={styles.error}>서버 연결 실패, 재시도중…</Text> : null}

      <View style={styles.card}>
        <Text style={styles.title}>YT 현재 로그인</Text>
        <Text style={[styles.count, isLow ? styles.low : styles.normal]}>
          {count} / {known}
        </Text>
        <Text style={styles.meta}>임계치: {threshold}</Text>
        <Text style={styles.meta}>상태머신: {data?.state || "-"}</Text>
        <Text style={styles.meta}>감시설정: {data?.enabled ? "ON" : "OFF"}</Text>
        <Text style={styles.meta}>갱신시각: {data?.capturedAt || data?.snapshot?.seenAt || "-"}</Text>
      </View>

      {sortedUnits.map((unit) => {
        const semantic = unit.semanticState;
        const showReason = Boolean(unit.stopReason);
        return (
          <View key={`${unit.ytNo}:${unit.fingerprint}`} style={styles.unitCard}>
            <View style={styles.unitHeader}>
              <Text style={styles.ytNo}>{unit.ytNo}</Text>
              <View
                style={[
                  styles.badge,
                  semantic === "active"
                    ? styles.badgeActive
                    : semantic === "stopped"
                      ? styles.badgeStopped
                      : styles.badgeLoggedOut,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    semantic === "active"
                      ? styles.badgeTextActive
                      : semantic === "stopped"
                        ? styles.badgeTextStopped
                        : styles.badgeTextLoggedOut,
                  ]}
                >
                  {semanticLabel(semantic)}
                </Text>
              </View>
            </View>
            <Text style={styles.row}>기사: {unit.driverName || "-"}</Text>
            <Text style={styles.row}>로그인: {unit.loginTime || "-"}</Text>
            <Text style={[styles.row, showReason ? styles.reason : null]}>중단사유: {unit.stopReason || "-"}</Text>
          </View>
        );
      })}

      {!sortedUnits.length ? <Text style={styles.empty}>YT 상태 데이터가 없습니다.</Text> : null}
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
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8e4f0", borderRadius: 12, padding: 14, gap: 5 },
  title: { fontSize: 16, fontWeight: "700", color: "#123b60" },
  count: { fontSize: 36, fontWeight: "800", marginTop: 8 },
  normal: { color: "#145b1f" },
  low: { color: "#9d1f1f" },
  meta: { fontSize: 13, color: "#2e5a80" },
  unitCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  unitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ytNo: { fontSize: 18, fontWeight: "800", color: "#123b60" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  badgeActive: { backgroundColor: "#edf6ff", borderColor: "#b8d6f2" },
  badgeStopped: { backgroundColor: "#fff7d6", borderColor: "#f0d780" },
  badgeLoggedOut: { backgroundColor: "#ffe9e9", borderColor: "#efb5b5" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextActive: { color: "#215781" },
  badgeTextStopped: { color: "#7a6200" },
  badgeTextLoggedOut: { color: "#9d1f1f" },
  row: { fontSize: 13, color: "#2e587d" },
  reason: { color: "#7a6200", fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 30, color: "#5f7890" },
});
