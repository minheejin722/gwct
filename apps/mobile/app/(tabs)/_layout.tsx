import type { ComponentProps, ReactElement } from "react";
import { useRef } from "react";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Animated, GestureResponderEvent, Pressable, StyleSheet } from "react-native";
import { CranesTabSvgIcon } from "../../components/CranesTabSvgIcon";
import { HeaderScrollTitle } from "../../components/HeaderScrollTitle";
import { useAppPreferences } from "../../lib/appPreferences";
import { emitTabScrollToTop } from "../../lib/tabScrollToTop";

type TabIconName = ComponentProps<typeof Ionicons>["name"];
type TabIconRenderer = ({ color, focused }: { color: string; focused: boolean }) => ReactElement;

function buildIoniconRenderer(active: TabIconName, inactive: TabIconName, size: number): TabIconRenderer {
  return ({ color, focused }) => <Ionicons name={focused ? active : inactive} size={size} color={color} />;
}

const TAB_ICONS: Record<string, TabIconRenderer> = {
  index: buildIoniconRenderer("home", "home-outline", 24),
  "monitor-tab": buildIoniconRenderer("grid", "grid-outline", 24),
  worktime: buildIoniconRenderer("person", "person-outline", 26),
  "status-tab": ({ color }) => <CranesTabSvgIcon color={color} size={26} />,
  settings: buildIoniconRenderer("settings", "settings-outline", 24),
};

const TAB_TITLES: Record<string, string> = {
  index: "Home",
  "monitor-tab": "Monitoring",
  worktime: "Work",
  "status-tab": "Cranes",
  settings: "Settings",
  alerts: "Events",
};

const TAB_RESELECT_WINDOW_MS = 340;

let lastScrollableTabTap: { routeName: "worktime" | "status-tab" | null; at: number } = {
  routeName: null,
  at: 0,
};

function handleScrollableTabPress(routeName: string, focused: boolean) {
  const isScrollableTab = routeName === "worktime" || routeName === "status-tab";
  const now = Date.now();

  if (focused && isScrollableTab) {
    if (lastScrollableTabTap.routeName === routeName && now - lastScrollableTabTap.at <= TAB_RESELECT_WINDOW_MS) {
      emitTabScrollToTop(routeName);
      lastScrollableTabTap = { routeName: null, at: 0 };
      return;
    }

    lastScrollableTabTap = { routeName, at: now };
    return;
  }

  lastScrollableTabTap = { routeName: null, at: 0 };
}
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
        headerTitle:
          route.name === "index"
            ? undefined
            : () => <HeaderScrollTitle routeKey={route.name} title={TAB_TITLES[route.name] || route.name} color={colors.primaryText} />,
        tabBarButton: (props) => <TabBarButton {...props} colors={colors} />,
        tabBarIcon: TAB_ICONS[route.name] || TAB_ICONS.index,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            handleScrollableTabPress("index", navigation.isFocused());
          },
        })}
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
        listeners={({ navigation }) => ({
          tabPress: () => {
            handleScrollableTabPress("monitor-tab", navigation.isFocused());
          },
        })}
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
        listeners={({ navigation }) => ({
          tabPress: () => {
            handleScrollableTabPress("worktime", navigation.isFocused());
          },
        })}
      />

      <Tabs.Screen
        name="status-tab"
        options={{
          title: "Cranes",
          headerStyle: { backgroundColor: colors.screenBackground },
          headerTintColor: colors.primaryText,
          headerTitleStyle: { color: colors.primaryText, fontWeight: "700" },
          headerShadowVisible: false,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            handleScrollableTabPress("status-tab", navigation.isFocused());
          },
        })}
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
        listeners={({ navigation }) => ({
          tabPress: () => {
            handleScrollableTabPress("settings", navigation.isFocused());
          },
        })}
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
