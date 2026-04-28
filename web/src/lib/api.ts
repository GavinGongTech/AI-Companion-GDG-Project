import {
  createFirebaseApiClient,
  type ApiFetchOptions,
} from "@study-flow/client";
import {
  clientEventResponseSchema,
  drillQueueResponseSchema,
  eventsResponseSchema,
  graphResponseSchema,
  ingestTextRequestSchema,
  ingestTextResponseSchema,
  ingestUploadResponseSchema,
  trackEventRequestSchema,
  type ClientEventResponse,
  type DrillQueueResponse,
  type EventsResponse,
  type GraphResponse,
  type IngestTextRequest,
  type IngestTextResponse,
  type IngestUploadResponse,
  type TrackEventRequest,
  type GamificationResponse,
  gamificationResponseSchema,
} from "@study-flow/shared";
import { authState, clientMode } from "./firebase";

const apiClient = createFirebaseApiClient(authState, authState.env.VITE_API_URL, {
  mode: clientMode,
});

export const apiUrl = apiClient.apiUrl;

export function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  return apiClient.apiFetch<T>(path, options);
}

export async function fetchGraph(
  options?: ApiFetchOptions,
): Promise<GraphResponse> {
  return graphResponseSchema.parse(await apiFetch("/api/v1/graph", options));
}

export async function fetchDrillQueue(
  options?: ApiFetchOptions,
): Promise<DrillQueueResponse> {
  return drillQueueResponseSchema.parse(
    await apiFetch("/api/v1/graph/drill", options),
  );
}

export async function fetchRecentEvents(
  limit = 20,
  options?: ApiFetchOptions,
): Promise<EventsResponse> {
  return eventsResponseSchema.parse(
    await apiFetch(`/api/v1/events?limit=${limit}`, options),
  );
}

export async function fetchGamification(
  options?: ApiFetchOptions,
): Promise<GamificationResponse> {
  return gamificationResponseSchema.parse(
    await apiFetch("/api/v1/gamification", options),
  );
}

export async function trackClientEvent(
  payload: TrackEventRequest,
  options?: ApiFetchOptions,
): Promise<ClientEventResponse> {
  return clientEventResponseSchema.parse(
    await apiFetch("/api/v1/events/track", {
      method: "POST",
      body: JSON.stringify(trackEventRequestSchema.parse(payload)),
      ...options,
    }),
  );
}

export async function ingestTextContent(
  payload: IngestTextRequest,
  options?: ApiFetchOptions,
): Promise<IngestTextResponse> {
  return ingestTextResponseSchema.parse(
    await apiFetch("/api/v1/ingest/text", {
      method: "POST",
      body: JSON.stringify(ingestTextRequestSchema.parse(payload)),
      ...options,
    }),
  );
}

export async function uploadIngestFile(
  file: File,
  courseId: string,
  options?: ApiFetchOptions,
): Promise<IngestUploadResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("courseId", courseId);

  return ingestUploadResponseSchema.parse(
    await apiFetch("/api/v1/ingest/upload", {
      method: "POST",
      body,
      ...options,
    }),
  );
}
