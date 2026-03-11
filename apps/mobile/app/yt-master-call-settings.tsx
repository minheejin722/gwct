import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { YtMasterCallLiveState, YtMasterCallRole } from "@gwct/shared";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TactilePressable } from "../components/TactilePressable";
import { useEndpoint } from "../hooks/useEndpoint";
import { useHeaderScrollToTop } from "../hooks/useHeaderScrollToTop";
import { useLocalDeviceId } from "../hooks/useLocalDeviceId";
import { useAppPreferences } from "../lib/appPreferences";
import { API_URLS } from "../lib/config";
import {
  clearYtMasterCallRegistration,
  saveYtMasterCallRegistration,
} from "../lib/ytMasterCall";

function masterSlotText(data: YtMasterCallLiveState | null): string {
  const used = data?.masterAssignments.length ?? 0;
  return `${used}/2 slots in use`;
}

const FOCUSED_INPUT_KEYBOARD_GAP = 24;
const FOCUSED_INPUT_SCROLL_DELAY_MS = 64;

export default function YtMasterCallSettingsScreen() {
  const { deviceId, isReady } = useLocalDeviceId();

  if (!isReady || !deviceId) {
    return (
      <View style={loadingStyles.screen}>
        <ActivityIndicator size="large" color="#1f5eff" />
        <Text style={loadingStyles.text}>YT Master Call 설정을 불러오는 중입니다...</Text>
      </View>
    );
  }

  return <YtMasterCallSettingsContent deviceId={deviceId} />;
}

