import type {
  YtMasterCallCancelInput,
  YtMasterCallCreateInput,
  YtMasterCallDecisionInput,
  YtMasterCallLiveState,
  YtMasterCallRegistrationInput,
  YtMasterCallVisibilityInput,
} from "@gwct/shared";
import { API_URLS } from "./config";
import { fetchJson } from "./fetchJson";

export async function fetchYtMasterCallLiveState(deviceId: string): Promise<YtMasterCallLiveState> {
  return fetchJson<YtMasterCallLiveState>(API_URLS.ytMasterCallLive(deviceId));
}

export async function saveYtMasterCallRegistration(
  input: YtMasterCallRegistrationInput,
): Promise<YtMasterCallLiveState> {
  return fetchJson<YtMasterCallLiveState>(API_URLS.ytMasterCallRegister, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function clearYtMasterCallRegistration(deviceId: string): Promise<YtMasterCallLiveState> {
  return fetchJson<YtMasterCallLiveState>(API_URLS.ytMasterCallClear(deviceId), {
    method: "DELETE",
  });
}

export async function createYtMasterCall(
  input: YtMasterCallCreateInput,
): Promise<YtMasterCallLiveState> {
  return fetchJson<YtMasterCallLiveState>(API_URLS.ytMasterCallCalls, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function cancelYtMasterCall(
  callId: string,
  input: YtMasterCallCancelInput,
): Promise<{ liveState: YtMasterCallLiveState }> {
  return fetchJson<{ liveState: YtMasterCallLiveState }>(API_URLS.ytMasterCallCancel(callId), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function decideYtMasterCall(
  callId: string,
  input: YtMasterCallDecisionInput,
): Promise<{ liveState: YtMasterCallLiveState }> {
  return fetchJson<{ liveState: YtMasterCallLiveState }>(API_URLS.ytMasterCallDecision(callId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateYtMasterCallVisibility(
  callId: string,
  input: YtMasterCallVisibilityInput,
): Promise<{ liveState: YtMasterCallLiveState }> {
  return fetchJson<{ liveState: YtMasterCallLiveState }>(API_URLS.ytMasterCallVisibility(callId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
