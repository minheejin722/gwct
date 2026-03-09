import type { ComponentProps } from "react";
import { useRef } from "react";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated, GestureResponderEvent, Pressable, StyleSheet } from "react-native";
import { useAppPreferences } from "../../lib/appPreferences";

type TabIconName = ComponentProps<typeof Ionicons>["name"];

type TabIconConfig = {
  active: TabIconName;
  inactive: TabIconName;
  size: number;
};

const TAB_ICONS: Record<string, TabIconConfig> = {
  index: { active: "home", inactive: "home-outline", size: 24 },
  "monitor-tab": { active: "grid", inactive: "grid-outline", size: 24 },
  worktime: { active: "person", inactive: "person-outline", size: 26 },
  "status-tab": { active: "construct", inactive: "construct-outline", size: 24 },
  settings: { active: "settings", inactive: "settings-outline", size: 24 },
};
function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    tabButton: {
      flex: 1,
      marginHorizontal: 6,
      marginTop: 0,
      marginBottom: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    tabButtonInner: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 2,
    },
    tabBarLabel: {
      fontSize: 10,
      fontWeight: "700",
      marginTop: 3,
    },
    tabBarStyle: {
      height: 89,
      paddingBottom: 19,
      paddingTop: 4,
      borderTopWidth: 1.5,
      borderTopColor: colors.border,
      elevation: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      backgroundColor: colors.tabBackground,
    },
  });
}

function TabBarButton(
  props: BottomTabBarButtonProps & {
    colors: ReturnType<typeof useAppPreferences>["colors"];
  },
) {
  const {
    accessibilityHint,
    accessibilityLabel,
    accessibilityLargeContentTitle,
    accessibilityRole,
    accessibilityState,
    children,
    colors,
    delayLongPress,
    onLongPress,
    onPress,
    onPressIn,
    onPressOut,
    style,
    testID,
  } = props;
  const styles = createStyles(colors);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (event: GestureResponderEvent) => {
    Animated.spring(scale, {
      toValue: 0.82,
      stiffness: 560,
      damping: 26,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    Animated.spring(scale, {
      toValue: 1,
      stiffness: 430,
      damping: 20,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
    onPressOut?.(event);
  };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityLargeContentTitle={accessibilityLargeContentTitle}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      delayLongPress={delayLongPress}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={testID}
      style={[styles.tabButton, style]}
    >
      <Animated.View
        style={[
          styles.tabButtonInner,
          {
            transform: [{ scale }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

function buildTabIcon(config: TabIconConfig) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? config.active : config.inactive} size={config.size} color={color} />
  );
}

export default function TabLayout() {
  const { colors } = useAppPreferences();
  const styles = createStyles(colors);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.accent },
        headerTintColor: colors.surfaceBackground,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarStyle: styles.tabBarStyle,
        sceneStyle: {
          backgroundColor: colors.screenBackground,
        },
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarButton: (props) => <TabBarButton {...props} colors={colors} />,
        tabBarIcon: buildTabIcon(TAB_ICONS[route.name] || TAB_ICONS.index),
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="monitor-tab"
        options={{
          title: "Monitoring",
          headerStyle: { backgroundColor: colors.screenBackground },
          headerTintColor: colors.primaryText,
          headerTitleStyle: { color: colors.primaryText, fontWeight: "700" },
          headerShadowVisible: false,
        }}
      />

      <Tabs.Screen
        name="worktime"
        options={{
          title: "Work",
          headerStyle: { backgroundColor: colors.screenBackground },
          headerTintColor: colors.primaryText,
          headerTitleStyle: { color: colors.primaryText, fontWeight: "700" },
          headerShadowVisible: false,
        }}
      />

      <Tabs.Screen
        name="status-tab"
        options={{
          title: "Status",
          headerStyle: { backgroundColor: colors.screenBackground },
          headerTintColor: colors.primaryText,
          headerTitleStyle: { color: colors.primaryText, fontWeight: "700" },
          headerShadowVisible: false,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerStyle: { backgroundColor: colors.screenBackground },
          headerTintColor: colors.primaryText,
          headerTitleStyle: { color: colors.primaryText, fontWeight: "700" },
          headerShadowVisible: false,
        }}
      />

      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
          title: "Events",
          headerStyle: { backgroundColor: colors.screenBackground },
          headerTintColor: colors.primaryText,
          headerTitleStyle: { color: colors.primaryText, fontWeight: "700" },
          headerShadowVisible: false,
        }}
      />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
