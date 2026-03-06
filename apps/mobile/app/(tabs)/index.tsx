import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Link } from "expo-router";
import { MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { useEndpoint } from "../../hooks/useEndpoint";
import { useSseAlerts } from "../../hooks/useSseAlerts";
import { useAppPreferences } from "../../lib/appPreferences";
import { API_URLS } from "../../lib/config";

interface SummaryResponse {
  lastUpdatedAt: string | null;
  trackedVesselCount: number;
  workingCraneCount: number;
  supportEquipmentLoginCount: number;
  ytLoggedInCount: number;
  weatherState: "none" | "partial" | "all";
  alertCount24h: number;
}

interface YtMinimalResponse {
  threshold: number;
}

export default function HomeScreen() {
  const { colors } = useAppPreferences();
  const styles = createStyles(colors);
  const { data, loading, refresh } = useEndpoint<SummaryResponse>(API_URLS.summary);
  const { data: ytData } = useEndpoint<YtMinimalResponse>(API_URLS.yt);
  const { connected, lastAlert } = useSseAlerts();

  const threshold = ytData?.threshold ?? 0;
  const ytCount = data?.ytLoggedInCount ?? 0;
  const isYtLow = ytCount < threshold;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <View style={styles.topBar}>
        <View style={styles.liveCard}>
          <Text style={styles.liveTitle}>실시간 스트림</Text>
          <View style={styles.liveRow}>
            <Text style={styles.liveLabel}>연결 상태 :</Text>
            <View style={[styles.statusDot, connected ? styles.dotConnected : styles.dotDisconnected]} />
            <Text style={styles.liveText}>서버 {connected ? "연결중" : "끊김"}</Text>
          </View>
          <View style={styles.liveRow}>
            <Text style={styles.liveLabel}>최근 이벤트 :</Text>
            <Text style={styles.liveText} numberOfLines={1}>
              {lastAlert ? `${lastAlert.title}` : "이벤트 없음"}
            </Text>
          </View>
        </View>
        <Link href="/alerts" asChild>
          <Pressable style={styles.bellContainer}>
            <MaterialCommunityIcons name="bell-outline" size={36} color={colors.primaryText} />
            {(data?.alertCount24h ?? 0) > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{data?.alertCount24h}</Text>
              </View>
            )}
          </Pressable>
        </Link>
      </View>

      <View style={styles.links}>
        <Link href="/yt" asChild>
          <Pressable style={styles.linkCard}>
            <Text style={styles.linkTitle}>YT 장비 현황</Text>
            <FontAwesome5 name="truck-moving" size={40} color={colors.icon} style={styles.linkIcon} />
          </Pressable>
        </Link>
        <Link href="/cranes" asChild>
          <Pressable style={styles.linkCard}>
            <Text style={styles.linkTitle}>GC 현황</Text>
            <MaterialCommunityIcons name="crane" size={44} color={colors.icon} style={styles.linkIcon} />
          </Pressable>
        </Link>
        <Link href="/equipment" asChild>
          <Pressable style={styles.linkCard}>
            <Text style={styles.linkTitle}>GC Cabin/Under 현황</Text>
            <MaterialCommunityIcons name="crane" size={44} color={colors.icon} style={styles.linkIcon} />
          </Pressable>
        </Link>
        <Link href="/vessels" asChild>
          <Pressable style={styles.linkCard}>
            <Text style={styles.linkTitle}>선박 스케줄 현황</Text>
            <FontAwesome5 name="ship" size={38} color={colors.icon} style={styles.linkIcon} />
          </Pressable>
        </Link>
        <Link href="/monitor" asChild>
          <Pressable style={styles.linkCard}>
            <Text style={styles.linkTitle}>모니터링 설정</Text>
            <Feather name="monitor" size={40} color={colors.icon} style={styles.linkIcon} />
          </Pressable>
        </Link>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.gwctCard}>
          <Text style={styles.summaryTitle}>GWCT</Text>
          <View style={styles.summaryRow}>
            <FontAwesome5 name="ship" size={12} color={colors.icon} />
            <Text style={styles.summaryText}>선박 ETA 추적 : {data?.trackedVesselCount ?? 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons name="crane" size={14} color={colors.icon} />
            <Text style={styles.summaryText}>GC 작업중 : {data?.workingCraneCount ?? 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <FontAwesome5 name="truck" size={12} color={colors.icon} />
            <Text style={styles.summaryText}>야드 장비 로그인 : {data?.supportEquipmentLoginCount ?? 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <FontAwesome5 name="user-tie" size={14} color={colors.icon} />
            <Text style={styles.summaryText}>
              도선 상태{" "}
              <Text
                style={{
                  color: data?.weatherState === "none" ? colors.success : colors.danger,
                  fontWeight: "bold",
                }}
              >
                {data?.weatherState === "none" ? "근무" : "중단"}
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.ytCard}>
          <Text style={styles.ytTitle}>YT</Text>
          <Text style={[styles.ytNumber, isYtLow ? styles.ytNumberLow : styles.ytNumberNormal]}>{ytCount}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, paddingTop: 60, gap: 14, paddingBottom: 24 },
    topBar: { flexDirection: "row", alignItems: "center", gap: 12 },
    liveCard: {
      flex: 1,
      backgroundColor: colors.elevatedBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 4,
    },
    liveTitle: { fontSize: 15, fontWeight: "700", color: colors.primaryText, marginBottom: 2 },
    liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    liveLabel: { fontSize: 13, color: colors.primaryText, fontWeight: "600" },
    liveText: { fontSize: 13, color: colors.primaryText, flex: 1 },
    statusDot: { width: 12, height: 12, borderRadius: 6 },
    dotConnected: { backgroundColor: colors.badgeBackground },
    dotDisconnected: { backgroundColor: colors.danger },
    bellContainer: {
      padding: 4,
      marginBottom: 4,
      marginRight: 4,
      position: "relative",
      justifyContent: "center",
      alignItems: "center",
    },
    badge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: colors.badgeBackground,
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
    links: { gap: 12, marginTop: 4, flex: 1, justifyContent: "space-between" },
    linkCard: {
      flexDirection: "row",
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "space-between",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    linkTitle: { fontSize: 22, fontWeight: "bold", color: colors.primaryText, flex: 1, textAlign: "center" },
    linkIcon: { opacity: 0.85 },
    bottomRow: { flexDirection: "row", gap: 12, marginTop: 8 },
    gwctCard: {
      flex: 1.2,
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      padding: 16,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryTitle: { fontSize: 28, fontWeight: "800", color: colors.primaryText, marginBottom: 2 },
    summaryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    summaryText: { fontSize: 14, color: colors.primaryText, fontWeight: "700" },
    ytCard: {
      flex: 0.8,
      backgroundColor: colors.surfaceBackground,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ytTitle: { fontSize: 28, fontWeight: "600", color: colors.primaryText, marginBottom: 4 },
    ytNumber: { fontSize: 62, fontWeight: "300", letterSpacing: -2 },
    ytNumberNormal: { color: colors.primaryText },
    ytNumberLow: { color: colors.danger },
  });
}
