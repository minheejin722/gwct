import type { ReactNode } from "react";
import { useRef } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Link } from "expo-router";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useHeaderScrollToTop } from "../hooks/useHeaderScrollToTop";
import { useAppPreferences } from "../lib/appPreferences";

export default function MonitorMenuScreen() {
  const { colors } = useAppPreferences();
  const styles = createStyles(colors);
  const scrollRef = useRef<ScrollView | null>(null);
  const monitorCards: MonitorCardItem[] = [
    {
      href: "/monitor-gwct-eta",
      title: "GWCT ETA Monitor",
      subtitle: "Watch-window 선박 ETA 변경을 추적하고 알림 기준을 설정합니다.",
      icon: <FontAwesome5 name="ship" size={22} color={colors.accent} />,
      accentColor: colors.accent,
    },
    {
      href: "/monitor-gc-remaining",
      title: "G/C Remaining Subtotal",
      subtitle: "GC181~190 잔량 임계치와 알림 사용 여부를 설정합니다.",
      icon: <MaterialCommunityIcons name="crane" size={24} color={colors.warning} />,
      accentColor: colors.warning,
    },
    {
      href: "/monitor-equipment",
      title: "Equipment Monitor",
      subtitle: "YT 수량과 GC Cabin/Under 상태 변화를 함께 설정합니다.",
      icon: <FontAwesome5 name="truck-moving" size={20} color={colors.success} />,
      accentColor: colors.success,
    },
    {
      href: "/monitor-yeosu",
      title: "Yeosu Pilotage Monitor",
      subtitle: "여수 도선 중단/재개 감지와 알림 조건을 관리합니다.",
      icon: <MaterialCommunityIcons name="weather-windy" size={24} color={colors.danger} />,
      accentColor: colors.danger,
    },
  ];
  useHeaderScrollToTop(["monitor-tab", "monitor"], scrollRef);

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Monitoring Menu</Text>
        <Text style={styles.subtitle}>
          모니터별로 들어가서 값을 조정하고 Confirm으로 저장/활성화 Cancel로 비활성화합니다.
        </Text>
        <View style={styles.heroHintRow}>
          <View style={[styles.heroHintDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.heroHintText}>각 카드를 눌러 바로 설정 화면으로 이동</Text>
        </View>
      </View>

      <View style={styles.cardList}>
        {monitorCards.map((card) => (
          <Link key={card.href} href={card.href as never} asChild>
            <Pressable
              style={({ pressed }) => [
                styles.monitorCard,
                {
                  backgroundColor: colors.surfaceBackground,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={styles.monitorCardTop}>
                <View style={[styles.iconBadge, { backgroundColor: `${card.accentColor}18` }]}>{card.icon}</View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={[styles.cardPill, { color: card.accentColor, borderColor: `${card.accentColor}55` }]}>
                  Open Settings
                </Text>
              </View>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

interface MonitorCardItem {
  href: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  accentColor: string;
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 14, paddingBottom: 28 },
    heroCard: {
      backgroundColor: colors.elevatedBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
    },
    heroTitle: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    subtitle: { fontSize: 14, lineHeight: 18, color: colors.secondaryText },
    heroHintRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    heroHintDot: { width: 10, height: 10, borderRadius: 5 },
    heroHintText: { fontSize: 12, fontWeight: "600", color: colors.primaryText },
    cardList: { gap: 14 },
    monitorCard: {
      borderWidth: 1,
      borderRadius: 18,
      minHeight: 154,
      paddingHorizontal: 18,
      paddingVertical: 18,
      gap: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    monitorCardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      marginBottom: 2,
    },
    iconBadge: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: {
      gap: 8,
      flex: 1,
      justifyContent: "center",
      marginTop: 2,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.primaryText,
    },
    cardSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.secondaryText,
    },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginTop: 2,
    },
    cardPill: {
      fontSize: 12,
      fontWeight: "700",
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 12,
      overflow: "hidden",
    },
  });
}
