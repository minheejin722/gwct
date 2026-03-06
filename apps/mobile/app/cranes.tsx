import { useEffect } from "react";
import type { CraneStatus } from "@gwct/shared";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { buildCraneRenderKey, reportDuplicateCraneRows } from "../lib/craneKeys";
import { API_URLS } from "../lib/config";

type GcWorkState = "active" | "scheduled" | "idle" | "unknown";

interface CraneLiveItem extends CraneStatus {
  workState: GcWorkState;
  crewAssigned: boolean;
}

interface CranesResponse {
  count: number;
  items: CraneLiveItem[];
}

function workStateLabel(state: GcWorkState): string {
  if (state === "active") {
    return "작업중";
  }
  if (state === "scheduled") {
    return "작업 예정";
  }
  if (state === "idle") {
    return "작업 없음";
  }
  return "상태 미확인";
}

export default function CranesScreen() {
  const { data, loading, refresh } = useEndpoint<CranesResponse>(API_URLS.cranes);
  const items = data?.items || [];

  useEffect(() => {
    reportDuplicateCraneRows(items);
  }, [items]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {items.map((item) => (
        <View key={buildCraneRenderKey(item)} style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{item.craneId}</Text>
            <View
              style={[
                styles.badge,
                item.workState === "active"
                  ? styles.badgeActive
                  : item.workState === "scheduled"
                    ? styles.badgeScheduled
                    : item.workState === "idle"
                      ? styles.badgeIdle
                      : styles.badgeUnknown,
              ]}
            >
              <Text style={styles.badgeText}>{workStateLabel(item.workState)}</Text>
            </View>
          </View>
          <Text style={styles.meta}>선박: {item.vesselName || "-"}</Text>
          <Text style={styles.highlight}>잔량 합계: {item.totalRemaining ?? "-"}</Text>
          <Text style={styles.meta}>양하 잔량: {item.dischargeRemaining ?? "-"}</Text>
          <Text style={styles.meta}>적하 잔량: {item.loadRemaining ?? "-"}</Text>
          {item.workState === "scheduled" ? (
            <Text style={styles.note}>잔량은 남아 있지만 Cabin/Under/login 정보가 없어 작업 예정으로 분류됨</Text>
          ) : null}
        </View>
      ))}
      {!items.length ? <Text style={styles.empty}>크레인 데이터가 없습니다.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16, gap: 10 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8e4f0", borderRadius: 12, padding: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: "#123b60" },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeActive: { backgroundColor: "#e9f8ec", borderColor: "#b7dfc0" },
  badgeScheduled: { backgroundColor: "#eef5ff", borderColor: "#b7cfee" },
  badgeIdle: { backgroundColor: "#f3f5f7", borderColor: "#d4dbe2" },
  badgeUnknown: { backgroundColor: "#fff4e8", borderColor: "#edcfaa" },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#204666" },
  meta: { fontSize: 13, color: "#2e5a80", marginTop: 2 },
  highlight: { fontSize: 15, color: "#7c1f1f", fontWeight: "700", marginTop: 4 },
  note: { marginTop: 6, fontSize: 12, color: "#2f5d86" },
  empty: { textAlign: "center", marginTop: 30, color: "#5f7890" },
});
