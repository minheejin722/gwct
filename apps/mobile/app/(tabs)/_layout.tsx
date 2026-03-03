import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f3b63" },
        headerTintColor: "#fff",
        tabBarActiveTintColor: "#0f3b63",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "홈" }} />
      <Tabs.Screen name="alerts" options={{ title: "이벤트 로그" }} />
      <Tabs.Screen name="settings" options={{ title: "모니터링" }} />
    </Tabs>
  );
}
