import {
  clientEventResponseSchema,
  drillQueueResponseSchema,
  eventsResponseSchema,
  graphResponseSchema,
  ingestTextRequestSchema,
  ingestTextResponseSchema,
  ingestUploadResponseSchema,
  trackEventRequestSchema,
  gamificationResponseSchema,
  type ClientEventResponse,
  type DrillQueueResponse,
  type EventsResponse,
  type GraphResponse,
  type IngestTextRequest,
  type IngestTextResponse,
  type IngestUploadResponse,
  type TrackEventRequest,
  type GamificationResponse,
} from "@study-flow/shared";
import { type ApiClient, type ApiFetchOptions } from "./api";

export async function fetchGraph(
  client: ApiClient,
  options?: ApiFetchOptions,
): Promise<GraphResponse> {
  return graphResponseSchema.parse(await client.apiFetch("/api/v1/graph", options));
}

export async function fetchDrillQueue(
  client: ApiClient,
  options?: ApiFetchOptions,
): Promise<DrillQueueResponse> {
  return drillQueueResponseSchema.parse(
    await client.apiFetch("/api/v1/graph/drill", options),
  );
}

export async function fetchRecentEvents(
  client: ApiClient,
  limit = 20,
  options?: ApiFetchOptions,
): Promise<EventsResponse> {
  return eventsResponseSchema.parse(
    await client.apiFetch(`/api/v1/events?limit=${limit}`, options),
  );
}

export async function fetchGamification(
  client: ApiClient,
  options?: ApiFetchOptions,
): Promise<GamificationResponse> {
  return gamificationResponseSchema.parse(
    await client.apiFetch("/api/v1/gamification", options),
  );
}

export async function trackClientEvent(
  client: ApiClient,
  payload: TrackEventRequest,
  options?: ApiFetchOptions,
): Promise<ClientEventResponse> {
  return clientEventResponseSchema.parse(
    await client.apiFetch("/api/v1/events/track", {
      method: "POST",
      body: JSON.stringify(trackEventRequestSchema.parse(payload)),
      ...options,
    }),
  );
}

export async function ingestTextContent(
  client: ApiClient,
  payload: IngestTextRequest,
  options?: ApiFetchOptions,
): Promise<IngestTextResponse> {
  return ingestTextResponseSchema.parse(
    await client.apiFetch("/api/v1/ingest/text", {
      method: "POST",
      body: JSON.stringify(ingestTextRequestSchema.parse(payload)),
      ...options,
    }),
  );
}

export async function uploadIngestFile(
  client: ApiClient,
  file: File | Blob,
  courseId: string,
  options?: ApiFetchOptions,
): Promise<IngestUploadResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("courseId", courseId);

  return ingestUploadResponseSchema.parse(
    await client.apiFetch("/api/v1/ingest/upload", {
      method: "POST",
      body,
      ...options,
    }),
  );
}
