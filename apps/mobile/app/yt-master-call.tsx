import type { ComponentProps, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Animated as NativeAnimated,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  formatYtMasterCallReasonDisplay,
  getYtMasterCallArchiveKind,
  isYtMasterCallDayOffDateValue,
  getYtMasterCallReasonDetailLabel,
  YT_MASTER_CALL_OTHER_SUBREASON_LABELS,
  YT_MASTER_CALL_TRACTOR_SUBREASON_LABELS,
  YT_MASTER_CALL_REASON_LABELS,
  type YtMasterCallArchiveKind,
  type YtMasterCallLiveState,
  type YtMasterCallOtherSubreason,
  type YtMasterCallReasonDetailCode,
  type YtMasterCallQueueEntry,
  type YtMasterCallReason,
  type YtMasterCallTractorSubreason,
} from "@gwct/shared";
import { Link } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { TactilePressable } from "../components/TactilePressable";
import { useEndpoint } from "../hooks/useEndpoint";
import { useHeaderScrollToTop } from "../hooks/useHeaderScrollToTop";
import { useLocalDeviceId } from "../hooks/useLocalDeviceId";
import { API_URLS } from "../lib/config";
import {
  cancelYtMasterCall,
  createYtMasterCall,
  decideYtMasterCall,
  saveYtMasterCallRegistration,
  updateYtMasterCallVisibility,
} from "../lib/ytMasterCall";

const COLORS = {
  screen: "#ececf1",
  surface: "#ffffff",
  text: "#0d0d0f",
  subtext: "#6d6d74",
  blue: "#117cff",
  blueSoft: "#d9e9ff",
  green: "#37c964",
  red: "#ff4b42",
  line: "#dcdce2",
  shadow: "#0c1020",
};

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const REASON_OPTIONS: Array<{ code: YtMasterCallReason; icon: MaterialIconName }> = [
  { code: "tractor_inspection", icon: "tractor" },
  { code: "restroom", icon: "human-male-female" },
  { code: "other", icon: "dots-horizontal" },
];

type MasterQueueSortField = "name" | "type" | "date";
type MasterQueueSortDirection = "asc" | "desc";
type DayOffDatePoint = { year: number; month: number; day: number };
type DayOffDateDraft = { year: number; month: number; selectedDateValues: string[] };

const MASTER_QUEUE_SORT_FIELDS: Array<{ field: MasterQueueSortField; label: string }> = [
  { field: "name", label: "이름" },
  { field: "type", label: "종류" },
  { field: "date", label: "날짜" },
];

