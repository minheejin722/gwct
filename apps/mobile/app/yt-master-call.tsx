import type { ComponentProps } from "react";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  YT_MASTER_CALL_REASON_LABELS,
  type YtMasterCallLiveState,
  type YtMasterCallQueueEntry,
  type YtMasterCallReason,
} from "@gwct/shared";
import { Link } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TactilePressable } from "../components/TactilePressable";
import { useEndpoint } from "../hooks/useEndpoint";
import { useHeaderScrollToTop } from "../hooks/useHeaderScrollToTop";
import { useLocalDeviceId } from "../hooks/useLocalDeviceId";
import { API_URLS } from "../lib/config";
import { createYtMasterCall, decideYtMasterCall } from "../lib/ytMasterCall";

const REF_COLORS = {
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

const REASON_OPTIONS: Array<{
  code: YtMasterCallReason;
  icon: MaterialIconName;
}> = [
  { code: "tractor_inspection", icon: "tractor" },
  { code: "restroom", icon: "human-male-female" },
  { code: "other", icon: "dots-horizontal" },
];

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
  return "대기 중";
}

function statusTone(status: YtMasterCallQueueEntry["status"]) {
  if (status === "approved") {
    return REF_COLORS.green;
  }
  if (status === "rejected") {
    return REF_COLORS.red;
  }
  return REF_COLORS.subtext;
}

export default function YtMasterCallScreen() {
  const { deviceId, isReady } = useLocalDeviceId();

  if (!isReady || !deviceId) {
    return (
      <View style={loadingStyles.screen}>
        <ActivityIndicator size="large" color={REF_COLORS.blue} />
        <Text style={loadingStyles.text}>반장 호출 화면을 준비 중입니다...</Text>
      </View>
    );
  }

  return <YtMasterCallContent deviceId={deviceId} />;
}

