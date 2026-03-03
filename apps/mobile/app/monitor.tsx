import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenLinkCard } from "../components/ScreenLinkCard";

export default function MonitorMenuScreen() {
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
        subtitle="Configure YT count and GC180~190 driver/HK monitoring."
      />
      <ScreenLinkCard
        href="/monitor-yeosu"
        title="Yeosu Pilotage Monitor"
        subtitle="Enable or disable suspension/resume detection from forecast duty text."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef4fb" },
  content: { padding: 16, gap: 10 },
  headerCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e4f0",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#123a5e" },
  subtitle: { fontSize: 13, color: "#2d5578" },
});
