import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { API_URLS } from "../lib/config";

type GcCrewStatus = "stopped" | "staffed" | "empty";
type GcCrewRow = EquipmentLatestResponse["gcStates"][number] & { crewStatus: GcCrewStatus };

interface EquipmentLatestResponse {
  source: string;
  sourceUrl: string;
  capturedAt: string;
  gcStates: Array<{
    gcNo: number;
    equipmentId: string;
    driverName: string | null;
    hkName: string | null;
    loginTime: string | null;
    stopReason: string | null;
  }>;
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

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function deriveGcCrewStatus(row: EquipmentLatestResponse["gcStates"][number]): GcCrewStatus {
  if (hasText(row.stopReason)) {
    return "stopped";
  }
  if (hasText(row.driverName) || hasText(row.hkName) || hasText(row.loginTime)) {
    return "staffed";
  }
  return "empty";
}

function statusLabel(status: GcCrewStatus): string {
  if (status === "stopped") {
    return "중단";
  }
  if (status === "staffed") {
    return "작업중";
  }
  return "작업 안함";
}

function statusPriority(status: GcCrewStatus): number {
  if (status === "staffed") {
    return 0;
  }
  if (status === "stopped") {
    return 1;
  }
  return 2;
}

function isVisibleGc(gcNo: number): boolean {
  return gcNo >= 181 && gcNo <= 190;
}

function StatusMark({ status, size }: { status: GcCrewStatus; size: number }) {
  if (status === "staffed") {
    return <View style={[styles.circleMark, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  if (status === "stopped") {
    return (
      <View
        style={[
          styles.triangleMark,
          {
            borderLeftWidth: size / 2,
            borderRightWidth: size / 2,
            borderBottomWidth: size,
          },
        ]}
      />
    );
  }
  return <View style={[styles.squareMark, { width: size, height: size }]} />;
}

export default function EquipmentScreen() {
  const latest = useEndpoint<EquipmentLatestResponse>(API_URLS.equipmentLatest, { pollMs: 25000 });

  const gcStates = useMemo<GcCrewRow[]>(
    () => {
      const rows = (latest.data?.gcStates || [])
        .filter((row) => isVisibleGc(row.gcNo))
        .map((row) => ({ ...row, crewStatus: deriveGcCrewStatus(row) }));
      const allEmpty = rows.every((row) => row.crewStatus === "empty");
      rows.sort((left, right) => {
        if (allEmpty) {
          return left.gcNo - right.gcNo;
        }
        const priorityDiff = statusPriority(left.crewStatus) - statusPriority(right.crewStatus);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return left.gcNo - right.gcNo;
      });
      return rows;
    },
    [latest.data?.gcStates],
  );

  const summary = useMemo(() => {
    return gcStates.reduce(
      (acc, row) => {
        const status = deriveGcCrewStatus(row);
        acc[status] += 1;
        return acc;
      },
      { stopped: 0, staffed: 0, empty: 0 } satisfies Record<GcCrewStatus, number>,
    );
  }, [gcStates]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={latest.loading} onRefresh={() => void latest.refresh()} />}
    >
      {latest.error ? <Text style={styles.error}>서버 연결 실패, 재시도중…</Text> : null}

      <View style={styles.summaryStrip}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem} accessibilityLabel={`작업중 ${summary.staffed}`}>
            <StatusMark status="staffed" size={22} />
            <Text style={[styles.summaryCount, styles.statusTextStaffed]}>{summary.staffed}</Text>
          </View>
          <View style={styles.legendItem} accessibilityLabel={`중단 ${summary.stopped}`}>
            <StatusMark status="stopped" size={22} />
            <Text style={[styles.summaryCount, styles.statusTextStopped]}>{summary.stopped}</Text>
          </View>
          <View style={styles.legendItem} accessibilityLabel={`작업 안함 ${summary.empty}`}>
            <StatusMark status="empty" size={22} />
            <Text style={[styles.summaryCount, styles.statusTextEmpty]}>{summary.empty}</Text>
          </View>
        </View>
        <Text style={styles.meta}>갱신 {fmtTime(latest.data?.capturedAt)}</Text>
      </View>

      {gcStates.map((gc) => {
        const hasStopReason = gc.crewStatus === "stopped";

        return (
          <View key={gc.gcNo} style={styles.gcCard}>
            <View style={styles.headerRow}>
              <Text style={styles.gcTitle}>GC{gc.gcNo}</Text>
              <View style={styles.statusChip} accessibilityLabel={statusLabel(gc.crewStatus)}>
                <StatusMark status={gc.crewStatus} size={18} />
              </View>
            </View>

            <View style={styles.inlineRow}>
              <View style={styles.leftColumn}>
                <Text style={styles.label}>Cabin</Text>
                <Text style={styles.value}>{gc.driverName || "-"}</Text>
              </View>
              <View style={styles.rightColumn}>
                <Text style={styles.label}>Under</Text>
                <Text style={styles.value}>{gc.hkName || "-"}</Text>
              </View>
            </View>

            <View style={styles.inlineRow}>
              <View style={styles.leftColumn}>
                <Text style={styles.label}>로그인</Text>
                <Text style={styles.value}>{gc.loginTime || "-"}</Text>
              </View>
              <View style={[styles.rightColumn, styles.reasonGroup, hasStopReason ? styles.reasonGroupStopped : null]}>
                <Text style={[styles.label, hasStopReason ? styles.stopLabel : null]}>중단사유</Text>
                <Text style={[styles.value, hasStopReason ? styles.stopValue : styles.reasonValue]} numberOfLines={1}>
                  {gc.stopReason || "-"}
                </Text>
              </View>
            </View>
          </View>
        );
      })}

      {!gcStates.length ? <Text style={styles.empty}>GC Cabin/Under 데이터가 없습니다.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 12, gap: 8 },
  error: {
    backgroundColor: "#fde8e8",
    borderWidth: 1,
    borderColor: "#e8a8a8",
    color: "#8b1a1a",
    padding: 8,
    borderRadius: 10,
    fontWeight: "700",
  },
  summaryStrip: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e4f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryCount: { fontSize: 22, fontWeight: "800" },
  meta: { fontSize: 11, color: "#5d7892" },
  gcCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e4f0",
    padding: 10,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  gcTitle: { fontSize: 15, fontWeight: "800", color: "#143a5d" },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
  },
  statusTextStaffed: {
    color: "#1d5ea8",
  },
  statusTextStopped: {
    color: "#b32828",
  },
  statusTextEmpty: {
    color: "#6b7280",
  },
  circleMark: {
    backgroundColor: "#2b6fcf",
  },
  triangleMark: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#c63333",
    borderStyle: "solid",
  },
  squareMark: {
    backgroundColor: "#8b95a1",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leftColumn: {
    width: "36%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  rightColumn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
  },
  reasonGroup: {
    borderRadius: 7,
    paddingLeft: 0,
    paddingRight: 6,
    paddingVertical: 2,
  },
  reasonGroupStopped: {
    backgroundColor: "#fff0f0",
    borderWidth: 1,
    borderColor: "#e7b0b0",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5c7892",
  },
  value: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#204666",
  },
  reasonValue: {
    color: "#204666",
  },
  stopLabel: {
    color: "#9a1e1e",
  },
  stopValue: {
    fontWeight: "800",
    color: "#7f1616",
  },
  empty: {
    textAlign: "center",
    marginTop: 30,
    color: "#5f7890",
  },
});
