import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppPreferences } from "../../lib/appPreferences";

export default function TabLayout() {
  const { colors } = useAppPreferences();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.accent },
        headerTintColor: colors.surfaceBackground,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarStyle: {
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 1.5,
          borderTopColor: colors.border,
          elevation: 10,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          backgroundColor: colors.tabBackground,
        },
        sceneStyle: {
          backgroundColor: colors.screenBackground,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="monitor-tab"
        options={{
          title: "Monitor",
          href: "/monitor",
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="refresh-tab"
        options={{
          title: "Refresh",
          href: "/",
          tabBarIcon: ({ color }) => <Ionicons name="refresh" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="status-tab"
        options={{
          title: "Status",
          href: "/equipment",
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />

      <Tabs.Screen name="alerts" options={{ href: null, title: "Events" }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