const DAY_OFF_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const DUPLICATE_LOCK_MESSAGE = "같은 사유로 이미 메세지가 도달했습니다.";
const DUPLICATE_LOCK_TOAST_HOLD_MS = 1080;
const DUPLICATE_LOCK_MESSAGE_MATCH = "같은 사유로 이미 메세지가 도달했습니다";

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function createDefaultDayOffDatePoint(): DayOffDatePoint {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function dayOffDatePointToTimestamp(value: DayOffDatePoint): number {
  return new Date(value.year, value.month - 1, value.day).getTime();
}

function normalizeDayOffDatePoint(value: DayOffDatePoint): DayOffDatePoint {
  return {
    ...value,
    day: Math.min(value.day, getDaysInMonth(value.year, value.month)),
  };
}

function createDefaultDayOffDateDraft(): DayOffDateDraft {
  const today = createDefaultDayOffDatePoint();
  return {
    year: today.year,
    month: today.month,
    selectedDateValues: [],
  };
}

function parseDayOffDatePoint(value: string): DayOffDatePoint | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function buildDayOffDatePointValue(value: DayOffDatePoint): string {
  return `${value.year}-${padTwoDigits(value.month)}-${padTwoDigits(value.day)}`;
}

function expandDayOffDateRange(start: DayOffDatePoint, end: DayOffDatePoint): string[] {
  const values: string[] = [];
  for (
    let cursor = new Date(start.year, start.month - 1, start.day);
    cursor.getTime() <= dayOffDatePointToTimestamp(end);
    cursor.setDate(cursor.getDate() + 1)
  ) {
    values.push(
      buildDayOffDatePointValue({
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
        day: cursor.getDate(),
      }),
    );
  }
  return values;
}

function normalizeDayOffDateValues(values: string[]): string[] {
  return [...new Set(values)]
    .filter((item) => isYtMasterCallDayOffDateValue(item))
    .sort((left, right) => left.localeCompare(right));
}

function parseDayOffDateValue(value: string | null | undefined): DayOffDateDraft | null {
  if (!value || !isYtMasterCallDayOffDateValue(value)) {
    return null;
  }

  let selectedDateValues: string[] = [];
  if (value.includes(",")) {
    selectedDateValues = normalizeDayOffDateValues(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  } else if (value.includes("~")) {
    const [startValue, endValue] = value.split("~").map((item) => item.trim());
    const start = parseDayOffDatePoint(startValue);
    const end = parseDayOffDatePoint(endValue);
    if (!start || !end) {
      return null;
    }
    selectedDateValues = expandDayOffDateRange(start, end);
  } else {
    selectedDateValues = [value.trim()];
  }

  const anchorPoint =
    parseDayOffDatePoint(selectedDateValues[0] || "") || createDefaultDayOffDatePoint();
  return {
    year: anchorPoint.year,
    month: anchorPoint.month,
    selectedDateValues,
  };
}

function buildDayOffDateValue(draft: DayOffDateDraft): string {
  return normalizeDayOffDateValues(draft.selectedDateValues).join(",");
}

function reasonIconName(reasonCode: YtMasterCallReason): MaterialIconName {
  if (reasonCode === "tractor_inspection") {
    return "tractor";
  }
  if (reasonCode === "restroom") {
    return "human-male-female";
  }
  if (reasonCode === "emergency_accident") {
    return "alarm-light";
  }
  return "dots-horizontal";
}

const TRACTOR_SUBREASON_GROUPS: Array<{
  key: string;
  title: string;
  items: readonly YtMasterCallTractorSubreason[];
}> = [
  {
    key: "tire-wheel",
    title: "타이어 / 볼트",
    items: ["first_axle_tire_wire", "flat_tire", "wheel_detached", "base_bolt", "wheel_bolt_break_3plus", "hub_oil_leak"],
  },
  {
    key: "oil-leak",
    title: "오일 / 누유 / 연료",
    items: ["engine_oil", "mission_oil", "hydraulic_oil", "power_oil", "fueling", "undercarriage_oil_leak", "air_leak"],
  },
  {
    key: "engine-start",
    title: "시동 / 엔진 / 냉각",
    items: ["coolant", "engine_stall", "starting_failure"],
  },
  {
    key: "cabin-electric",
    title: "실내 / 전장",
    items: ["air_conditioner", "heater", "radio_failure", "light_replacement", "battery_discharge", "dashcam", "drowsiness_prevention_device"],
  },
  {
    key: "safety-structure",
    title: "안전 / 외관 / 하부",
    items: [
      "window_damage",
      "top_tilting_failure",
      "mirror_replacement",
      "spring_break_3plus",
      "mirror_bolt_tightening",
      "seatbelt",
      "spring_equalizer_detachment",
    ],
  },
];

const OTHER_SUBREASON_GROUPS: Array<{
  key: string;
  title: string;
  items: readonly YtMasterCallOtherSubreason[];
}> = [
  {
    key: "personal",
    title: "개인 / 일정",
    items: [
      "tea_time",
      "day_off_schedule",
      "outing",
      "individual_counseling",
      "suggestion",
      "wash_face",
      "cold_water",
    ],
  },
  {
    key: "gc-cabin",
    title: "GC 고발",
    items: [
      "gc181_cabin_report",
      "gc182_cabin_report",
      "gc183_cabin_report",
      "gc184_cabin_report",
      "gc185_cabin_report",
      "gc186_cabin_report",
      "gc187_cabin_report",
      "gc188_cabin_report",
      "gc189_cabin_report",
      "gc190_cabin_report",
    ],
  },
  {
    key: "bad-manners",
    title: "고발",
    items: ["tc_bad_manners_report", "reach_bad_manners_report", "under_bad_manners_report"],
  },
  {
    key: "safety",
    title: "위험 / 현장",
    items: [
      "lashingman_danger",
      "inspection_danger",
      "yard_container_first_lane_first_tier_protrusion",
    ],
  },
  {
    key: "shuttle",
    title: "셔틀 / 작업 종료",
    items: ["shift_shuttle", "lunch_shuttle", "transshipment_done", "vessel_done"],
  },
];

const PENDING_LOADER_SIZE = 112;
const PENDING_LOADER_DOT_SIZE = 11;
const PENDING_LOADER_RADIUS = 43;
const PENDING_LOADER_DOTS = Array.from({ length: 16 }, (_, index) => {
  const angle = -Math.PI / 2 + (index / 16) * Math.PI * 2;
  const progress = index / 15;
  return {
    left: PENDING_LOADER_SIZE / 2 + Math.cos(angle) * PENDING_LOADER_RADIUS - PENDING_LOADER_DOT_SIZE / 2,
    top: PENDING_LOADER_SIZE / 2 + Math.sin(angle) * PENDING_LOADER_RADIUS - PENDING_LOADER_DOT_SIZE / 2,
    opacity: 1 - progress * 0.78,
    scale: 1 - progress * 0.28,
  };
});

function PendingOrbitLoader() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1550,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(rotation);
      rotation.value = 0;
    };
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={pendingLoaderStyles.wrap}>
      <Animated.View style={[pendingLoaderStyles.ring, animatedStyle]}>
        {PENDING_LOADER_DOTS.map((dot, index) => (
          <View
            key={index}
            style={[
              pendingLoaderStyles.dot,
              {
                left: dot.left,
                top: dot.top,
                opacity: dot.opacity,
                transform: [{ scale: dot.scale }],
              },
            ]}
          />
        ))}
      </Animated.View>
      <View style={pendingLoaderStyles.centerBadge}>
        <MaterialCommunityIcons name="timer-sand" size={38} color={COLORS.blue} />
      </View>
    </View>
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const meridiem = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${meridiem}`;
}

function formatStatusText(status: YtMasterCallQueueEntry["status"]): string {
  if (status === "approved") {
    return "승인됨";
  }
  if (status === "rejected") {
    return "거절됨";
  }
  if (status === "acknowledged") {
    return "확인됨";
  }
  if (status === "sent") {
    return "메시지";
  }
  return "대기 중";
}

function statusTone(status: YtMasterCallQueueEntry["status"]) {
  if (status === "approved") {
    return COLORS.green;
  }
  if (status === "rejected") {
    return COLORS.red;
  }
  if (status === "acknowledged") {
    return COLORS.blue;
  }
  if (status === "sent") {
    return COLORS.blue;
  }
  return COLORS.subtext;
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function formatCallReasonText(call: Pick<YtMasterCallQueueEntry, "reasonLabel" | "reasonDetailLabel">): string {
  return formatYtMasterCallReasonDisplay(call.reasonLabel, call.reasonDetailLabel);
}

function isDuplicateLockErrorMessage(value: string | null | undefined): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.includes(DUPLICATE_LOCK_MESSAGE_MATCH);
}

function isUnresolvedCall(call: Pick<YtMasterCallQueueEntry, "status">): boolean {
  return call.status === "pending" || call.status === "sent";
}

function compareCreatedDesc(left: YtMasterCallQueueEntry, right: YtMasterCallQueueEntry): number {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function compareCreatedAsc(left: YtMasterCallQueueEntry, right: YtMasterCallQueueEntry): number {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function compareTextAsc(left: string, right: string): number {
  return left.localeCompare(right, "ko");
}

function sortDirectionLabel(field: MasterQueueSortField, direction: MasterQueueSortDirection): string {
  if (field === "date") {
    return direction === "desc" ? "최신 항목 순" : "오래된 항목 순";
  }
  return direction === "asc" ? "오름차순" : "내림차순";
}

function sortFieldLabel(field: MasterQueueSortField): string {
  return MASTER_QUEUE_SORT_FIELDS.find((item) => item.field === field)?.label || "날짜";
}

function defaultSortDirection(field: MasterQueueSortField): MasterQueueSortDirection {
  return field === "date" ? "desc" : "asc";
}

function toggleSortDirection(direction: MasterQueueSortDirection): MasterQueueSortDirection {
  return direction === "asc" ? "desc" : "asc";
}

function sortMasterQueue(
  calls: YtMasterCallQueueEntry[],
  field: MasterQueueSortField,
  direction: MasterQueueSortDirection,
): YtMasterCallQueueEntry[] {
  const sorted = [...calls];
  sorted.sort((left, right) => {
    if (field === "date") {
      return direction === "desc" ? compareCreatedDesc(left, right) : compareCreatedAsc(left, right);
    }

    let sortGap = 0;
    if (field === "name") {
      sortGap = compareTextAsc(left.driverName, right.driverName);
      if (sortGap === 0) {
        sortGap = compareTextAsc(left.ytNumber, right.ytNumber);
      }
    } else {
      sortGap = compareTextAsc(formatCallReasonText(left), formatCallReasonText(right));
    }

    if (sortGap !== 0) {
      return direction === "asc" ? sortGap : -sortGap;
    }

    return compareCreatedDesc(left, right);
  });
  return sorted;
}

function archiveTitle(kind: YtMasterCallArchiveKind): string {
  return kind === "tractor_inspection" ? "트랙터 점검 보관함" : "기타 사유 보관함";
}

function SwipeableQueueCard({
  children,
  disabled,
  actionLabel,
  onSwipeAction,
}: {
  children: ReactNode;
  disabled?: boolean;
  actionLabel: string;
  onSwipeAction: () => void;
}) {
  const translateX = useRef(new NativeAnimated.Value(0)).current;

  const resetPosition = () => {
    NativeAnimated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      stiffness: 220,
      damping: 24,
      mass: 0.78,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          !disabled &&
          gestureState.dx < -12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) + 6,
        onPanResponderMove: (_event, gestureState) => {
          translateX.setValue(Math.max(-140, Math.min(0, gestureState.dx)));
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx <= -92) {
            NativeAnimated.timing(translateX, {
              toValue: -240,
              duration: 160,
              useNativeDriver: true,
            }).start(({ finished }) => {
              translateX.setValue(0);
              if (finished) {
                onSwipeAction();
              }
            });
            return;
          }
          resetPosition();
        },
        onPanResponderTerminate: resetPosition,
      }),
    [disabled, onSwipeAction, translateX],
  );

  return (
    <View style={swipeQueueStyles.wrap}>
      <View style={swipeQueueStyles.background}>
        <Text style={swipeQueueStyles.backgroundLabel}>{actionLabel}</Text>
      </View>
      <NativeAnimated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <View>
          {children}
        </View>
      </NativeAnimated.View>
    </View>
  );
}

export default function YtMasterCallScreen() {
  const { deviceId, isReady } = useLocalDeviceId();

  if (!isReady || !deviceId) {
    return (
      <View style={loadingStyles.screen}>
        <ActivityIndicator size="large" color={COLORS.blue} />
        <Text style={loadingStyles.text}>반장 호출 화면을 준비 중입니다...</Text>
      </View>
    );
  }

  return <YtMasterCallContent deviceId={deviceId} />;
}

function YtMasterCallContent({ deviceId }: { deviceId: string }) {
  const styles = useMemo(() => createStyles(), []);
  const scrollRef = useRef<ScrollView | null>(null);
  const { data, loading, error, refresh, setData } = useEndpoint<YtMasterCallLiveState>(
    API_URLS.ytMasterCallLive(deviceId),
    {
      pollMs: 15000,
      liveEvents: ["yt_master_call_role_updated", "yt_master_call_changed"],
    },
  );
  const [selectedReason, setSelectedReason] = useState<YtMasterCallReason>("tractor_inspection");
  const [selectedTractorSubreasonCode, setSelectedTractorSubreasonCode] =
    useState<YtMasterCallTractorSubreason | null>(null);
  const [selectedOtherSubreasonCode, setSelectedOtherSubreasonCode] =
    useState<YtMasterCallOtherSubreason | null>(null);
  const [selectedOtherSubreasonValue, setSelectedOtherSubreasonValue] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [actingCallId, setActingCallId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [masterSortField, setMasterSortField] = useState<MasterQueueSortField>("date");
  const [masterSortDirection, setMasterSortDirection] = useState<MasterQueueSortDirection>("desc");
  const [masterMenuVisible, setMasterMenuVisible] = useState(false);
  const [archiveView, setArchiveView] = useState<YtMasterCallArchiveKind | null>(null);
  const [detailPickerReason, setDetailPickerReason] = useState<"tractor_inspection" | "other" | null>(null);
  const [dayOffDatePickerVisible, setDayOffDatePickerVisible] = useState(false);
  const [dayOffDateDraft, setDayOffDateDraft] = useState<DayOffDateDraft>(() => createDefaultDayOffDateDraft());
  const [dayOffDateReturnToOtherDetailPicker, setDayOffDateReturnToOtherDetailPicker] = useState(false);
  const [driverEditVisible, setDriverEditVisible] = useState(false);
  const [driverYtNumberDraft, setDriverYtNumberDraft] = useState("");
  const [driverEditError, setDriverEditError] = useState<string | null>(null);
  const [savingDriverYtNumber, setSavingDriverYtNumber] = useState(false);
  const [driverEditMounted, setDriverEditMounted] = useState(false);
  const [duplicateLockToastVisible, setDuplicateLockToastVisible] = useState(false);
  const driverEditProgress = useSharedValue(0);
  const driverEditInputRef = useRef<TextInput | null>(null);
  const driverEditFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driverEditCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driverEditKeyboardVisibleRef = useRef(false);
  const driverEditClosingRef = useRef(false);
  const driverEditDismissKeyboardAfterCloseRef = useRef(false);
  const detailLongPressHandledReasonRef = useRef<"tractor_inspection" | "other" | null>(null);
  const detailLongPressResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duplicateLockToastOpacity = useRef(new NativeAnimated.Value(0)).current;
  const duplicateLockToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMaster = data?.registration?.role === "master";
  const inlineActionError = isDuplicateLockErrorMessage(actionError) ? null : actionError;

  useHeaderScrollToTop(["yt-master-call"], scrollRef);

  useEffect(() => {
    if (data?.registration?.role !== "driver") {
      return;
    }
    setDriverYtNumberDraft(data.registration.ytNumber ? data.registration.ytNumber.replace(/^YT-/, "") : "");
  }, [data?.registration]);

  useEffect(() => {
    if (!isDuplicateLockErrorMessage(actionError)) {
      return;
    }

    if (duplicateLockToastTimeoutRef.current) {
      clearTimeout(duplicateLockToastTimeoutRef.current);
      duplicateLockToastTimeoutRef.current = null;
    }

    duplicateLockToastOpacity.stopAnimation();
    duplicateLockToastOpacity.setValue(0);
    setDuplicateLockToastVisible(true);

    NativeAnimated.timing(duplicateLockToastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      duplicateLockToastTimeoutRef.current = setTimeout(() => {
        duplicateLockToastTimeoutRef.current = null;
        NativeAnimated.timing(duplicateLockToastOpacity, {
          toValue: 0,
          duration: 340,
          useNativeDriver: true,
        }).start(({ finished: fadeFinished }) => {
          if (fadeFinished) {
            setDuplicateLockToastVisible(false);
          }
        });
      }, DUPLICATE_LOCK_TOAST_HOLD_MS);
    });
  }, [actionError, duplicateLockToastOpacity]);

  useEffect(() => {
    return () => {
      if (duplicateLockToastTimeoutRef.current) {
        clearTimeout(duplicateLockToastTimeoutRef.current);
        duplicateLockToastTimeoutRef.current = null;
      }
      duplicateLockToastOpacity.stopAnimation();
    };
  }, [duplicateLockToastOpacity]);

  useEffect(() => {
    cancelAnimation(driverEditProgress);

    if (driverEditVisible) {
      setDriverEditMounted(true);
      driverEditProgress.value = 0;
      driverEditProgress.value = withSpring(1, {
        damping: 20,
        stiffness: 320,
        mass: 0.82,
      });
      return;
    }

    if (!driverEditMounted) {
      return;
    }

    driverEditProgress.value = withTiming(
      0,
      {
        duration: 120,
        easing: Easing.out(Easing.quad),
      },
      (finished) => {
        if (finished) {
          runOnJS(finalizeDriverEditClose)();
        }
      },
    );
  }, [driverEditMounted, driverEditProgress, driverEditVisible]);

  useEffect(() => {
    if (driverEditFocusTimeoutRef.current) {
      clearTimeout(driverEditFocusTimeoutRef.current);
      driverEditFocusTimeoutRef.current = null;
    }

    if (!driverEditVisible) {
      return;
    }

    driverEditFocusTimeoutRef.current = setTimeout(() => {
      driverEditInputRef.current?.focus();
      driverEditFocusTimeoutRef.current = null;
    }, 185);

    return () => {
      if (driverEditFocusTimeoutRef.current) {
        clearTimeout(driverEditFocusTimeoutRef.current);
        driverEditFocusTimeoutRef.current = null;
      }
    };
  }, [driverEditVisible]);

  useEffect(() => {
    const markKeyboardShown = () => {
      driverEditKeyboardVisibleRef.current = true;
    };

    const markKeyboardHidden = () => {
      driverEditKeyboardVisibleRef.current = false;
    };

    const showSub = Keyboard.addListener("keyboardDidShow", markKeyboardShown);
    const hideSub = Keyboard.addListener("keyboardDidHide", markKeyboardHidden);

    return () => {
      showSub.remove();
      hideSub.remove();
      if (driverEditCloseTimeoutRef.current) {
        clearTimeout(driverEditCloseTimeoutRef.current);
        driverEditCloseTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (detailLongPressResetTimeoutRef.current) {
        clearTimeout(detailLongPressResetTimeoutRef.current);
        detailLongPressResetTimeoutRef.current = null;
      }
    };
  }, []);

  const currentMasterSortDirection = masterSortDirection;
  const sortedMasterQueue = useMemo(
    () => sortMasterQueue(data?.queue || [], masterSortField, currentMasterSortDirection),
    [currentMasterSortDirection, data?.queue, masterSortField],
  );
  const tractorArchiveItems = useMemo(
    () => sortMasterQueue(data?.archives.tractorInspection || [], masterSortField, currentMasterSortDirection),
    [currentMasterSortDirection, data?.archives.tractorInspection, masterSortField],
  );
  const otherArchiveItems = useMemo(
    () => sortMasterQueue(data?.archives.other || [], masterSortField, currentMasterSortDirection),
    [currentMasterSortDirection, data?.archives.other, masterSortField],
  );
  const visiblePendingCount = useMemo(
    () => sortedMasterQueue.filter(isUnresolvedCall).length,
    [sortedMasterQueue],
  );

  const finalizeDriverEditClose = () => {
    if (!driverEditClosingRef.current) {
      setDriverEditMounted(false);
      return;
    }

    const shouldDismissKeyboard = driverEditDismissKeyboardAfterCloseRef.current;
    driverEditDismissKeyboardAfterCloseRef.current = false;

    if (!shouldDismissKeyboard) {
      driverEditClosingRef.current = false;
      setDriverEditMounted(false);
      return;
    }

    driverEditInputRef.current?.blur();
    Keyboard.dismiss();

    if (driverEditCloseTimeoutRef.current) {
      clearTimeout(driverEditCloseTimeoutRef.current);
    }
    driverEditCloseTimeoutRef.current = setTimeout(() => {
      driverEditClosingRef.current = false;
      setDriverEditMounted(false);
      driverEditCloseTimeoutRef.current = null;
    }, 180);
  };

  const driverEditBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(driverEditProgress.value, [0, 0.24, 1], [0, 0.72, 1]),
  }));

  const driverEditPopoverStyle = useAnimatedStyle(() => ({
    opacity: interpolate(driverEditProgress.value, [0, 0.16, 1], [0, 0.9, 1]),
    transform: [
      { translateX: interpolate(driverEditProgress.value, [0, 1], [5, 0]) },
      { translateY: interpolate(driverEditProgress.value, [0, 1], [7, 0]) },
      { scaleX: interpolate(driverEditProgress.value, [0, 0.36, 0.68, 1], [0.96, 0.89, 1.018, 1]) },
      { scaleY: interpolate(driverEditProgress.value, [0, 0.36, 0.68, 1], [0.92, 0.8, 1.012, 1]) },
    ],
  }));

  const markDetailLongPressHandled = (reasonCode: "tractor_inspection" | "other") => {
    detailLongPressHandledReasonRef.current = reasonCode;
    if (detailLongPressResetTimeoutRef.current) {
      clearTimeout(detailLongPressResetTimeoutRef.current);
    }
    detailLongPressResetTimeoutRef.current = setTimeout(() => {
      detailLongPressHandledReasonRef.current = null;
      detailLongPressResetTimeoutRef.current = null;
    }, 320);
  };

  const handleReasonPress = (reasonCode: YtMasterCallReason) => {
    if (
      (reasonCode === "tractor_inspection" || reasonCode === "other") &&
      detailLongPressHandledReasonRef.current === reasonCode
    ) {
      return;
    }

    setSelectedReason(reasonCode);
    setSelectedTractorSubreasonCode(null);
    setSelectedOtherSubreasonCode(null);
    setSelectedOtherSubreasonValue(null);
    setDayOffDatePickerVisible(false);
    setDayOffDateReturnToOtherDetailPicker(false);
  };

  const openDetailPicker = (reasonCode: "tractor_inspection" | "other") => {
    markDetailLongPressHandled(reasonCode);
    setDayOffDateReturnToOtherDetailPicker(false);
    setDetailPickerReason(reasonCode);
  };

  const closeDetailPicker = () => {
    setDetailPickerReason(null);
    setDayOffDatePickerVisible(false);
    setDayOffDateReturnToOtherDetailPicker(false);
  };

  const openDayOffDatePicker = (
    value?: string | null,
    options?: { returnToOtherDetailPicker?: boolean },
  ) => {
    setDayOffDateDraft(parseDayOffDateValue(value) || createDefaultDayOffDateDraft());
    setDayOffDateReturnToOtherDetailPicker(Boolean(options?.returnToOtherDetailPicker));
    setDetailPickerReason(null);
    setDayOffDatePickerVisible(true);
  };

  const closeDayOffDatePicker = (options?: { reopenOtherDetailPicker?: boolean }) => {
    setDayOffDatePickerVisible(false);
    const shouldReopenOtherDetailPicker =
      options?.reopenOtherDetailPicker ?? dayOffDateReturnToOtherDetailPicker;
    setDayOffDateReturnToOtherDetailPicker(false);
    if (shouldReopenOtherDetailPicker) {
      setDetailPickerReason("other");
    }
  };

  const handleSelectDayOffMonth = (month: number) => {
    setDayOffDateDraft((current) => ({
      ...current,
      month,
    }));
  };

  const handleToggleDayOffDay = (day: number) => {
    setDayOffDateDraft((current) => {
      const nextDateValue = buildDayOffDatePointValue({
        year: current.year,
        month: current.month,
        day,
      });
      const isSelected = current.selectedDateValues.includes(nextDateValue);
      return {
        ...current,
        selectedDateValues: normalizeDayOffDateValues(
          isSelected
            ? current.selectedDateValues.filter((value) => value !== nextDateValue)
            : current.selectedDateValues.concat(nextDateValue),
        ),
      };
    });
  };

  const handleApplyDayOffDate = () => {
    const reasonDetailValue = buildDayOffDateValue(dayOffDateDraft);
    if (!reasonDetailValue) {
      setActionError("휴무일정 날짜를 한 개 이상 선택해 주세요.");
      return;
    }
    setSelectedReason("other");
    setSelectedOtherSubreasonCode("day_off_schedule");
    setSelectedOtherSubreasonValue(reasonDetailValue);
    setSelectedTractorSubreasonCode(null);
    setDayOffDatePickerVisible(false);
    setDayOffDateReturnToOtherDetailPicker(false);
    setDetailPickerReason(null);
  };

  const handleSelectTractorSubreason = (subreasonCode: YtMasterCallTractorSubreason) => {
    setSelectedReason("tractor_inspection");
    setSelectedTractorSubreasonCode(subreasonCode);
    setSelectedOtherSubreasonCode(null);
    setSelectedOtherSubreasonValue(null);
    setDayOffDatePickerVisible(false);
    setDetailPickerReason(null);
  };

  const handleSelectOtherSubreason = (subreasonCode: YtMasterCallOtherSubreason) => {
    if (subreasonCode === "day_off_schedule") {
      openDayOffDatePicker(
        selectedOtherSubreasonCode === "day_off_schedule" ? selectedOtherSubreasonValue : null,
        { returnToOtherDetailPicker: true },
      );
      return;
    }
    setSelectedReason("other");
    setSelectedOtherSubreasonCode(subreasonCode);
    setSelectedOtherSubreasonValue(null);
    setSelectedTractorSubreasonCode(null);
    setDayOffDatePickerVisible(false);
    setDetailPickerReason(null);
  };

  const clearSelectedReasonDetail = () => {
    setSelectedTractorSubreasonCode(null);
    setSelectedOtherSubreasonCode(null);
    setSelectedOtherSubreasonValue(null);
    setDayOffDatePickerVisible(false);
    setDayOffDateReturnToOtherDetailPicker(false);
    setDetailPickerReason(null);
  };

  const handleCreateCall = async (options?: {
    reasonCode?: YtMasterCallReason;
    reasonDetailCode?: YtMasterCallReasonDetailCode | null;
    reasonDetailValue?: string | null;
  }) => {
    const reasonCode = options?.reasonCode || selectedReason;
    const reasonDetailCode =
      reasonCode === "tractor_inspection"
        ? options?.reasonDetailCode ?? selectedTractorSubreasonCode
        : reasonCode === "other"
          ? options?.reasonDetailCode ?? selectedOtherSubreasonCode
          : null;
    const reasonDetailValue =
      reasonCode === "other" && reasonDetailCode === "day_off_schedule"
        ? options?.reasonDetailValue ??
          (selectedOtherSubreasonCode === "day_off_schedule" ? selectedOtherSubreasonValue : null)
        : null;
    if (reasonCode === "other" && reasonDetailCode === "day_off_schedule" && !reasonDetailValue) {
      setActionError("휴무일정 날짜를 선택해 주세요.");
      openDayOffDatePicker(selectedOtherSubreasonValue);
      return;
    }
    setSending(true);
    setActionError(null);
    try {
      const saved = await createYtMasterCall({
        deviceId,
        reasonCode,
        reasonDetailCode,
        reasonDetailValue,
      });
      clearSelectedReasonDetail();
      setData(saved);
    } catch (createError) {
      setActionError((createError as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleCancelCall = async (callId: string) => {
    setActingCallId(callId);
    setActionError(null);
    try {
      const result = await cancelYtMasterCall(callId, {
        deviceId,
      });
      clearSelectedReasonDetail();
      setData(result.liveState);
    } catch (cancelError) {
      setActionError((cancelError as Error).message);
    } finally {
      setActingCallId(null);
    }
  };

  const handleDecision = async (
    callId: string,
    status: "approved" | "rejected" | "acknowledged",
  ) => {
    setActingCallId(callId);
    setActionError(null);
    try {
      const result = await decideYtMasterCall(callId, {
        deviceId,
        status,
      });
      setData(result.liveState);
    } catch (decisionError) {
      setActionError((decisionError as Error).message);
    } finally {
      setActingCallId(null);
    }
  };

  const handleHideCall = async (callId: string) => {
    setActingCallId(callId);
    setActionError(null);
    try {
      const result = await updateYtMasterCallVisibility(callId, {
        deviceId,
        action: "hide",
      });
      setData(result.liveState);
    } catch (visibilityError) {
      setActionError((visibilityError as Error).message);
    } finally {
      setActingCallId(null);
    }
  };

  const handleArchiveCall = async (callId: string) => {
    setActingCallId(callId);
    setActionError(null);
    try {
      const result = await updateYtMasterCallVisibility(callId, {
        deviceId,
        action: "archive",
      });
      setData(result.liveState);
    } catch (visibilityError) {
      setActionError((visibilityError as Error).message);
    } finally {
      setActingCallId(null);
    }
  };

  const handleRestoreArchivedCall = async (callId: string) => {
    setActingCallId(callId);
    setActionError(null);
    try {
      const result = await updateYtMasterCallVisibility(callId, {
        deviceId,
        action: "restore",
      });
      setData(result.liveState);
    } catch (visibilityError) {
      setActionError((visibilityError as Error).message);
    } finally {
      setActingCallId(null);
    }
  };

  const persistDriverYtNumber = async (rawYtNumber: string, options?: { closeModal?: boolean }) => {
    if (data?.registration?.role !== "driver") {
      return false;
    }

    const nextYtNumber = digitsOnly(rawYtNumber);
    if (!nextYtNumber.length) {
      setDriverEditError("\u0059T \uBC88\uD638\uB294 \uC22B\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return false;
    }

    setSavingDriverYtNumber(true);
    setDriverEditError(null);
    setActionError(null);
    try {
      const saved = await saveYtMasterCallRegistration({
        deviceId,
        role: "driver",
        name: data.registration.name,
        ytNumber: nextYtNumber,
      });
      setData(saved);
      setDriverYtNumberDraft(nextYtNumber);
      if (options?.closeModal) {
        closeDriverEdit({ ignoreSaving: true });
      }
      return true;
    } catch (saveError) {
      setDriverEditError((saveError as Error).message);
      return false;
    } finally {
      setSavingDriverYtNumber(false);
    }
  };

  const openDriverEdit = () => {
    if (data?.registration?.role !== "driver") {
      return;
    }
    if (driverEditCloseTimeoutRef.current) {
      clearTimeout(driverEditCloseTimeoutRef.current);
      driverEditCloseTimeoutRef.current = null;
    }
    driverEditClosingRef.current = false;
    driverEditDismissKeyboardAfterCloseRef.current = false;
    setDriverYtNumberDraft(data.registration.ytNumber ? data.registration.ytNumber.replace(/^YT-/, "") : "");
    setDriverEditError(null);
    setDriverEditVisible(true);
  };

  const closeDriverEdit = (options?: { ignoreSaving?: boolean }) => {
    if (savingDriverYtNumber && !options?.ignoreSaving) {
      return;
    }
    setDriverEditError(null);
    if (driverEditFocusTimeoutRef.current) {
      clearTimeout(driverEditFocusTimeoutRef.current);
      driverEditFocusTimeoutRef.current = null;
    }

    driverEditClosingRef.current = true;
    driverEditDismissKeyboardAfterCloseRef.current = Boolean(
      driverEditKeyboardVisibleRef.current || driverEditInputRef.current?.isFocused?.(),
    );
    setDriverEditVisible(false);
  };

  const handleSaveDriverYtNumber = async () => {
    await persistDriverYtNumber(driverYtNumberDraft, { closeModal: true });
  };

  const duplicateLockToast = duplicateLockToastVisible ? (
    <NativeAnimated.View
      pointerEvents="none"
      style={[
        styles.centerToastOverlay,
        {
          opacity: duplicateLockToastOpacity,
          transform: [
            {
              scale: duplicateLockToastOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.centerToastBubble}>
        <Text style={styles.centerToastText}>{DUPLICATE_LOCK_MESSAGE}</Text>
      </View>
    </NativeAnimated.View>
  ) : null;

  if (!data?.registration) {
    return (
      <View style={styles.screenRoot}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.emptyContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={COLORS.blue} />}
      >
        <Text style={styles.screenTitle}>YT Master</Text>
        <Text style={styles.emptyTitle}>반장 호출</Text>
        <Text style={styles.emptyBody}>
          먼저 Settings의 `YT Master Call`에서 YT Driver 또는 YT Master 권한을 등록해 주세요.
        </Text>
        <Link href="/yt-master-call-settings" asChild>
          <TactilePressable style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>권한 설정으로 이동</Text>
          </TactilePressable>
        </Link>
        {inlineActionError ? <Text style={styles.inlineError}>{inlineActionError}</Text> : null}
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>
      {duplicateLockToast}
      </View>
    );
  }

  if (data.registration.role === "driver") {
    const pendingCall =
      data.currentCall?.handlingMode === "decision" && data.currentCall.status === "pending"
        ? data.currentCall
        : null;
    const sentMessageCall =
      data.currentCall?.handlingMode === "message" && data.currentCall.status === "sent"
        ? data.currentCall
        : null;
    const hasBlockingPendingCall = Boolean(pendingCall);
    const selectedReasonDetailCode =
      selectedReason === "tractor_inspection"
        ? selectedTractorSubreasonCode
        : selectedReason === "other"
          ? selectedOtherSubreasonCode
          : null;
    const selectedReasonDetailValue =
      selectedReason === "other" && selectedReasonDetailCode === "day_off_schedule"
        ? selectedOtherSubreasonValue
        : null;
    const selectedReasonDetailLabel = getYtMasterCallReasonDetailLabel(
      selectedReason,
      selectedReasonDetailCode,
      selectedReasonDetailValue,
    );
    const selectedReasonSummary =
      selectedReasonDetailLabel
        ? formatYtMasterCallReasonDisplay(YT_MASTER_CALL_REASON_LABELS[selectedReason], selectedReasonDetailLabel)
        : YT_MASTER_CALL_REASON_LABELS[selectedReason];
    const detailPickerTitle = detailPickerReason === "tractor_inspection" ? "트랙터 점검 사유" : "기타 사유";
    const selectedDayOffDatePreview = getYtMasterCallReasonDetailLabel(
      "other",
      "day_off_schedule",
      buildDayOffDateValue(dayOffDateDraft),
    );
    const normalizedDayOffDateValues = normalizeDayOffDateValues(dayOffDateDraft.selectedDateValues);
    const selectedDayOffDateSet = new Set(normalizedDayOffDateValues);
    const selectedDayOffDatePreviewText =
      normalizedDayOffDateValues.length && selectedDayOffDatePreview
        ? selectedDayOffDatePreview
        : "날짜를 한 개 이상 선택해 주세요.";
    const selectableDayOffDays = Array.from(
      { length: getDaysInMonth(dayOffDateDraft.year, dayOffDateDraft.month) },
      (_, index) => index + 1,
    );
    const driverIdentityControl = (
      <Pressable style={styles.driverIdentityPressable} hitSlop={8} delayLongPress={220} onLongPress={openDriverEdit}>
        <View style={styles.driverIdentityBlock}>
          <Text style={styles.identityCode}>{data.registration.ytNumber}</Text>
          <Text style={styles.driverIdentityName}>{data.registration.name}</Text>
        </View>
      </Pressable>
    );

    return (
      <>
        <View style={styles.screenRoot}>
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={COLORS.blue} />}
      >
        <View style={styles.driverHeaderRow}>
          <Text style={styles.screenTitle}>YT Driver</Text>
          {driverIdentityControl}
        </View>

        <TactilePressable
          style={[styles.callCircle, hasBlockingPendingCall ? styles.callCircleDisabled : null]}
          disabled={sending || hasBlockingPendingCall}
          onPress={() => void handleCreateCall()}
        >
          {sending ? (
            <ActivityIndicator size="large" color="#ffffff" />
          ) : (
            <>
              <MaterialCommunityIcons name="truck-outline" size={74} color="#ffffff" />
              <Text style={styles.callCircleTitle}>반장 호출</Text>
              <Text style={styles.callCircleSubtitle}>점검, 화장실 등 사유 선택</Text>
            </>
          )}
        </TactilePressable>

        <View style={styles.reasonPanel}>
          {REASON_OPTIONS.map((reason) => {
            const selected = selectedReason === reason.code;
            return (
              <TactilePressable
                key={reason.code}
                variant="compact"
                style={[styles.reasonOption, selected ? styles.reasonOptionSelected : null]}
                onPress={() => handleReasonPress(reason.code)}
                onLongPress={
                  reason.code === "tractor_inspection"
                    ? () => openDetailPicker("tractor_inspection")
                    : reason.code === "other"
                      ? () => openDetailPicker("other")
                    : undefined
                }
                delayLongPress={220}
                disabled={hasBlockingPendingCall}
              >
                <MaterialCommunityIcons
                  name={reason.icon}
                  size={32}
                  color={selected ? COLORS.blue : COLORS.subtext}
                />
                <Text style={[styles.reasonLabel, selected ? styles.reasonLabelSelected : null]}>
                  {YT_MASTER_CALL_REASON_LABELS[reason.code]}
                </Text>
              </TactilePressable>
            );
          })}
        </View>
        {selectedReasonDetailLabel ? (
          <Text style={styles.reasonDetailSummary}>{selectedReasonSummary}</Text>
        ) : null}

        {pendingCall ? (
          <TactilePressable
            style={[styles.statusCard, actingCallId === pendingCall.id ? styles.pendingStatusCardDisabled : styles.pendingStatusCard]}
            disabled={actingCallId === pendingCall.id}
            onPress={() => void handleCancelCall(pendingCall.id)}
          >
            <View style={styles.pendingStatusLayout}>
              {actingCallId === pendingCall.id ? (
                <ActivityIndicator size="large" color={COLORS.subtext} />
              ) : (
                <PendingOrbitLoader />
              )}
              <Text style={styles.statusCardText}>호출 대기 중...</Text>
              <Text style={styles.pendingReasonText}>{formatCallReasonText(pendingCall)}</Text>
            </View>
            <Text style={styles.pendingHint}>다시 누르면 호출이 취소됩니다.</Text>
          </TactilePressable>
        ) : sentMessageCall ? (
          <View style={[styles.statusCard, styles.messageStatusCard]}>
            <View style={styles.messageStatusLayout}>
              <MaterialCommunityIcons name="email-check-outline" size={34} color={COLORS.blue} />
              <Text style={[styles.statusCardText, styles.messageStatusTitle]}>메시지가 접수되었습니다.</Text>
              <Text style={styles.messageReasonText}>{formatCallReasonText(sentMessageCall)}</Text>
              <Text style={styles.messageStatusHint}>반장이 확인하면 확인됨으로 표시됩니다.</Text>
            </View>
          </View>
        ) : data.currentCall?.status === "approved" ? (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="check-circle" size={28} color={COLORS.green} />
              <Text style={[styles.statusCardText, { color: COLORS.green }]}>반장이 호출을 승인했습니다.</Text>
            </View>
          </View>
        ) : data.currentCall?.status === "rejected" ? (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="close-circle" size={28} color={COLORS.red} />
              <Text style={[styles.statusCardText, { color: COLORS.red }]}>반장이 호출을 거절했습니다.</Text>
            </View>
          </View>
        ) : data.currentCall?.status === "acknowledged" ? (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="email-check-outline" size={28} color={COLORS.blue} />
              <Text style={[styles.statusCardText, { color: COLORS.blue }]}>메시지가 확인되었습니다.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="information-outline" size={28} color={COLORS.subtext} />
              <Text style={styles.statusCardText}>사유를 선택한 뒤 반장을 호출하세요.</Text>
            </View>
          </View>
        )}

        {!pendingCall ? (
          <TactilePressable
            style={[styles.emergencyCallCard, sending ? styles.emergencyCallCardDisabled : null]}
            disabled={sending}
            onPress={() => void handleCreateCall({ reasonCode: "emergency_accident" })}
          >
            <View style={styles.emergencyCallIconWrap}>
              <MaterialCommunityIcons name="alarm-light" size={52} color="#ffffff" />
            </View>
            <View style={styles.emergencyCallBody}>
              <Text style={styles.emergencyCallTitle}>긴급 사고 호출</Text>
            </View>
          </TactilePressable>
        ) : null}

          {inlineActionError ? <Text style={styles.inlineError}>{inlineActionError}</Text> : null}
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        </ScrollView>
        {duplicateLockToast}
        </View>
        <Modal
          visible={detailPickerReason !== null}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeDetailPicker}
        >
          <View style={styles.tractorSubreasonModalRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDetailPicker} />
            <View style={styles.tractorSubreasonSheet}>
              <View style={styles.tractorSubreasonHeader}>
                <Text style={styles.tractorSubreasonTitle}>{detailPickerTitle}</Text>
                <Pressable hitSlop={8} onPress={closeDetailPicker}>
                  <Text style={styles.tractorSubreasonClose}>닫기</Text>
                </Pressable>
              </View>
              <ScrollView
                style={styles.tractorSubreasonList}
                contentContainerStyle={styles.tractorSubreasonListContent}
                showsVerticalScrollIndicator={false}
              >
                {detailPickerReason === "tractor_inspection"
                  ? TRACTOR_SUBREASON_GROUPS.map((group) => (
                      <View key={group.key} style={styles.tractorSubreasonGroup}>
                        <Text style={styles.tractorSubreasonGroupTitle}>{group.title}</Text>
                        <View style={styles.tractorSubreasonChipWrap}>
                          {group.items.map((subreasonCode) => {
                            const subreasonLabel = YT_MASTER_CALL_TRACTOR_SUBREASON_LABELS[subreasonCode];
                            const selected =
                              selectedReason === "tractor_inspection" &&
                              selectedTractorSubreasonCode === subreasonCode;
                            return (
                              <TactilePressable
                                key={subreasonCode}
                                variant="compact"
                                style={[
                                  styles.tractorSubreasonChip,
                                  selected ? styles.tractorSubreasonChipSelected : null,
                                ]}
                                onPress={() => handleSelectTractorSubreason(subreasonCode)}
                              >
                                <Text
                                  style={[
                                    styles.tractorSubreasonChipText,
                                    selected ? styles.tractorSubreasonChipTextSelected : null,
                                  ]}
                                >
                                  {subreasonLabel}
                                </Text>
                              </TactilePressable>
                            );
                          })}
                        </View>
                      </View>
                    ))
                  : OTHER_SUBREASON_GROUPS.map((group) => (
                      <View key={group.key} style={styles.tractorSubreasonGroup}>
                        <Text style={styles.tractorSubreasonGroupTitle}>{group.title}</Text>
                        <View style={styles.tractorSubreasonChipWrap}>
                          {group.items.map((subreasonCode) => {
                            const subreasonLabel =
                              getYtMasterCallReasonDetailLabel(
                                "other",
                                subreasonCode,
                                subreasonCode === "day_off_schedule" &&
                                  selectedOtherSubreasonCode === "day_off_schedule"
                                  ? selectedOtherSubreasonValue
                                  : null,
                              ) || YT_MASTER_CALL_OTHER_SUBREASON_LABELS[subreasonCode];
                            const selected = selectedReason === "other" && selectedOtherSubreasonCode === subreasonCode;
                            return (
                              <TactilePressable
                                key={subreasonCode}
                                variant="compact"
                                style={[
                                  styles.tractorSubreasonChip,
                                  selected ? styles.tractorSubreasonChipSelected : null,
                                ]}
                                onPress={() => handleSelectOtherSubreason(subreasonCode)}
                              >
                                <Text
                                  style={[
                                    styles.tractorSubreasonChipText,
                                    selected ? styles.tractorSubreasonChipTextSelected : null,
                                  ]}
                                >
                                  {subreasonLabel}
                                </Text>
                              </TactilePressable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal
          visible={dayOffDatePickerVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => closeDayOffDatePicker()}
        >
          <View style={styles.dayOffDateModalRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDayOffDatePicker()} />
            <View style={styles.dayOffDateSheet}>
              <View style={styles.dayOffDateHeader}>
                <View style={styles.dayOffDateHeaderTextWrap}>
                  <Text style={styles.dayOffDateTitle}>휴무일정 날짜</Text>
                  <Text style={styles.dayOffDateYearText}>{normalizedDayOffDateValues.length}일 선택</Text>
                </View>
                <Pressable hitSlop={8} onPress={() => closeDayOffDatePicker()}>
                  <Text style={styles.dayOffDateClose}>닫기</Text>
                </Pressable>
              </View>
              <View style={styles.dayOffDateSection}>
                <Text style={styles.dayOffDateSectionTitle}>월</Text>
                <View style={styles.dayOffDateChipWrap}>
                  {DAY_OFF_MONTH_OPTIONS.map((month) => {
                    const selected = dayOffDateDraft.month === month;
                    return (
                      <TactilePressable
                        key={month}
                        variant="compact"
                        style={[styles.dayOffDateChip, selected ? styles.dayOffDateChipSelected : null]}
                        onPress={() => handleSelectDayOffMonth(month)}
                      >
                        <Text
                          style={[styles.dayOffDateChipText, selected ? styles.dayOffDateChipTextSelected : null]}
                        >
                          {month}월
                        </Text>
                      </TactilePressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.dayOffDateSection}>
                <Text style={styles.dayOffDateSectionTitle}>일</Text>
                <ScrollView
                  style={styles.dayOffDateDayScroll}
                  contentContainerStyle={styles.dayOffDateChipWrap}
                  showsVerticalScrollIndicator={false}
                >
                  {selectableDayOffDays.map((day) => {
                    const selected = selectedDayOffDateSet.has(
                      buildDayOffDatePointValue({
                        year: dayOffDateDraft.year,
                        month: dayOffDateDraft.month,
                        day,
                      }),
                    );
                    return (
                      <TactilePressable
                        key={day}
                        variant="compact"
                        style={[styles.dayOffDateChip, selected ? styles.dayOffDateChipSelected : null]}
                        onPress={() => handleToggleDayOffDay(day)}
                      >
                        <Text
                          style={[styles.dayOffDateChipText, selected ? styles.dayOffDateChipTextSelected : null]}
                        >
                          {day}일
                        </Text>
                      </TactilePressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.dayOffDatePreviewCard}>
                <Text style={styles.dayOffDatePreviewLabel}>선택됨</Text>
                <Text style={styles.dayOffDatePreviewText}>
                  {selectedDayOffDatePreviewText}
                </Text>
              </View>
              <View style={styles.dayOffDateActionRow}>
                <TactilePressable
                  style={[styles.dayOffDateActionButton, styles.dayOffDateCancelButton]}
                  variant="compact"
                  onPress={() => closeDayOffDatePicker()}
                >
                  <Text style={styles.dayOffDateCancelText}>취소</Text>
                </TactilePressable>
                <TactilePressable
                  style={[styles.dayOffDateActionButton, styles.dayOffDateConfirmButton]}
                  variant="compact"
                  onPress={handleApplyDayOffDate}
                >
                  <Text style={styles.dayOffDateConfirmText}>적용</Text>
                </TactilePressable>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          visible={driverEditMounted}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => closeDriverEdit()}
        >
          <View style={styles.driverEditModalRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDriverEdit()} />
            <Animated.View pointerEvents="none" style={[styles.driverEditOverlay, driverEditBackdropStyle]} />
            <Animated.View style={[styles.driverEditPopoverWrap, driverEditPopoverStyle]}>
              <View style={styles.driverEditPopover}>
                <View style={styles.driverEditInputFrame}>
                  <Text style={styles.driverEditPrefix}>{"YT-"}</Text>
                  <TextInput
                    ref={driverEditInputRef}
                    value={driverYtNumberDraft}
                    onChangeText={(value) => {
                      setDriverYtNumberDraft(digitsOnly(value));
                      if (driverEditError) {
                        setDriverEditError(null);
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="591"
                    placeholderTextColor="rgba(222, 232, 245, 0.48)"
                    selectionColor="#a7d0ff"
                    style={styles.driverEditInput}
                  />
                </View>
                {driverEditError ? <Text style={styles.driverEditError}>{driverEditError}</Text> : null}
                <View style={styles.driverEditActionRow}>
                  <TactilePressable
                    style={[styles.driverEditButton, styles.driverEditCancelButton]}
                    variant="compact"
                    disabled={savingDriverYtNumber}
                    onPress={() => closeDriverEdit()}
                  >
                    <Text style={styles.driverEditCancelText}>{"\uCDE8\uC18C"}</Text>
                  </TactilePressable>
                  <TactilePressable
                    style={[styles.driverEditButton, styles.driverEditSaveButton]}
                    variant="compact"
                    disabled={savingDriverYtNumber}
                    onPress={() => void handleSaveDriverYtNumber()}
                  >
                    {savingDriverYtNumber ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.driverEditSaveText}>{"\uC800\uC7A5"}</Text>
                    )}
                  </TactilePressable>
                </View>
              </View>
            </Animated.View>
          </View>
        </Modal>
      </>
    );
  }

  const currentSortDirectionLabel = sortDirectionLabel(masterSortField, currentMasterSortDirection);
  const currentSortSummary = `${sortFieldLabel(masterSortField)} · ${currentSortDirectionLabel}`;
  const activeArchiveItems =
    archiveView === "tractor_inspection"
      ? tractorArchiveItems
      : archiveView === "other"
        ? otherArchiveItems
        : [];
  const activeArchiveTitle = archiveView ? archiveTitle(archiveView) : "";

  const closeMasterMenu = () => {
    setMasterMenuVisible(false);
  };

  const handleToggleCurrentMasterSortDirection = () => {
    setMasterSortDirection((current) => toggleSortDirection(current));
  };

  const handleSelectMasterSortField = (field: MasterQueueSortField) => {
    if (masterSortField === field) {
      setMasterSortDirection((current) => toggleSortDirection(current));
    } else {
      setMasterSortField(field);
      setMasterSortDirection(defaultSortDirection(field));
    }
    setMasterMenuVisible(false);
  };

  const currentDirectionLabelForMenu = sortDirectionLabel(masterSortField, currentMasterSortDirection);

  const openArchiveView = (kind: YtMasterCallArchiveKind) => {
    setArchiveView(kind);
    setMasterMenuVisible(false);
  };

  const renderMasterQueueCard = (
    call: YtMasterCallQueueEntry,
    options?: {
      archived?: boolean;
    },
  ) => {
    const archived = Boolean(options?.archived);
    const busy = actingCallId === call.id;
    const swipeArchiveKind = getYtMasterCallArchiveKind(call.reasonCode);
    const swipeActionLabel = swipeArchiveKind ? "보관" : "삭제";
    const handleSwipeQueueAction = swipeArchiveKind
      ? () => void handleArchiveCall(call.id)
      : () => void handleHideCall(call.id);
    const card = (
      <View style={[styles.queueCard, archived ? styles.archiveCard : null, busy ? styles.queueCardDisabled : null]}>
        <View style={styles.queueTopRow}>
          <View>
            <Text style={styles.queueYtNo}>{call.ytNumber}</Text>
            <Text style={styles.queueDriverName}>{call.driverName}</Text>
          </View>
          <View style={styles.queueTopMeta}>
            <Text style={styles.queueTime}>{formatClock(call.createdAt)}</Text>
            {archived && call.archivedAt ? <Text style={styles.queueArchiveStamp}>보관 {formatClock(call.archivedAt)}</Text> : null}
          </View>
        </View>

        <View style={styles.queueDivider} />

        <View style={styles.queueStatusRow}>
          <View style={styles.queueReasonWrap}>
            <MaterialCommunityIcons
              name={reasonIconName(call.reasonCode)}
              size={28}
              color={call.reasonCode === "emergency_accident" ? COLORS.red : COLORS.subtext}
            />
            <Text style={styles.queueReasonText}>{formatCallReasonText(call)}</Text>
          </View>
          <Text style={[styles.queueStatusText, { color: statusTone(call.status) }]}>{formatStatusText(call.status)}</Text>
        </View>

        {archived ? (
          <>
            <Text style={styles.resolvedMeta}>
              {call.resolvedByName ? `처리자: ${call.resolvedByName} · 보관됨` : "보관됨"}
            </Text>
            <View style={styles.actionRow}>
              <TactilePressable
                style={[styles.archiveRestoreButton, busy ? styles.actionDisabled : null]}
                disabled={busy}
                onPress={() => void handleRestoreArchivedCall(call.id)}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.actionButtonText}>복원</Text>
                )}
              </TactilePressable>
            </View>
          </>
        ) : call.handlingMode === "decision" && call.status === "pending" ? (
          <View style={styles.actionRow}>
            <TactilePressable
              style={[styles.approveButton, busy ? styles.actionDisabled : null]}
              disabled={busy}
              onPress={() => void handleDecision(call.id, "approved")}
            >
              {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.actionButtonText}>승인</Text>}
            </TactilePressable>

            <TactilePressable
              style={[styles.rejectButton, busy ? styles.actionDisabled : null]}
              disabled={busy}
              onPress={() => void handleDecision(call.id, "rejected")}
            >
              {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.actionButtonText}>거절</Text>}
            </TactilePressable>
          </View>
        ) : call.handlingMode === "message" && call.status === "sent" ? (
          <View style={styles.actionRow}>
            <TactilePressable
              style={[styles.acknowledgeButton, busy ? styles.actionDisabled : null]}
              disabled={busy}
              onPress={() => void handleDecision(call.id, "acknowledged")}
            >
              {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.actionButtonText}>확인</Text>}
            </TactilePressable>
          </View>
        ) : (
          <Text style={styles.resolvedMeta}>처리자: {call.resolvedByName || "YT Master"}</Text>
        )}
      </View>
    );

    if (archived) {
      return (
        <View key={call.id} style={styles.archiveCardWrap}>
          {card}
        </View>
      );
    }

    return (
      <SwipeableQueueCard
        key={call.id}
        disabled={busy}
        actionLabel={swipeActionLabel}
        onSwipeAction={handleSwipeQueueAction}
      >
        {card}
      </SwipeableQueueCard>
    );
  };

  return (
    <>
      <View style={styles.screenRoot}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={COLORS.blue} />}
      >
        <View style={styles.driverHeaderRow}>
          <Text style={styles.screenTitle}>YT Master</Text>
          <View style={styles.masterHeaderTools}>
            <View style={styles.driverIdentityBlock}>
              <Text style={styles.identityCode}>{data.registration.masterSlot}</Text>
              <Text style={styles.driverIdentityName}>{data.registration.name}</Text>
            </View>
            <Pressable
              hitSlop={8}
              style={({ pressed }) => [styles.masterMenuButton, pressed ? styles.masterMenuButtonPressed : null]}
              onPress={() => setMasterMenuVisible(true)}
            >
              <MaterialCommunityIcons name="dots-horizontal" size={22} color={COLORS.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.masterListHeader}>
          <View style={styles.masterListTextWrap}>
            <View style={styles.masterListTitleRow}>
              <Text style={styles.masterListTitle}>호출 목록</Text>
              <View style={styles.masterListCountBadge}>
                <Text style={styles.masterListCountText}>{sortedMasterQueue.length}</Text>
              </View>
            </View>
            <Text style={styles.masterListMeta}>미처리 {visiblePendingCount} · {currentSortSummary}</Text>
          </View>
          <Pressable
            hitSlop={8}
            style={({ pressed }) => [styles.masterSortToggleButton, pressed ? styles.masterMenuButtonPressed : null]}
            onPress={handleToggleCurrentMasterSortDirection}
          >
            <MaterialCommunityIcons
              name={currentMasterSortDirection === "asc" ? "sort-ascending" : "sort-descending"}
              size={20}
              color={COLORS.text}
            />
          </Pressable>
        </View>

        <Text style={styles.masterGestureHint}>왼쪽으로 밀면 점검/기타는 보관 · 나머지는 삭제</Text>

        {sortedMasterQueue.length ? (
          sortedMasterQueue.map((call) => renderMasterQueueCard(call))
        ) : (
          <View style={styles.queueCard}>
            <Text style={styles.emptyQueueText}>들어온 호출이 없습니다.</Text>
          </View>
        )}

        {inlineActionError ? <Text style={styles.inlineError}>{inlineActionError}</Text> : null}
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>
      {duplicateLockToast}
      </View>

      <Modal
        visible={Boolean(isMaster && masterMenuVisible)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeMasterMenu}
        >
          <View style={styles.masterMenuModalRoot}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMasterMenu} />
            <View style={styles.masterMenuSheet}>
              {MASTER_QUEUE_SORT_FIELDS.map((option) => {
                const selected = option.field === masterSortField;
                return (
                  <Pressable
                    key={option.field}
                    style={styles.masterMenuOption}
                    onPress={() => handleSelectMasterSortField(option.field)}
                  >
                    <View style={styles.masterMenuCheckWrap}>
                      {selected ? (
                        <MaterialCommunityIcons name="check" size={18} color={COLORS.blue} />
                      ) : null}
                    </View>
                    <View style={styles.masterMenuOptionTextWrap}>
                      <Text style={styles.masterMenuOptionLabel}>{option.label}</Text>
                      {selected ? (
                        <Text style={styles.masterMenuOptionMeta}>{currentDirectionLabelForMenu}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}

              <View style={styles.masterMenuDivider} />

              <Pressable style={styles.masterMenuOption} onPress={() => openArchiveView("tractor_inspection")}>
                <View style={styles.masterArchiveLead}>
                  <MaterialCommunityIcons name="folder-outline" size={22} color={COLORS.text} />
                  <Text style={styles.masterMenuOptionLabel}>YT</Text>
                </View>
                <View style={styles.masterMenuCountBadge}>
                  <Text style={styles.masterMenuCountText}>{tractorArchiveItems.length}</Text>
                </View>
              </Pressable>
              <Pressable style={styles.masterMenuOption} onPress={() => openArchiveView("other")}>
                <View style={styles.masterArchiveLead}>
                  <MaterialCommunityIcons name="folder-outline" size={22} color={COLORS.text} />
                  <Text style={styles.masterMenuOptionLabel}>etc.</Text>
                </View>
                <View style={styles.masterMenuCountBadge}>
                  <Text style={styles.masterMenuCountText}>{otherArchiveItems.length}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(isMaster && archiveView)}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setArchiveView(null)}
      >
        <View style={styles.archiveModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setArchiveView(null)} />
          <View style={styles.archiveSheet}>
            <View style={styles.archiveHeader}>
              <View style={styles.archiveHeaderTextWrap}>
                <Text style={styles.archiveTitle}>{activeArchiveTitle}</Text>
                <Text style={styles.archiveMeta}>{currentSortSummary} · {activeArchiveItems.length}건</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setArchiveView(null)}>
                <Text style={styles.archiveCloseText}>닫기</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.archiveScroll}
              contentContainerStyle={styles.archiveContent}
              showsVerticalScrollIndicator={false}
            >
              {activeArchiveItems.length ? (
                activeArchiveItems.map((call) => renderMasterQueueCard(call, { archived: true }))
              ) : (
                <View style={[styles.queueCard, styles.archiveEmptyCard]}>
                  <Text style={styles.emptyQueueText}>보관된 호출이 없습니다.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );

  /*
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={COLORS.blue} />}
    >
      <View style={styles.driverHeaderRow}>
        <Text style={styles.screenTitle}>YT Master</Text>
        <View style={styles.driverIdentityBlock}>
          <Text style={styles.identityCode}>{data.registration.masterSlot}</Text>
          <Text style={styles.driverIdentityName}>{data.registration.name}</Text>
        </View>
      </View>

      <View style={styles.masterListHeader}>
        <Text style={styles.masterListTitle}>호출 목록</Text>
        <Text style={styles.masterListMeta}>Pending {data.pendingCount}</Text>
      </View>

      {data.queue.length ? (
        data.queue.map((call) => (
          <View key={call.id} style={styles.queueCard}>
            <View style={styles.queueTopRow}>
              <View>
                <Text style={styles.queueYtNo}>{call.ytNumber}</Text>
                <Text style={styles.queueDriverName}>{call.driverName}</Text>
              </View>
              <Text style={styles.queueTime}>{formatClock(call.createdAt)}</Text>
            </View>

            <View style={styles.queueDivider} />

            <View style={styles.queueStatusRow}>
              <View style={styles.queueReasonWrap}>
                <MaterialCommunityIcons
                  name={reasonIconName(call.reasonCode)}
                  size={28}
                  color={call.reasonCode === "emergency_accident" ? COLORS.red : COLORS.subtext}
                />
                <Text style={styles.queueReasonText}>{formatCallReasonText(call)}</Text>
              </View>
              <Text style={[styles.queueStatusText, { color: statusTone(call.status) }]}>
                {formatStatusText(call.status)}
              </Text>
            </View>

            {call.handlingMode === "decision" && call.status === "pending" ? (
              <View style={styles.actionRow}>
                <TactilePressable
                  style={[styles.approveButton, actingCallId === call.id ? styles.actionDisabled : null]}
                  disabled={actingCallId === call.id}
                  onPress={() => void handleDecision(call.id, "approved")}
                >
                  {actingCallId === call.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.actionButtonText}>승인</Text>
                  )}
                </TactilePressable>

                <TactilePressable
                  style={[styles.rejectButton, actingCallId === call.id ? styles.actionDisabled : null]}
                  disabled={actingCallId === call.id}
                  onPress={() => void handleDecision(call.id, "rejected")}
                >
                  {actingCallId === call.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.actionButtonText}>거절</Text>
                  )}
                </TactilePressable>
              </View>
            ) : call.handlingMode === "message" && call.status === "sent" ? (
              <View style={styles.actionRow}>
                <TactilePressable
                  style={[styles.acknowledgeButton, actingCallId === call.id ? styles.actionDisabled : null]}
                  disabled={actingCallId === call.id}
                  onPress={() => void handleDecision(call.id, "acknowledged")}
                >
                  {actingCallId === call.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.actionButtonText}>확인</Text>
                  )}
                </TactilePressable>
              </View>
            ) : (
              <Text style={styles.resolvedMeta}>처리자: {call.resolvedByName || "YT Master"}</Text>
            )}
          </View>
        ))
      ) : (
        <View style={styles.queueCard}>
          <Text style={styles.emptyQueueText}>들어온 호출이 없습니다.</Text>
        </View>
      )}

      {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}
      {error ? <Text style={styles.inlineError}>{error}</Text> : null}
    </ScrollView>
  );
  */
}

function createStyles() {
  return StyleSheet.create({
    screenRoot: {
      flex: 1,
      backgroundColor: COLORS.screen,
    },
    screen: {
      flex: 1,
      backgroundColor: COLORS.screen,
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 28,
      gap: 18,
    },
    emptyContent: {
      paddingHorizontal: 18,
      paddingTop: 24,
      paddingBottom: 28,
      gap: 18,
    },
    driverHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    brandMark: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f7f9ff",
      borderWidth: 1,
      borderColor: "#d9e8ff",
    },
    brandText: {
      fontSize: 20,
      fontWeight: "800",
      color: COLORS.text,
    },
    driverIdentityBlock: {
      alignItems: "flex-end",
      gap: 2,
      paddingTop: 6,
      flexShrink: 1,
    },
    masterHeaderTools: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    driverIdentityPressable: {
      borderRadius: 16,
      marginRight: -2,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    identityCode: {
      fontSize: 22,
      fontWeight: "900",
      color: COLORS.text,
    },
    driverIdentityName: {
      fontSize: 14,
      color: COLORS.subtext,
      maxWidth: 128,
      textAlign: "right",
    },
    masterMenuButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.72)",
      borderWidth: 1,
      borderColor: "rgba(13, 13, 15, 0.06)",
    },
    masterMenuButtonPressed: {
      backgroundColor: "rgba(17, 124, 255, 0.14)",
      borderColor: "rgba(17, 124, 255, 0.16)",
    },
    screenTitle: {
      fontSize: 34,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -1.2,
      marginTop: 0,
    },
    callCircle: {
      alignSelf: "center",
      width: 286,
      height: 286,
      borderRadius: 143,
      backgroundColor: COLORS.blue,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 32,
    },
    callCircleDisabled: {
      opacity: 0.82,
    },
    callCircleTitle: {
      fontSize: 30,
      fontWeight: "800",
      color: "#ffffff",
      letterSpacing: -0.7,
    },
    callCircleSubtitle: {
      fontSize: 17,
      color: "rgba(255,255,255,0.92)",
      textAlign: "center",
      lineHeight: 22,
    },
    reasonPanel: {
      flexDirection: "row",
      gap: 10,
      backgroundColor: COLORS.surface,
      borderRadius: 24,
      padding: 12,
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 18,
      elevation: 6,
    },
    reasonOption: {
      flex: 1,
      minHeight: 108,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: "#ffffff",
      paddingHorizontal: 8,
    },
    reasonOptionSelected: {
      backgroundColor: COLORS.blueSoft,
    },
    reasonLabel: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.text,
      textAlign: "center",
      lineHeight: 20,
    },
    reasonLabelSelected: {
      color: COLORS.blue,
    },
    reasonDetailSummary: {
      marginTop: -8,
      paddingHorizontal: 8,
      fontSize: 14,
      fontWeight: "700",
      color: COLORS.subtext,
      lineHeight: 20,
      textAlign: "center",
    },
    statusCard: {
      minHeight: 104,
      borderRadius: 22,
      backgroundColor: COLORS.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 16,
      elevation: 5,
    },
    pendingStatusCard: {
      minHeight: 214,
      gap: 12,
      backgroundColor: COLORS.surface,
      paddingVertical: 20,
    },
    messageStatusCard: {
      minHeight: 156,
      paddingVertical: 18,
    },
    pendingStatusCardDisabled: {
      opacity: 0.75,
    },
    pendingStatusLayout: {
      alignItems: "center",
      gap: 10,
    },
    messageStatusLayout: {
      alignItems: "center",
      gap: 8,
    },
    messageStatusTitle: {
      color: COLORS.blue,
    },
    messageReasonText: {
      fontSize: 16,
      fontWeight: "800",
      color: COLORS.text,
      textAlign: "center",
      lineHeight: 22,
    },
    messageStatusHint: {
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.subtext,
      textAlign: "center",
      lineHeight: 19,
    },
    pendingHint: {
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.subtext,
      textAlign: "center",
    },
    pendingReasonText: {
      fontSize: 15,
      fontWeight: "700",
      color: COLORS.subtext,
      textAlign: "center",
      lineHeight: 21,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    statusCardText: {
      fontSize: 20,
      fontWeight: "800",
      color: COLORS.text,
      textAlign: "center",
    },
    emergencyCallCard: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingVertical: 20,
      minHeight: 102,
      backgroundColor: "#d83832",
      shadowColor: "#611111",
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 18,
      elevation: 7,
    },
    emergencyCallCardDisabled: {
      opacity: 0.72,
    },
    emergencyCallIconWrap: {
      position: "absolute",
      left: 22,
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    emergencyCallBody: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    emergencyCallTitle: {
      fontSize: 28,
      fontWeight: "900",
      color: "#ffffff",
      letterSpacing: -0.8,
      textAlign: "center",
      transform: [{ translateX: 10 }],
    },
    masterListHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    masterListTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: COLORS.text,
    },
    masterListTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    masterListMeta: {
      fontSize: 15,
      fontWeight: "700",
      color: COLORS.subtext,
    },
    masterListTextWrap: {
      flex: 1,
      gap: 2,
    },
    masterListCountBadge: {
      minWidth: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.blueSoft,
      paddingHorizontal: 12,
    },
    masterListCountText: {
      fontSize: 16,
      fontWeight: "900",
      color: COLORS.blue,
    },
    masterSortToggleButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.72)",
      borderWidth: 1,
      borderColor: "rgba(13, 13, 15, 0.06)",
    },
    masterGestureHint: {
      marginTop: -10,
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.subtext,
    },
    queueCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 26,
      paddingHorizontal: 22,
      paddingVertical: 20,
      gap: 16,
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 18,
      elevation: 6,
    },
    queueCardDisabled: {
      opacity: 0.72,
    },
    archiveCard: {
      borderWidth: 1,
      borderColor: "rgba(17, 124, 255, 0.08)",
    },
    archiveCardWrap: {
      width: "100%",
    },
    queueTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    queueTopMeta: {
      alignItems: "flex-end",
      gap: 4,
      paddingTop: 4,
    },
    queueYtNo: {
      fontSize: 30,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -1,
    },
    queueDriverName: {
      fontSize: 24,
      fontWeight: "800",
      color: COLORS.text,
      marginTop: 2,
    },
    queueTime: {
      fontSize: 18,
      fontWeight: "500",
      color: COLORS.subtext,
      paddingTop: 4,
    },
    queueArchiveStamp: {
      fontSize: 12,
      fontWeight: "800",
      color: COLORS.blue,
    },
    queueDivider: {
      height: 1,
      backgroundColor: COLORS.line,
    },
    queueStatusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    queueReasonWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    queueReasonText: {
      fontSize: 20,
      fontWeight: "800",
      color: COLORS.text,
      flexShrink: 1,
      lineHeight: 26,
    },
    queueStatusText: {
      fontSize: 18,
      fontWeight: "800",
    },
    actionRow: {
      flexDirection: "row",
      gap: 14,
    },
    approveButton: {
      flex: 1,
      minHeight: 66,
      borderRadius: 18,
      backgroundColor: COLORS.green,
      alignItems: "center",
      justifyContent: "center",
    },
    rejectButton: {
      flex: 1,
      minHeight: 66,
      borderRadius: 18,
      backgroundColor: COLORS.red,
      alignItems: "center",
      justifyContent: "center",
    },
    acknowledgeButton: {
      flex: 1,
      minHeight: 66,
      borderRadius: 18,
      backgroundColor: COLORS.blue,
      alignItems: "center",
      justifyContent: "center",
    },
    archiveRestoreButton: {
      flex: 1,
      minHeight: 66,
      borderRadius: 18,
      backgroundColor: COLORS.text,
      alignItems: "center",
      justifyContent: "center",
    },
    actionDisabled: {
      opacity: 0.7,
    },
    actionButtonText: {
      fontSize: 22,
      fontWeight: "900",
      color: "#ffffff",
    },
    resolvedMeta: {
      fontSize: 14,
      fontWeight: "700",
      color: COLORS.subtext,
    },
    emptyTitle: {
      fontSize: 34,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -1,
    },
    emptyBody: {
      fontSize: 16,
      lineHeight: 24,
      color: COLORS.subtext,
    },
    emptyButton: {
      minHeight: 60,
      borderRadius: 20,
      backgroundColor: COLORS.blue,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    emptyButtonText: {
      fontSize: 18,
      fontWeight: "800",
      color: "#ffffff",
    },
    emptyQueueText: {
      fontSize: 18,
      fontWeight: "700",
      color: COLORS.subtext,
      textAlign: "center",
    },
    inlineError: {
      fontSize: 14,
      fontWeight: "700",
      color: COLORS.red,
    },
    centerToastOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      zIndex: 20,
    },
    centerToastBubble: {
      maxWidth: 320,
      borderRadius: 22,
      backgroundColor: "rgba(13, 13, 15, 0.92)",
      paddingHorizontal: 18,
      paddingVertical: 14,
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.22,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 20,
      elevation: 12,
    },
    centerToastText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#ffffff",
      textAlign: "center",
      lineHeight: 22,
    },
    masterMenuModalRoot: {
      flex: 1,
      paddingTop: 92,
      paddingRight: 18,
      paddingLeft: 108,
      alignItems: "flex-end",
      backgroundColor: "rgba(7, 12, 22, 0.08)",
    },
    masterMenuSheet: {
      width: "100%",
      maxWidth: 248,
      borderRadius: 26,
      backgroundColor: "rgba(255,255,255,0.98)",
      paddingHorizontal: 8,
      paddingTop: 10,
      paddingBottom: 8,
      borderWidth: 1,
      borderColor: "rgba(17, 124, 255, 0.08)",
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.16,
      shadowOffset: { width: 0, height: 14 },
      shadowRadius: 26,
      elevation: 12,
    },
    masterMenuTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -0.6,
      marginBottom: 8,
    },
    masterMenuSectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: COLORS.subtext,
      letterSpacing: 0.2,
      marginBottom: 6,
    },
    masterMenuOption: {
      minHeight: 54,
      borderRadius: 18,
      paddingHorizontal: 8,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    masterMenuCheckWrap: {
      width: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    masterMenuOptionTextWrap: {
      flex: 1,
    },
    masterMenuOptionLabel: {
      fontSize: 16,
      fontWeight: "800",
      color: COLORS.text,
      lineHeight: 22,
    },
    masterMenuOptionMeta: {
      marginTop: 1,
      fontSize: 12,
      fontWeight: "700",
      color: "#9599a3",
    },
    masterArchiveLead: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    masterMenuDivider: {
      height: 1,
      backgroundColor: "rgba(13, 13, 15, 0.08)",
      marginVertical: 10,
    },
    masterMenuCountBadge: {
      minWidth: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.blueSoft,
      paddingHorizontal: 10,
    },
    masterMenuCountText: {
      fontSize: 14,
      fontWeight: "900",
      color: COLORS.blue,
    },
    archiveModalRoot: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(7, 12, 22, 0.18)",
    },
    archiveSheet: {
      maxHeight: "84%",
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: COLORS.screen,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 26,
      gap: 14,
    },
    archiveHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    archiveHeaderTextWrap: {
      flex: 1,
      gap: 3,
    },
    archiveTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -0.8,
    },
    archiveMeta: {
      fontSize: 14,
      fontWeight: "700",
      color: COLORS.subtext,
    },
    archiveCloseText: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.blue,
    },
    archiveScroll: {
      flexGrow: 0,
    },
    archiveContent: {
      gap: 12,
      paddingBottom: 6,
    },
    archiveEmptyCard: {
      alignItems: "center",
    },
    tractorSubreasonModalRoot: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      backgroundColor: "rgba(7, 12, 22, 0.18)",
    },
    tractorSubreasonSheet: {
      maxHeight: "82%",
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.96)",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      borderWidth: 1,
      borderColor: "rgba(17, 124, 255, 0.08)",
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 18 },
      shadowRadius: 28,
      elevation: 12,
    },
    tractorSubreasonHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 10,
    },
    tractorSubreasonTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -0.8,
    },
    tractorSubreasonClose: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.blue,
    },
    tractorSubreasonList: {
      flexGrow: 0,
    },
    tractorSubreasonListContent: {
      gap: 8,
      paddingBottom: 4,
    },
    tractorSubreasonGroup: {
      gap: 5,
    },
    tractorSubreasonGroupTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: COLORS.subtext,
      paddingHorizontal: 4,
      letterSpacing: 0.2,
    },
    tractorSubreasonChipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    tractorSubreasonChip: {
      minHeight: 42,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f4f7fb",
    },
    tractorSubreasonChipSelected: {
      backgroundColor: COLORS.blueSoft,
    },
    tractorSubreasonChipText: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.text,
      lineHeight: 20,
    },
    tractorSubreasonChipTextSelected: {
      color: COLORS.blue,
    },
    dayOffDateModalRoot: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      backgroundColor: "rgba(7, 12, 22, 0.18)",
    },
    dayOffDateSheet: {
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.97)",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      borderWidth: 1,
      borderColor: "rgba(17, 124, 255, 0.08)",
      shadowColor: COLORS.shadow,
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 18 },
      shadowRadius: 28,
      elevation: 12,
      gap: 12,
    },
    dayOffDateHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    dayOffDateHeaderTextWrap: {
      flex: 1,
      gap: 2,
    },
    dayOffDateTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -0.8,
    },
    dayOffDateYearText: {
      fontSize: 13,
      fontWeight: "800",
      color: COLORS.subtext,
    },
    dayOffDateClose: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.blue,
    },
    dayOffDateSection: {
      gap: 7,
    },
    dayOffDateSectionTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: COLORS.subtext,
      paddingHorizontal: 2,
    },
    dayOffDateChipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    dayOffDateChip: {
      minHeight: 40,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f4f7fb",
    },
    dayOffDateChipSelected: {
      backgroundColor: COLORS.blueSoft,
    },
    dayOffDateChipText: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.text,
      lineHeight: 20,
    },
    dayOffDateChipTextSelected: {
      color: COLORS.blue,
    },
    dayOffDateDayScroll: {
      maxHeight: 212,
    },
    dayOffDatePreviewCard: {
      borderRadius: 18,
      backgroundColor: "#f4f7fb",
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 4,
    },
    dayOffDatePreviewLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: COLORS.subtext,
    },
    dayOffDatePreviewText: {
      fontSize: 16,
      fontWeight: "900",
      color: COLORS.text,
      lineHeight: 22,
    },
    dayOffDateActionRow: {
      flexDirection: "row",
      gap: 8,
    },
    dayOffDateActionButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    dayOffDateCancelButton: {
      backgroundColor: "#f4f7fb",
    },
    dayOffDateConfirmButton: {
      backgroundColor: COLORS.blue,
    },
    dayOffDateCancelText: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.text,
    },
    dayOffDateConfirmText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#ffffff",
    },
    driverEditModalRoot: {
      flex: 1,
    },
    driverEditOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(8, 12, 20, 0.1)",
    },
    driverEditPopoverWrap: {
      alignSelf: "flex-end",
      marginTop: 98,
      marginRight: 18,
      width: 214,
    },
    driverEditPopover: {
      overflow: "hidden",
      borderRadius: 22,
      backgroundColor: "rgba(17, 22, 33, 0.78)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.16)",
      paddingHorizontal: 14,
      paddingTop: 13,
      paddingBottom: 13,
      gap: 8,
      shadowColor: "#07101f",
      shadowOpacity: 0.24,
      shadowOffset: { width: 0, height: 16 },
      shadowRadius: 24,
      elevation: 12,
    },
    driverEditInputFrame: {
      minHeight: 54,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(197, 221, 255, 0.14)",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    driverEditPrefix: {
      fontSize: 21,
      fontWeight: "900",
      color: "rgba(216, 229, 247, 0.94)",
    },
    driverEditInput: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 0,
      fontSize: 25,
      fontWeight: "900",
      color: "#f8fbff",
    },
    driverEditError: {
      fontSize: 12,
      fontWeight: "700",
      color: "#ffaba5",
      lineHeight: 17,
    },
    driverEditActionRow: {
      flexDirection: "row",
      gap: 8,
    },
    driverEditButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    driverEditCancelButton: {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.12)",
    },
    driverEditSaveButton: {
      backgroundColor: COLORS.blue,
    },
    driverEditCancelText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#f8fbff",
    },
    driverEditSaveText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#ffffff",
    },
  });
}

const pendingLoaderStyles = StyleSheet.create({
  wrap: {
    width: PENDING_LOADER_SIZE,
    height: PENDING_LOADER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: PENDING_LOADER_SIZE,
    height: PENDING_LOADER_SIZE,
  },
  dot: {
    position: "absolute",
    width: PENDING_LOADER_DOT_SIZE,
    height: PENDING_LOADER_DOT_SIZE,
    borderRadius: PENDING_LOADER_DOT_SIZE / 2,
    backgroundColor: COLORS.blue,
  },
  centerBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});

const swipeQueueStyles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 26,
    overflow: "hidden",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: "#10151d",
    paddingRight: 24,
  },
  backgroundLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
  },
});

const loadingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: COLORS.screen,
    padding: 24,
  },
  text: {
    fontSize: 15,
    fontWeight: "700",
    color: "#40424a",
    textAlign: "center",
  },
});
