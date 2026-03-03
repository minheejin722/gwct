import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

interface ScreenLinkCardProps {
  href: string;
  title: string;
  subtitle: string;
}

export function ScreenLinkCard({ href, title, subtitle }: ScreenLinkCardProps) {
  return (
    <Link href={href as never} asChild>
      <Pressable style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f4f9ff",
    borderWidth: 1,
    borderColor: "#c7dbef",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#14304f",
  },
  subtitle: {
    fontSize: 13,
    color: "#355c7f",
  },
});
