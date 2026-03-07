import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEndpoint } from "../hooks/useEndpoint";
import { useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";

type VesselRowColor = "yellow" | "cyan" | "green" | "unknown";

interface VesselsResponse {
  source: string;
  count: number;
  items: Array<{
    vesselKey: string;
    vesselName: string;
    voyage: string | null;
    berth: string | null;
    shippingLine: string | null;
    eta: string | null;
    etd: string | null;
    etaDisplay: string | null;
    etdDisplay: string | null;
    status: string | null;
    watchIndex: number | null;
    rowColor: VesselRowColor;
    latestEtaChange: {
      eventId: string;
      occurredAt: string;
      previousEta: string;
      currentEta: string;
      previousEtaDisplay: string;
      currentEtaDisplay: string;
      deltaMinutes: number;
      direction: "earlier" | "later";
      crossedDate: boolean;
      humanMessage: string;
      adjustmentCount: number;
    } | null;
  }>;
}

function rowTone(rowColor: VesselRowColor) {
  if (rowColor === "yellow") {
    return {
      backgroundColor: "#fff4dc",
      borderColor: "#edcf82",
      badgeBackground: "#f4d991",
      badgeText: "#7b5d00",
    };
  }
  if (rowColor === "cyan") {
    return {
      backgroundColor: "#e8f8ff",
      borderColor: "#a8ddee",
      badgeBackground: "#c7f0fb",
      badgeText: "#14536b",
    };
  }
  return {
    backgroundColor: "#ffffff",
    borderColor: "#d8e4f0",
    badgeBackground: "#eef4fb",
    badgeText: "#49657e",
  };
}

export default function VesselsScreen() {
  const { colors } = useAppPreferences();
  const styles = createStyles(colors);
  const { data, loading, refresh } = useEndpoint<VesselsResponse>(API_URLS.vessels);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      {(data?.items || []).map((item) => {
        const tone = rowTone(item.rowColor);

        return (
          <View
            key={item.vesselKey}
            style={[
              styles.card,
              {
                backgroundColor: tone.backgroundColor,
                borderColor: tone.borderColor,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{item.vesselName}</Text>
                <Text style={styles.subtitle}>
                  {item.voyage || "-"} · 선석 {item.berth || "-"} · 선사 {item.shippingLine || "-"}
                </Text>
              </View>
              <View style={[styles.watchChip, { backgroundColor: tone.badgeBackground }]}>
                <Text style={[styles.watchChipText, { color: tone.badgeText }]}>#{item.watchIndex ?? "-"}</Text>
              </View>
            </View>

            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>ETA</Text>
              <Text style={styles.timeValue}>{item.etaDisplay || "-"}</Text>
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>ETD</Text>
              <Text style={styles.timeValue}>{item.etdDisplay || "-"}</Text>
            </View>

            {item.latestEtaChange ? (
              <View
                style={[
                  styles.etaChangeBox,
                  item.latestEtaChange.direction === "earlier" ? styles.etaEarlier : styles.etaLater,
                ]}
              >
                <Text
                  style={[
                    styles.etaChangeText,
                    item.latestEtaChange.direction === "earlier" ? styles.etaEarlierText : styles.etaLaterText,
                  ]}
                >
                  {item.latestEtaChange.humanMessage}
                </Text>
                <Text style={styles.etaDetailText}>
                  {item.latestEtaChange.previousEtaDisplay} → {item.latestEtaChange.currentEtaDisplay}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
      {!data?.items?.length && <Text style={styles.empty}>선박 데이터가 없습니다.</Text>}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 10, paddingBottom: 24 },
    card: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 5,
      elevation: 1,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    headerCopy: {
      flex: 1,
      gap: 3,
    },
    title: { fontSize: 17, fontWeight: "800", color: "#1c2b36" },
    subtitle: { fontSize: 12, color: colors.secondaryText, lineHeight: 18 },
    watchChip: {
      minWidth: 42,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    watchChipText: {
      fontSize: 12,
      fontWeight: "800",
    },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    timeLabel: {
      width: 34,
      fontSize: 13,
      fontWeight: "800",
      color: "#1c2b36",
    },
    timeValue: {
      fontSize: 15,
      fontWeight: "700",
      color: "#1c2b36",
    },
    etaChangeBox: {
      marginTop: 2,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 9,
      gap: 4,
    },
    etaChangeText: {
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 18,
    },
    etaDetailText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.secondaryText,
    },
    etaEarlier: {
      backgroundColor: "#ffecef",
      borderColor: "#ef9aa8",
    },
    etaEarlierText: {
      color: "#a3132f",
    },
    etaLater: {
      backgroundColor: "#eaf2ff",
      borderColor: "#93b9eb",
    },
    etaLaterText: {
      color: "#144d94",
    },
    empty: { textAlign: "center", color: colors.secondaryText, marginTop: 40 },
  });
}
