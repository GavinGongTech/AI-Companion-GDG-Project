import {
  createFirebaseApiClient,
  type ApiFetchOptions,
  fetchGraph as clientFetchGraph,
  fetchDrillQueue as clientFetchDrillQueue,
  fetchRecentEvents as clientFetchRecentEvents,
  fetchGamification as clientFetchGamification,
  trackClientEvent as clientTrackClientEvent,
  ingestTextContent as clientIngestTextContent,
  uploadIngestFile as clientUploadIngestFile,
} from "@study-flow/client";
import {
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
  return clientFetchGraph(apiClient, options);
}

export async function fetchDrillQueue(
  options?: ApiFetchOptions,
): Promise<DrillQueueResponse> {
  return clientFetchDrillQueue(apiClient, options);
}

export async function fetchRecentEvents(
  limit = 20,
  options?: ApiFetchOptions,
): Promise<EventsResponse> {
  return clientFetchRecentEvents(apiClient, limit, options);
}

export async function fetchGamification(
  options?: ApiFetchOptions,
): Promise<GamificationResponse> {
  return clientFetchGamification(apiClient, options);
}

export async function trackClientEvent(
  payload: TrackEventRequest,
  options?: ApiFetchOptions,
): Promise<ClientEventResponse> {
  return clientTrackClientEvent(apiClient, payload, options);
}

export async function ingestTextContent(
  payload: IngestTextRequest,
  options?: ApiFetchOptions,
): Promise<IngestTextResponse> {
  return clientIngestTextContent(apiClient, payload, options);
}

export async function uploadIngestFile(
  file: File,
  courseId: string,
  options?: ApiFetchOptions,
): Promise<IngestUploadResponse> {
  return clientUploadIngestFile(apiClient, file, courseId, options);
}
