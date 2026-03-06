import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f3b63" },
        headerTintColor: "#fff",
        tabBarActiveTintColor: "#0f3b63",
        tabBarInactiveTintColor: "#5d7892",
        tabBarStyle: { 
          height: 65, 
          paddingBottom: 8, 
          paddingTop: 8,
          borderTopWidth: 1.5,
          borderTopColor: "rgba(0,0,0,0.15)",
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "홈 버튼",
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />
        }} 
      />
      
      <Tabs.Screen 
        name="monitor-tab"
        options={{ 
          title: "모니터링 버튼",
          href: "/monitor",
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={24} color={color} />
        }} 
      />
      
      <Tabs.Screen 
        name="refresh-tab" 
        options={{ 
          title: "새로고침 버튼",
          href: "/", // Returns to home, user can swipe to refresh there
          tabBarIcon: ({ color }) => <Ionicons name="refresh" size={28} color={color} />
        }} 
      />
      
      <Tabs.Screen 
        name="status-tab" 
        options={{ 
          title: "GC/Underman/YT/TC 각각 현황",
          href: "/equipment", 
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />
        }} 
      />
      
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: "알람/배너/다크 or 일반 모드설정",
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />
        }} 
      />
      
      {/* Hide original alert & two tabs from bar but keep routable */}
      <Tabs.Screen name="alerts" options={{ href: null, title: "이벤트 로그" }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
