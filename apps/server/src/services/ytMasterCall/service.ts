import {
  getYtMasterCallHandlingMode,
  getYtMasterCallReasonDetailLabel,
  YT_MASTER_CALL_REASON_LABELS,
  type YtMasterCallCancelInput,
  type YtMasterCallCreateInput,
  type YtMasterCallDecisionInput,
  type YtMasterCallLiveState,
  type YtMasterCallMasterAssignment,
  type YtMasterCallMasterSlot,
  type YtMasterCallQueueEntry,
  type YtMasterCallRegistration,
  type YtMasterCallRegistrationInput,
} from "@gwct/shared";
import { uid } from "../../lib/id.js";
import {
  loadYtMasterCallState,
  mutateYtMasterCallState,
  type YtMasterCallStoredState,
} from "./store.js";

const MASTER_SLOTS: YtMasterCallMasterSlot[] = ["MASTER-1", "MASTER-2"];

export class YtMasterCallServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function normalizeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new YtMasterCallServiceError(400, "이름을 입력해 주세요.");
  }
  return trimmed;
}

function normalizeYtNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new YtMasterCallServiceError(400, "YT 번호를 입력해 주세요.");
  }

  const digitsOnly = trimmed.replace(/[^0-9]/g, "");
  if (digitsOnly.length) {
    return `YT-${digitsOnly}`;
  }

  const upper = trimmed.toUpperCase().replace(/\s+/g, "");
  if (upper.startsWith("YT-")) {
    return upper;
  }
  if (upper.startsWith("YT")) {
    return `YT-${upper.slice(2)}`;
  }
  return upper;
}

