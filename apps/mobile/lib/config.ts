export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000";

export const API_URLS = {
  summary: `${API_BASE_URL}/api/dashboard/summary`,
  vessels: `${API_BASE_URL}/api/vessels/live`,
  cranes: `${API_BASE_URL}/api/cranes/live`,
  scheduleFocusLatest: `${API_BASE_URL}/api/schedule/focus/latest`,
  equipment: `${API_BASE_URL}/api/equipment/live`,
  equipmentLatest: `${API_BASE_URL}/api/equipment/latest`,
  equipmentConfig: `${API_BASE_URL}/api/equipment/config`,
  yt: `${API_BASE_URL}/api/yt/live`,
  ytWorkTime: `${API_BASE_URL}/api/yt/work-time`,
  weather: `${API_BASE_URL}/api/weather/live`,
  gcLatest: `${API_BASE_URL}/api/gc/latest`,
  monitorsConfig: `${API_BASE_URL}/api/monitors/config`,
  monitorsStatus: `${API_BASE_URL}/api/monitors/status`,
  monitorGwctEta: `${API_BASE_URL}/api/monitors/gwct-eta`,
  monitorGcRemaining: `${API_BASE_URL}/api/monitors/gc-remaining`,
  monitorEquipment: `${API_BASE_URL}/api/monitors/equipment`,
  monitorYeosu: `${API_BASE_URL}/api/monitors/yeosu`,
  alerts: `${API_BASE_URL}/api/alerts`,
  events: `${API_BASE_URL}/api/events`,
  ytMasterCallLive: (deviceId: string) =>
    `${API_BASE_URL}/api/yt-master-call/live?deviceId=${encodeURIComponent(deviceId)}`,
  ytMasterCallRegister: `${API_BASE_URL}/api/yt-master-call/register`,
  ytMasterCallClear: (deviceId: string) =>
    `${API_BASE_URL}/api/yt-master-call/register/${encodeURIComponent(deviceId)}`,
  ytMasterCallCalls: `${API_BASE_URL}/api/yt-master-call/calls`,
  ytMasterCallCancel: (callId: string) =>
    `${API_BASE_URL}/api/yt-master-call/calls/${encodeURIComponent(callId)}`,
  ytMasterCallDecision: (callId: string) =>
    `${API_BASE_URL}/api/yt-master-call/calls/${encodeURIComponent(callId)}/decision`,
  registerDevice: `${API_BASE_URL}/api/devices/register`,
  updateSettings: (deviceId: string) => `${API_BASE_URL}/api/settings/device/${encodeURIComponent(deviceId)}`,
  sse: `${API_BASE_URL}/api/stream/events`,
};
