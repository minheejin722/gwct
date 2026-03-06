import { Pressable, StyleSheet, Text } from "react-native";
import { Link } from "expo-router";
import { useAppPreferences } from "../lib/appPreferences";

interface ScreenLinkCardProps {
  href: string;
  title: string;
  subtitle: string;
}

export function ScreenLinkCard({ href, title, subtitle }: ScreenLinkCardProps) {
  const { colors } = useAppPreferences();

  return (
    <Link href={href as never} asChild>
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: colors.elevatedBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.primaryText }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
  },
});