function YtMasterCallContent({ deviceId }: { deviceId: string }) {
  const styles = useMemo(() => createStyles(), []);
  const scrollRef = useRef<ScrollView | null>(null);
  const { data, loading, error, refresh, setData } = useEndpoint<YtMasterCallLiveState>(API_URLS.ytMasterCallLive(deviceId), {
    pollMs: 15000,
    liveEvents: ["yt_master_call_role_updated", "yt_master_call_changed"],
  });
  const [selectedReason, setSelectedReason] = useState<YtMasterCallReason>("tractor_inspection");
  const [sending, setSending] = useState(false);
  const [actingCallId, setActingCallId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useHeaderScrollToTop(["yt-master-call"], scrollRef);

  const handleCreateCall = async () => {
    setSending(true);
    setActionError(null);
    try {
      const saved = await createYtMasterCall({
        deviceId,
        reasonCode: selectedReason,
      });
      setData(saved);
    } catch (createError) {
      setActionError((createError as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleDecision = async (callId: string, status: "approved" | "rejected") => {
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

  if (!data?.registration) {
    return (
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.emptyContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={REF_COLORS.blue} />}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="cube-outline" size={26} color={REF_COLORS.blue} />
          </View>
          <Text style={styles.brandText}>Yard Master</Text>
        </View>
        <Text style={styles.emptyTitle}>반장 호출</Text>
        <Text style={styles.emptyBody}>먼저 Settings의 `YT Master Call`에서 YT Driver 또는 YT Master 권한을 등록해 주세요.</Text>
        <Link href="/yt-master-call-settings" asChild>
          <TactilePressable style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>권한 설정으로 이동</Text>
          </TactilePressable>
        </Link>
        {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>
    );
  }

  return data.registration.role === "driver" ? (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={REF_COLORS.blue} />}
    >
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="cube-outline" size={26} color={REF_COLORS.blue} />
          </View>
          <Text style={styles.brandText}>Yard Master</Text>
        </View>
        <View style={styles.identityBlock}>
          <Text style={styles.identityCode}>{data.registration.ytNumber}</Text>
          <Text style={styles.identityName}>name: {data.registration.name}</Text>
        </View>
      </View>

      <Text style={styles.screenTitle}>YT Driver</Text>

      <TactilePressable
        style={[styles.callCircle, data.currentCall?.status === "pending" ? styles.callCircleDisabled : null]}
        disabled={sending || data.currentCall?.status === "pending"}
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
              onPress={() => setSelectedReason(reason.code)}
            >
              <MaterialCommunityIcons
                name={reason.icon}
                size={32}
                color={selected ? REF_COLORS.blue : REF_COLORS.subtext}
              />
              <Text style={[styles.reasonLabel, selected ? styles.reasonLabelSelected : null]}>
                {YT_MASTER_CALL_REASON_LABELS[reason.code]}
              </Text>
            </TactilePressable>
          );
        })}
      </View>

      <View style={styles.statusCard}>
        {data.currentCall?.status === "pending" ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={REF_COLORS.subtext} />
            <Text style={styles.statusCardText}>호출 대기 중...</Text>
          </View>
        ) : data.currentCall?.status === "approved" ? (
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="check-circle" size={28} color={REF_COLORS.green} />
            <Text style={[styles.statusCardText, { color: REF_COLORS.green }]}>반장이 호출을 승인했습니다.</Text>
          </View>
        ) : data.currentCall?.status === "rejected" ? (
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="close-circle" size={28} color={REF_COLORS.red} />
            <Text style={[styles.statusCardText, { color: REF_COLORS.red }]}>반장이 호출을 거절했습니다.</Text>
          </View>
        ) : (
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="information-outline" size={28} color={REF_COLORS.subtext} />
            <Text style={styles.statusCardText}>사유를 선택한 뒤 반장을 호출하세요.</Text>
          </View>
        )}
      </View>

      {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}
      {error ? <Text style={styles.inlineError}>{error}</Text> : null}
    </ScrollView>
  ) : (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={REF_COLORS.blue} />}
    >
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="cube-outline" size={26} color={REF_COLORS.blue} />
          </View>
          <Text style={styles.brandText}>Yard Master</Text>
        </View>
        <View style={styles.identityBlock}>
          <Text style={styles.identityCode}>{data.registration.masterSlot}</Text>
          <Text style={styles.identityName}>name: {data.registration.name}</Text>
        </View>
      </View>

      <Text style={styles.screenTitle}>Yard Master (반장)</Text>

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
                  name={REASON_OPTIONS.find((item) => item.code === call.reasonCode)?.icon || "dots-horizontal"}
                  size={28}
                  color={REF_COLORS.subtext}
                />
                <Text style={styles.queueReasonText}>{call.reasonLabel}</Text>
              </View>
              <Text style={[styles.queueStatusText, { color: statusTone(call.status) }]}>
                {formatStatusText(call.status)}
              </Text>
            </View>

            {call.status === "pending" ? (
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
            ) : (
              <Text style={styles.resolvedMeta}>처리자: {call.resolvedByName || "반장"}</Text>
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
}

function createStyles() {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: REF_COLORS.screen,
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
    topHeader: {
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
      color: REF_COLORS.text,
    },
    identityBlock: {
      alignItems: "flex-end",
      gap: 2,
      paddingTop: 2,
    },
    identityCode: {
      fontSize: 22,
      fontWeight: "900",
      color: REF_COLORS.text,
    },
    identityName: {
      fontSize: 14,
      color: REF_COLORS.subtext,
    },
    screenTitle: {
      fontSize: 34,
      fontWeight: "900",
      color: REF_COLORS.text,
      letterSpacing: -1.2,
      marginTop: 4,
    },
    callCircle: {
      alignSelf: "center",
      width: 286,
      height: 286,
      borderRadius: 143,
      backgroundColor: REF_COLORS.blue,
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
      backgroundColor: REF_COLORS.surface,
      borderRadius: 24,
      padding: 12,
      shadowColor: REF_COLORS.shadow,
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
      backgroundColor: REF_COLORS.blueSoft,
    },
    reasonLabel: {
      fontSize: 15,
      fontWeight: "800",
      color: REF_COLORS.text,
      textAlign: "center",
      lineHeight: 20,
    },
    reasonLabelSelected: {
      color: REF_COLORS.blue,
    },
    statusCard: {
      minHeight: 104,
      borderRadius: 22,
      backgroundColor: REF_COLORS.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      shadowColor: REF_COLORS.shadow,
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 16,
      elevation: 5,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    statusCardText: {
      fontSize: 20,
      fontWeight: "800",
      color: REF_COLORS.text,
      textAlign: "center",
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
      color: REF_COLORS.text,
    },
    masterListMeta: {
      fontSize: 15,
      fontWeight: "700",
      color: REF_COLORS.subtext,
    },
    queueCard: {
      backgroundColor: REF_COLORS.surface,
      borderRadius: 26,
      paddingHorizontal: 22,
      paddingVertical: 20,
      gap: 16,
      shadowColor: REF_COLORS.shadow,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 18,
      elevation: 6,
    },
    queueTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    queueYtNo: {
      fontSize: 30,
      fontWeight: "900",
      color: REF_COLORS.text,
      letterSpacing: -1,
    },
    queueDriverName: {
      fontSize: 24,
      fontWeight: "800",
      color: REF_COLORS.text,
      marginTop: 2,
    },
    queueTime: {
      fontSize: 18,
      fontWeight: "500",
      color: REF_COLORS.subtext,
      paddingTop: 4,
    },
    queueDivider: {
      height: 1,
      backgroundColor: REF_COLORS.line,
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
      color: REF_COLORS.text,
      flexShrink: 1,
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
      backgroundColor: REF_COLORS.green,
      alignItems: "center",
      justifyContent: "center",
    },
    rejectButton: {
      flex: 1,
      minHeight: 66,
      borderRadius: 18,
      backgroundColor: REF_COLORS.red,
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
      color: REF_COLORS.subtext,
    },
    emptyTitle: {
      fontSize: 34,
      fontWeight: "900",
      color: REF_COLORS.text,
      letterSpacing: -1,
    },
    emptyBody: {
      fontSize: 16,
      lineHeight: 24,
      color: REF_COLORS.subtext,
    },
    emptyButton: {
      minHeight: 60,
      borderRadius: 20,
      backgroundColor: REF_COLORS.blue,
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
      color: REF_COLORS.subtext,
      textAlign: "center",
    },
    inlineError: {
      fontSize: 14,
      fontWeight: "700",
      color: REF_COLORS.red,
    },
  });
}

const loadingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: REF_COLORS.screen,
    padding: 24,
  },
  text: {
    fontSize: 15,
    fontWeight: "700",
    color: "#40424a",
    textAlign: "center",
  },
});
