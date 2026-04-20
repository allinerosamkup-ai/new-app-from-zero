import { api } from "./api";

type TrackProperties = Record<string, unknown>;

export function trackEvent(
  eventName: string,
  properties: TrackProperties = {},
  path = typeof window !== "undefined" ? window.location.pathname : "/",
) {
  void api.post("/events", {
    eventName,
    properties,
    path,
  }).catch(() => {
    // Tracking never blocks the user flow.
  });
}
