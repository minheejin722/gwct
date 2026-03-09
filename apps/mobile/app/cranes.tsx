import { useEffect, useMemo } from "react";
import type { CraneStatus } from "@gwct/shared";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { buildCraneRenderKey, reportDuplicateCraneRows } from "../lib/craneKeys";
import { useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";

type GcWorkState = "active" | "checking" | "scheduled" | "idle" | "unknown";

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
  if (state === "checking") {
    return 1;
  }
  if (state === "scheduled") {
    return 2;
  }
  return 3;
}

function craneNumber(craneId: string): number {
  const matched = craneId.match(/\d+/);
  return matched ? Number(matched[0]) : Number.MAX_SAFE_INTEGER;
}

function workStateLabel(state: GcWorkState): string {
  if (state === "active") {
    return "작업중";
  }
  if (state === "checking") {
    return "작업유무 체크중";
  }
  if (state === "scheduled") {
    return "작업 예정";
  }
  return "작업 안함";
}

function workStateTone(
  state: GcWorkState,
  resolvedTheme: "light" | "dark",
  colors: ReturnType<typeof useAppPreferences>["colors"],
) {
  if (state === "active") {
    return {
      strong: colors.success,
      soft: resolvedTheme === "dark" ? "rgba(128,213,143,0.12)" : "#e9f8ec",
      border: resolvedTheme === "dark" ? "rgba(128,213,143,0.24)" : "#b7dfc0",
    };
  }
  if (state === "checking") {
    return {
      strong: colors.warning,
      soft: resolvedTheme === "dark" ? "rgba(255,203,107,0.12)" : "#f8f5ea",
      border: resolvedTheme === "dark" ? "rgba(255,203,107,0.25)" : "#d9cfaa",
    };
  }
  if (state === "scheduled") {
    return {
      strong: colors.badgeBackground,
      soft: resolvedTheme === "dark" ? "rgba(44,127,227,0.12)" : "#eef5ff",
      border: resolvedTheme === "dark" ? "rgba(44,127,227,0.24)" : "#b7cfee",
    };
  }
  return {
    strong: colors.secondaryText,
    soft: resolvedTheme === "dark" ? "rgba(175,188,201,0.10)" : "#f3f5f7",
    border: resolvedTheme === "dark" ? "rgba(175,188,201,0.20)" : "#d4dbe2",
  };
}

export default function CranesScreen() {
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data, loading, refresh } = useEndpoint<CranesResponse>(API_URLS.cranes, {
    pollMs: 5000,
    liveSources: ["gwct_gc_remaining", "gwct_work_status", "gwct_equipment_status"],
  });
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
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refresh()}
          tintColor={colors.accentMuted}
          colors={[colors.badgeBackground]}
        />
      }
    >
      {sortedItems.map((item) => {
        const tone = workStateTone(item.workState, resolvedTheme, colors);
        return (
          <View key={buildCraneRenderKey(item)} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{item.craneId}</Text>
              <View style={[styles.badge, { backgroundColor: tone.soft, borderColor: tone.border }]}>
                <Text style={[styles.badgeText, { color: tone.strong }]}>{workStateLabel(item.workState)}</Text>
              </View>
            </View>
            <Text style={styles.meta}>선박: {item.vesselName || "-"}</Text>
            <Text style={styles.highlight}>잔량 합계: {item.totalRemaining ?? "-"}</Text>
            <Text style={styles.meta}>양하 잔량: {item.dischargeRemaining ?? "-"}</Text>
            <Text style={styles.meta}>적하 잔량: {item.loadRemaining ?? "-"}</Text>
          </View>
        );
      })}
      {!sortedItems.length ? <Text style={styles.empty}>크레인 데이터가 없습니다.</Text> : null}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"], resolvedTheme: "light" | "dark") {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 10, paddingBottom: 28 },
    card: {
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
    },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    title: { fontSize: 16, fontWeight: "700", color: colors.primaryText },
    badge: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: { fontSize: 11, fontWeight: "800" },
    meta: { fontSize: 13, color: colors.secondaryText, marginTop: 2 },
    highlight: {
      fontSize: 15,
      color: resolvedTheme === "dark" ? "#ffd7a8" : "#7c1f1f",
      fontWeight: "700",
      marginTop: 4,
    },
    empty: { textAlign: "center", marginTop: 30, color: colors.secondaryText },
  });
}
