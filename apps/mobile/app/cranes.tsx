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

function workStatePriority(state: GcWorkState): number {
  if (state === "active") {
    return 0;
  }
  if (state === "scheduled") {
    return 1;
  }
  return 2;
}

function craneNumber(craneId: string): number {
  const matched = craneId.match(/\d+/);
  return matched ? Number(matched[0]) : Number.MAX_SAFE_INTEGER;
}

function workStateLabel(state: GcWorkState): string {
  if (state === "active") {
    return "작업중";
  }
  if (state === "scheduled") {
    return "작업 예정";
  }
  return "작업 안함";
}

function workStateBadgeStyle(state: GcWorkState) {
  if (state === "active") {
    return styles.badgeActive;
  }
  if (state === "scheduled") {
    return styles.badgeScheduled;
  }
  return styles.badgeIdle;
}

export default function CranesScreen() {
  const { data, loading, refresh } = useEndpoint<CranesResponse>(API_URLS.cranes);
  const items = data?.items || [];
  const sortedItems = [...items].sort((left, right) => {
    const priorityDiff = workStatePriority(left.workState) - workStatePriority(right.workState);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const craneDiff = craneNumber(left.craneId) - craneNumber(right.craneId);
    if (craneDiff !== 0) {
      return craneDiff;
    }
    return (left.vesselName || "").localeCompare(right.vesselName || "");
  });

  useEffect(() => {
    reportDuplicateCraneRows(items);
  }, [items]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {sortedItems.map((item) => (
        <View key={buildCraneRenderKey(item)} style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{item.craneId}</Text>
            <View style={[styles.badge, workStateBadgeStyle(item.workState)]}>
              <Text style={styles.badgeText}>{workStateLabel(item.workState)}</Text>
            </View>
          </View>
          <Text style={styles.meta}>선박: {item.vesselName || "-"}</Text>
          <Text style={styles.highlight}>잔량 합계: {item.totalRemaining ?? "-"}</Text>
          <Text style={styles.meta}>양하 잔량: {item.dischargeRemaining ?? "-"}</Text>
          <Text style={styles.meta}>적하 잔량: {item.loadRemaining ?? "-"}</Text>
        </View>
      ))}
      {!sortedItems.length ? <Text style={styles.empty}>크레인 데이터가 없습니다.</Text> : null}
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
  badgeText: { fontSize: 11, fontWeight: "800", color: "#204666" },
  meta: { fontSize: 13, color: "#2e5a80", marginTop: 2 },
  highlight: { fontSize: 15, color: "#7c1f1f", fontWeight: "700", marginTop: 4 },
  empty: { textAlign: "center", marginTop: 30, color: "#5f7890" },
});
