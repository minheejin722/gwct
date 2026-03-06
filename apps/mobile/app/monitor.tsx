import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenLinkCard } from "../components/ScreenLinkCard";
import { useAppPreferences } from "../lib/appPreferences";

export default function MonitorMenuScreen() {
  const { colors } = useAppPreferences();
  const styles = createStyles(colors);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Monitoring Menu</Text>
        <Text style={styles.subtitle}>
          Open each monitor to set values and use Confirm (save + enable) or Cancel (disable).
        </Text>
      </View>

      <ScreenLinkCard
        href="/monitor-gwct-eta"
        title="GWCT ETA Monitor"
        subtitle="Track ETA changes for top N vessels in the watch window."
      />
      <ScreenLinkCard
        href="/monitor-gc-remaining"
        title="G/C Remaining Subtotal"
        subtitle="Set per-GC threshold and enable or disable alerts for GC181~190."
      />
      <ScreenLinkCard
        href="/monitor-equipment"
        title="Equipment Monitor"
        subtitle="Configure YT count and GC180~190 Cabin/Under monitoring."
      />
      <ScreenLinkCard
        href="/monitor-yeosu"
        title="Yeosu Pilotage Monitor"
        subtitle="Enable or disable suspension/resume detection from forecast duty text."
      />
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 10 },
    headerCard: {
      backgroundColor: colors.surfaceBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 6,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    subtitle: { fontSize: 13, color: colors.secondaryText },
  });
}
