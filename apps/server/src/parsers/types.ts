import type {
  CraneStatus,
  EquipmentLoginStatus,
  VesselScheduleItem,
  WeatherNoticeSnapshot,
  YTCountSnapshot,
} from "@gwct/shared";

export interface FetchResult {
  source: string;
  url: string;
  statusCode: number | null;
  html: string;
  fetchedAt: string;
  metadata: Record<string, unknown>;
}

export interface ParserDiagnostics {
  parserName: string;
  reason: string;
  diagnostics: Record<string, unknown>;
}

export interface NormalizedSnapshotBundle {
  vessels: VesselScheduleItem[];
  cranes: CraneStatus[];
  equipment: EquipmentLoginStatus[];
  yt: YTCountSnapshot | null;
  weather: WeatherNoticeSnapshot | null;
  diagnostics: ParserDiagnostics[];
}
