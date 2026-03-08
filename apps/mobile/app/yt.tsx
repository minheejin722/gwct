import { useMemo } from "react";
import type { YTUnitSnapshot } from "@gwct/shared";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { useAppPreferences } from "../lib/appPreferences";
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
    return "운전중";
  }
  if (state === "stopped") {
    return "중단";
  }
  return "로그아웃";
}

function semanticTone(
  state: SemanticState,
  resolvedTheme: "light" | "dark",
  colors: ReturnType<typeof useAppPreferences>["colors"],
) {
  if (state === "active") {
    return {
      strong: colors.badgeBackground,
      soft: resolvedTheme === "dark" ? "rgba(44,127,227,0.14)" : "#edf6ff",
      border: resolvedTheme === "dark" ? "rgba(44,127,227,0.28)" : "#b8d6f2",
    };
  }
  if (state === "stopped") {
    return {
      strong: colors.warning,
      soft: resolvedTheme === "dark" ? "rgba(255,203,107,0.12)" : "#fff7d6",
      border: resolvedTheme === "dark" ? "rgba(255,203,107,0.26)" : "#f0d780",
    };
  }
  return {
    strong: colors.danger,
    soft: resolvedTheme === "dark" ? "rgba(255,122,122,0.12)" : "#ffe9e9",
    border: resolvedTheme === "dark" ? "rgba(255,122,122,0.26)" : "#efb5b5",
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatLoggedOutTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export default function YtScreen() {
  const { colors, resolvedTheme } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors, resolvedTheme), [colors, resolvedTheme]);
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
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refresh()}
          tintColor={colors.accentMuted}
          colors={[colors.badgeBackground]}
        />
      }
    >
      {error ? <Text style={styles.error}>서버 연결 실패, 재시도중…</Text> : null}

      <View style={styles.card}>
        <Text style={styles.title}>YT 현재 로그인</Text>
        <Text style={[styles.count, { color: isLow ? colors.danger : colors.success }]}>
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
        const timeLabel = semantic === "logged_out" ? "로그아웃" : "로그인";
        const timeValue = semantic === "logged_out" ? formatLoggedOutTime(unit.logoutTime) : unit.loginTime || "-";
        const tone = semanticTone(semantic, resolvedTheme, colors);
        return (
          <View key={`${unit.ytNo}:${unit.fingerprint}`} style={styles.unitCard}>
            <View style={styles.unitHeader}>
              <Text style={styles.ytNo}>{unit.ytNo}</Text>
              <View style={[styles.badge, { backgroundColor: tone.soft, borderColor: tone.border }]}>
                <Text style={[styles.badgeText, { color: tone.strong }]}>{semanticLabel(semantic)}</Text>
              </View>
            </View>
            <Text style={styles.row}>Cabin: {unit.driverName || "-"}</Text>
            <Text style={styles.row}>
              {timeLabel}: {timeValue}
            </Text>
            <Text style={[styles.row, showReason ? { color: colors.warning, fontWeight: "700" } : null]}>
              중단사유: {unit.stopReason || "-"}
            </Text>
          </View>
        );
      })}

      {!sortedUnits.length ? <Text style={styles.empty}>YT 상태 데이터가 없습니다.</Text> : null}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"], resolvedTheme: "light" | "dark") {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 10, paddingBottom: 28 },
    error: {
      backgroundColor: resolvedTheme === "dark" ? "rgba(255,122,122,0.12)" : "#fde8e8",
      borderWidth: 1,
      borderColor: resolvedTheme === "dark" ? "rgba(255,122,122,0.26)" : "#e8a8a8",
      color: colors.danger,
      padding: 10,
      borderRadius: 10,
      fontWeight: "700",
    },
    card: {
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 5,
    },
    title: { fontSize: 16, fontWeight: "700", color: colors.primaryText },
    count: { fontSize: 36, fontWeight: "800", marginTop: 8 },
    meta: { fontSize: 13, color: colors.secondaryText },
    unitCard: {
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    unitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    ytNo: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
    badgeText: { fontSize: 12, fontWeight: "700" },
    row: { fontSize: 13, color: colors.secondaryText },
    empty: { textAlign: "center", marginTop: 30, color: colors.secondaryText },
  });
}