function YtMasterCallSettingsContent({ deviceId }: { deviceId: string }) {
  const { colors } = useAppPreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const ytNumberFieldRef = useRef<View | null>(null);
  const nameFieldRef = useRef<View | null>(null);
  const focusedFieldRef = useRef<View | null>(null);
  const scrollOffsetYRef = useRef(0);
  const keyboardFrameYRef = useRef(Number.POSITIVE_INFINITY);
  const keyboardVisibleRef = useRef(false);
  const focusScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data, loading, error, refresh, setData } = useEndpoint<YtMasterCallLiveState>(API_URLS.ytMasterCallLive(deviceId));
  const [selectedRole, setSelectedRole] = useState<YtMasterCallRole>("driver");
  const [nameInput, setNameInput] = useState("");
  const [ytNumberInput, setYtNumberInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useHeaderScrollToTop(["yt-master-call-settings"], scrollRef);

  useEffect(() => {
    return () => {
      if (focusScrollTimeoutRef.current) {
        clearTimeout(focusScrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const keyboardShowEvent = "keyboardDidShow";
    const keyboardHideEvent = "keyboardDidHide";

    const handleKeyboardShow = (event: { endCoordinates: { screenY: number } }) => {
      keyboardVisibleRef.current = true;
      keyboardFrameYRef.current = event.endCoordinates.screenY;
      scheduleFocusedFieldScroll();
    };

    const handleKeyboardHide = () => {
      keyboardVisibleRef.current = false;
      keyboardFrameYRef.current = Number.POSITIVE_INFINITY;
      if (focusScrollTimeoutRef.current) {
        clearTimeout(focusScrollTimeoutRef.current);
        focusScrollTimeoutRef.current = null;
      }
    };

    const showSub = Keyboard.addListener(keyboardShowEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(keyboardHideEvent, handleKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!data?.registration) {
      return;
    }
    setSelectedRole(data.registration.role);
    setNameInput(data.registration.name);
    setYtNumberInput(data.registration.ytNumber ? data.registration.ytNumber.replace(/^YT-/, "") : "");
  }, [data?.registration]);

  const ensureFocusedFieldVisible = (target: View | null) => {
    if (!target || !scrollRef.current || !keyboardVisibleRef.current) {
      return;
    }

    target.measureInWindow((_x, y, _width, height) => {
      if (!height) {
        return;
      }

      const overlap = y + height - (keyboardFrameYRef.current - FOCUSED_INPUT_KEYBOARD_GAP);
      if (overlap <= 0) {
        return;
      }

      scrollRef.current?.scrollTo({
        y: Math.max(0, scrollOffsetYRef.current + overlap),
        animated: true,
      });
    });
  };

  const scheduleFocusedFieldScroll = (target: View | null = focusedFieldRef.current) => {
    focusedFieldRef.current = target;
    if (!target) {
      return;
    }
    if (focusScrollTimeoutRef.current) {
      clearTimeout(focusScrollTimeoutRef.current);
    }
    focusScrollTimeoutRef.current = setTimeout(() => {
      ensureFocusedFieldVisible(target);
      focusScrollTimeoutRef.current = null;
    }, FOCUSED_INPUT_SCROLL_DELAY_MS);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
  };

  const saveRole = async () => {
    setSaving(true);
    try {
      const saved =
        selectedRole === "master"
          ? await saveYtMasterCallRegistration({
              deviceId,
              role: "master",
              name: nameInput,
            })
          : await saveYtMasterCallRegistration({
              deviceId,
              role: "driver",
              name: nameInput,
              ytNumber: ytNumberInput,
            });
      setData(saved);
    } catch (saveError) {
      Alert.alert("저장 실패", (saveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    Alert.alert("권한 해제", "현재 등록된 YT Master Call 권한을 해제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "해제",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setClearing(true);
            try {
              const cleared = await clearYtMasterCallRegistration(deviceId);
              setData(cleared);
              setNameInput("");
              setYtNumberInput("");
              setSelectedRole("driver");
            } catch (clearError) {
              Alert.alert("해제 실패", (clearError as Error).message);
            } finally {
              setClearing(false);
            }
          })();
        },
      },
    ]);
  };

  const masterDisabled =
    data?.availableMasterSlots.length === 0 && data?.registration?.role !== "master";

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      keyboardShouldPersistTaps="handled"
      onScroll={handleScroll}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>YT Master Call</Text>
        <Text style={styles.heroText}>드라이버 또는 반장 권한을 등록하고 반장 호출 화면에서 사용할 프로필을 설정합니다.</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Current</Text>
          <Text style={styles.metaValue}>
            {data?.registration
              ? data.registration.role === "master"
                ? `${data.registration.masterSlot} / ${data.registration.name}`
                : `${data.registration.ytNumber} / ${data.registration.name}`
              : "권한 미설정"}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Master Slots</Text>
          <Text style={styles.metaValue}>{masterSlotText(data)}</Text>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>권한 선택</Text>
        <View style={styles.roleRow}>
          <TactilePressable
            style={[styles.roleOption, selectedRole === "driver" ? styles.roleOptionActive : null]}
            onPress={() => setSelectedRole("driver")}
          >
            <MaterialCommunityIcons
              name="truck"
              size={26}
              color={selectedRole === "driver" ? colors.surfaceBackground : colors.accent}
            />
            <Text style={[styles.roleOptionTitle, selectedRole === "driver" ? styles.roleOptionTitleActive : null]}>
              YT Driver
            </Text>
            <Text style={[styles.roleOptionText, selectedRole === "driver" ? styles.roleOptionTextActive : null]}>
              YT 번호와 이름을 등록합니다.
            </Text>
          </TactilePressable>

          <TactilePressable
            disabled={masterDisabled}
            style={[
              styles.roleOption,
              selectedRole === "master" ? styles.roleOptionActive : null,
              masterDisabled ? styles.roleOptionDisabled : null,
            ]}
            onPress={() => setSelectedRole("master")}
          >
            <MaterialCommunityIcons
              name="account-tie"
              size={26}
              color={selectedRole === "master" ? colors.surfaceBackground : colors.accent}
            />
            <Text style={[styles.roleOptionTitle, selectedRole === "master" ? styles.roleOptionTitleActive : null]}>
              YT Master
            </Text>
            <Text style={[styles.roleOptionText, selectedRole === "master" ? styles.roleOptionTextActive : null]}>
              이름만 등록하며 최대 2명만 가능합니다.
            </Text>
          </TactilePressable>
        </View>
        {masterDisabled ? <Text style={styles.slotWarning}>현재 YT Master 2자리가 모두 사용 중입니다.</Text> : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{selectedRole === "master" ? "YT Master 등록" : "YT Driver 등록"}</Text>
        {selectedRole === "driver" ? (
          <View ref={ytNumberFieldRef} style={styles.formGroup}>
            <Text style={styles.inputLabel}>YT 번호</Text>
            <TextInput
              value={ytNumberInput}
              onChangeText={setYtNumberInput}
              onFocus={() => scheduleFocusedFieldScroll(ytNumberFieldRef.current)}
              placeholder="예: 45"
              placeholderTextColor={colors.secondaryText}
              style={styles.input}
              autoCapitalize="characters"
            />
          </View>
        ) : null}
        <View ref={nameFieldRef} style={styles.formGroup}>
          <Text style={styles.inputLabel}>이름</Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            onFocus={() => scheduleFocusedFieldScroll(nameFieldRef.current)}
            placeholder={selectedRole === "master" ? "반장 이름" : "기사 이름"}
            placeholderTextColor={colors.secondaryText}
            style={styles.input}
          />
        </View>

        <View style={styles.buttonRow}>
          <TactilePressable
            style={[styles.primaryButton, saving ? styles.buttonDisabled : null]}
            disabled={saving}
            onPress={() => void saveRole()}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.surfaceBackground} />
            ) : (
              <Text style={styles.primaryButtonText}>등록</Text>
            )}
          </TactilePressable>

          {data?.registration ? (
            <TactilePressable
              style={[styles.secondaryButton, clearing ? styles.buttonDisabled : null]}
              disabled={clearing}
              onPress={handleClear}
            >
              {clearing ? (
                <ActivityIndicator size="small" color={colors.primaryText} />
              ) : (
                <Text style={styles.secondaryButtonText}>권한 해제</Text>
              )}
            </TactilePressable>
          ) : null}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>현재 YT Master</Text>
        {data?.masterAssignments.length ? (
          data.masterAssignments.map((master) => (
            <View key={master.slot} style={styles.masterRow}>
              <Text style={styles.masterSlot}>{master.slot}</Text>
              <Text style={styles.masterName}>{master.name}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>아직 등록된 YT Master가 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppPreferences>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.screenBackground },
    content: { padding: 16, gap: 14, paddingBottom: 28 },
    heroCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2,
    },
    heroTitle: { fontSize: 24, fontWeight: "800", color: colors.primaryText },
    heroText: { fontSize: 14, lineHeight: 20, color: colors.secondaryText },
    metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    metaLabel: { fontSize: 13, fontWeight: "700", color: colors.secondaryText },
    metaValue: { fontSize: 13, fontWeight: "700", color: colors.primaryText, flex: 1, textAlign: "right" },
    errorText: { fontSize: 13, lineHeight: 18, color: colors.danger, fontWeight: "700" },
    sectionCard: {
      backgroundColor: colors.surfaceBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2,
    },
    sectionTitle: { fontSize: 20, fontWeight: "800", color: colors.primaryText },
    roleRow: { flexDirection: "row", gap: 12 },
    roleOption: {
      flex: 1,
      minHeight: 164,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevatedBackground,
      padding: 16,
      gap: 10,
    },
    roleOptionActive: {
      backgroundColor: colors.badgeBackground,
      borderColor: colors.badgeBackground,
    },
    roleOptionDisabled: {
      opacity: 0.45,
    },
    roleOptionTitle: { fontSize: 18, fontWeight: "800", color: colors.primaryText },
    roleOptionTitleActive: { color: colors.surfaceBackground },
    roleOptionText: { fontSize: 13, lineHeight: 18, color: colors.secondaryText },
    roleOptionTextActive: { color: "rgba(255,255,255,0.86)" },
    slotWarning: { fontSize: 13, lineHeight: 18, color: colors.warning, fontWeight: "700" },
    formGroup: { gap: 8 },
    inputLabel: { fontSize: 14, fontWeight: "700", color: colors.primaryText },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 16,
      color: colors.primaryText,
      backgroundColor: colors.elevatedBackground,
    },
    buttonRow: { flexDirection: "row", gap: 10 },
    primaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: colors.badgeBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: { fontSize: 16, fontWeight: "800", color: colors.surfaceBackground },
    secondaryButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: colors.elevatedBackground,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: { fontSize: 16, fontWeight: "800", color: colors.primaryText },
    buttonDisabled: { opacity: 0.6 },
    masterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevatedBackground,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    masterSlot: { fontSize: 15, fontWeight: "800", color: colors.badgeBackground },
    masterName: { fontSize: 15, fontWeight: "700", color: colors.primaryText },
    emptyText: { fontSize: 14, lineHeight: 20, color: colors.secondaryText },
  });
}

const loadingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#eef1f5",
    padding: 24,
  },
  text: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },
});