function compareIsoAsc(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

function compareIsoDesc(left: string, right: string): number {
  return compareIsoAsc(right, left);
}

function compareSlotAsc(
  left: YtMasterCallMasterAssignment,
  right: YtMasterCallMasterAssignment,
): number {
  return MASTER_SLOTS.indexOf(left.slot) - MASTER_SLOTS.indexOf(right.slot);
}

function hasPendingDriverCall(state: YtMasterCallStoredState, deviceId: string): boolean {
  return state.calls.some((call) => call.driverDeviceId === deviceId && call.status === "pending");
}

function buildMasterAssignments(registrations: YtMasterCallRegistration[]): YtMasterCallMasterAssignment[] {
  return registrations
    .filter((registration) => registration.role === "master" && registration.masterSlot)
    .map((registration) => ({
      slot: registration.masterSlot!,
      deviceId: registration.deviceId,
      name: registration.name,
    }))
    .sort(compareSlotAsc);
}

function buildAvailableMasterSlots(registrations: YtMasterCallRegistration[]): YtMasterCallMasterSlot[] {
  const occupied = new Set(
    registrations
      .filter((registration) => registration.role === "master" && registration.masterSlot)
      .map((registration) => registration.masterSlot as YtMasterCallMasterSlot),
  );
  return MASTER_SLOTS.filter((slot) => !occupied.has(slot));
}

function buildCurrentCall(state: YtMasterCallStoredState, deviceId: string): YtMasterCallQueueEntry | null {
  const latestCall = state.calls
    .filter((call) => call.driverDeviceId === deviceId)
    .sort((left, right) => compareIsoDesc(left.createdAt, right.createdAt))[0];

  if (!latestCall || latestCall.status === "cancelled") {
    return null;
  }

  return latestCall;
}

function buildMasterQueue(state: YtMasterCallStoredState): YtMasterCallQueueEntry[] {
  const visible = state.calls.filter((call) => call.status !== "cancelled" && call.status !== "acknowledged");
  const pending = visible
    .filter((call) => call.status === "pending" || call.status === "sent")
    .sort((left, right) => compareIsoAsc(left.createdAt, right.createdAt));
  const resolved = visible
    .filter((call) => call.status !== "pending" && call.status !== "sent")
    .sort((left, right) => compareIsoAsc(left.createdAt, right.createdAt));
  return [...pending, ...resolved];
}

function buildLiveStateFromState(state: YtMasterCallStoredState, deviceId: string): YtMasterCallLiveState {
  const registration = state.registrations.find((item) => item.deviceId === deviceId) || null;
  const masterAssignments = buildMasterAssignments(state.registrations);
  return {
    deviceId,
    registration,
    masterAssignments,
    availableMasterSlots: buildAvailableMasterSlots(state.registrations),
    currentCall: buildCurrentCall(state, deviceId),
    queue: registration?.role === "master" ? buildMasterQueue(state) : [],
    pendingCount: state.calls.filter((call) => call.status === "pending" || call.status === "sent").length,
  };
}

export async function getYtMasterCallLiveState(deviceId: string): Promise<YtMasterCallLiveState> {
  const state = await loadYtMasterCallState();
  return buildLiveStateFromState(state, deviceId);
}

export async function saveYtMasterCallRegistration(
  input: YtMasterCallRegistrationInput,
): Promise<YtMasterCallLiveState> {
  return mutateYtMasterCallState(async (current) => {
    const now = new Date().toISOString();
    const existing = current.registrations.find((registration) => registration.deviceId === input.deviceId) || null;

    if (existing?.role === "driver" && input.role !== "driver" && hasPendingDriverCall(current, input.deviceId)) {
      throw new YtMasterCallServiceError(409, "대기 중인 호출이 있어 권한을 변경할 수 없습니다.");
    }

    let nextRegistration: YtMasterCallRegistration;
    if (input.role === "master") {
      const name = normalizeName(input.name);
      const currentSlot = existing?.role === "master" ? existing.masterSlot : null;
      const availableSlots = buildAvailableMasterSlots(
        current.registrations.filter((item) => item.deviceId !== input.deviceId),
      );
      const assignedSlot = currentSlot || availableSlots[0] || null;
      if (!assignedSlot) {
        throw new YtMasterCallServiceError(409, "YT Master 자리가 모두 사용 중입니다.");
      }
      nextRegistration = {
        deviceId: input.deviceId,
        role: "master",
        name,
        ytNumber: null,
        masterSlot: assignedSlot,
        registeredAt: existing?.registeredAt || now,
        updatedAt: now,
      };
    } else {
      nextRegistration = {
        deviceId: input.deviceId,
        role: "driver",
        name: normalizeName(input.name),
        ytNumber: normalizeYtNumber(input.ytNumber),
        masterSlot: null,
        registeredAt: existing?.registeredAt || now,
        updatedAt: now,
      };
    }

    const nextState: YtMasterCallStoredState = {
      ...current,
      registrations: current.registrations
        .filter((registration) => registration.deviceId !== input.deviceId)
        .concat(nextRegistration),
    };

    return {
      state: nextState,
      result: buildLiveStateFromState(nextState, input.deviceId),
    };
  });
}

export async function clearYtMasterCallRegistration(deviceId: string): Promise<YtMasterCallLiveState> {
  return mutateYtMasterCallState(async (current) => {
    const existing = current.registrations.find((registration) => registration.deviceId === deviceId);
    if (!existing) {
      return {
        state: current,
        result: buildLiveStateFromState(current, deviceId),
      };
    }

    if (existing.role === "driver" && hasPendingDriverCall(current, deviceId)) {
      throw new YtMasterCallServiceError(409, "대기 중인 호출이 있어 권한을 해제할 수 없습니다.");
    }

    const nextState: YtMasterCallStoredState = {
      ...current,
      registrations: current.registrations.filter((registration) => registration.deviceId !== deviceId),
    };

    return {
      state: nextState,
      result: buildLiveStateFromState(nextState, deviceId),
    };
  });
}

export async function createYtMasterCall(input: YtMasterCallCreateInput): Promise<YtMasterCallLiveState> {
  return mutateYtMasterCallState(async (current) => {
    const registration = current.registrations.find((item) => item.deviceId === input.deviceId);
    if (!registration || registration.role !== "driver" || !registration.ytNumber) {
      throw new YtMasterCallServiceError(403, "YT Driver 권한이 필요합니다.");
    }
    if (hasPendingDriverCall(current, input.deviceId)) {
      throw new YtMasterCallServiceError(409, "이미 대기 중인 호출이 있습니다.");
    }

    const now = new Date().toISOString();
    const handlingMode = getYtMasterCallHandlingMode(input.reasonCode, input.reasonDetailCode);
    const call: YtMasterCallQueueEntry = {
      id: uid("yt_master_call"),
      driverDeviceId: registration.deviceId,
      driverName: registration.name,
      ytNumber: registration.ytNumber,
      reasonCode: input.reasonCode,
      reasonLabel: YT_MASTER_CALL_REASON_LABELS[input.reasonCode],
      reasonDetailCode:
        input.reasonCode === "tractor_inspection" || input.reasonCode === "other"
          ? input.reasonDetailCode || null
          : null,
      reasonDetailLabel: getYtMasterCallReasonDetailLabel(input.reasonCode, input.reasonDetailCode),
      handlingMode,
      status: handlingMode === "message" ? "sent" : "pending",
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      resolvedByDeviceId: null,
      resolvedByName: null,
    };

    const nextState: YtMasterCallStoredState = {
      ...current,
      calls: current.calls.concat(call),
    };

    return {
      state: nextState,
      result: buildLiveStateFromState(nextState, input.deviceId),
    };
  });
}

export async function cancelYtMasterCall(
  callId: string,
  input: YtMasterCallCancelInput,
): Promise<{ liveState: YtMasterCallLiveState; call: YtMasterCallQueueEntry }> {
  return mutateYtMasterCallState(async (current) => {
    const registration = current.registrations.find((item) => item.deviceId === input.deviceId);
    if (!registration || registration.role !== "driver") {
      throw new YtMasterCallServiceError(403, "YT Driver 권한이 필요합니다.");
    }

    const target = current.calls.find((call) => call.id === callId);
    if (!target) {
      throw new YtMasterCallServiceError(404, "호출 정보를 찾을 수 없습니다.");
    }
    if (target.driverDeviceId !== input.deviceId) {
      throw new YtMasterCallServiceError(403, "본인 호출만 취소할 수 있습니다.");
    }
    if (target.status !== "pending") {
      throw new YtMasterCallServiceError(409, "대기 중인 호출만 취소할 수 있습니다.");
    }

    const now = new Date().toISOString();
    const cancelledCall: YtMasterCallQueueEntry = {
      ...target,
      status: "cancelled",
      updatedAt: now,
      resolvedAt: now,
      resolvedByDeviceId: input.deviceId,
      resolvedByName: registration.name,
    };

    const nextState: YtMasterCallStoredState = {
      ...current,
      calls: current.calls.map((call) => (call.id === callId ? cancelledCall : call)),
    };

    return {
      state: nextState,
      result: {
        liveState: buildLiveStateFromState(nextState, input.deviceId),
        call: cancelledCall,
      },
    };
  });
}

export async function decideYtMasterCall(
  callId: string,
  input: YtMasterCallDecisionInput,
): Promise<{ liveState: YtMasterCallLiveState; call: YtMasterCallQueueEntry }> {
  return mutateYtMasterCallState(async (current) => {
    const registration = current.registrations.find((item) => item.deviceId === input.deviceId);
    if (!registration || registration.role !== "master") {
      throw new YtMasterCallServiceError(403, "YT Master 권한이 필요합니다.");
    }

    const target = current.calls.find((call) => call.id === callId);
    if (!target) {
      throw new YtMasterCallServiceError(404, "호출 정보를 찾을 수 없습니다.");
    }
    if (target.status !== "pending" && target.status !== "sent") {
      throw new YtMasterCallServiceError(409, "이미 처리된 호출입니다.");
    }

    if (target.handlingMode === "message") {
      if (target.status !== "sent") {
        throw new YtMasterCallServiceError(409, "이미 처리된 호출입니다.");
      }
      if (input.status !== "acknowledged") {
        throw new YtMasterCallServiceError(409, "메시지 접수는 확인만 가능합니다.");
      }
    } else {
      if (target.status !== "pending") {
        throw new YtMasterCallServiceError(409, "이미 처리된 호출입니다.");
      }
      if (input.status === "acknowledged") {
        throw new YtMasterCallServiceError(409, "승인형 호출은 확인 처리할 수 없습니다.");
      }
    }

    const now = new Date().toISOString();
    const updatedCall: YtMasterCallQueueEntry = {
      ...target,
      status: input.status,
      updatedAt: now,
      resolvedAt: now,
      resolvedByDeviceId: registration.deviceId,
      resolvedByName: registration.name,
    };

    const nextState: YtMasterCallStoredState = {
      ...current,
      calls: current.calls.map((call) => (call.id === callId ? updatedCall : call)),
    };

    return {
      state: nextState,
      result: {
        liveState: buildLiveStateFromState(nextState, input.deviceId),
        call: updatedCall,
      },
    };
  });
}
