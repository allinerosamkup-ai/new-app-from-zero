export const AIRIA_RELEASE_QUERY_PARAM = "__airia_release";

export function getReleaseNavigationUrl(
  clientUrl: string,
  buildId: string,
): string | null {
  const release = buildId.trim();
  if (!release) return null;

  const url = new URL(clientUrl);
  if (url.searchParams.get(AIRIA_RELEASE_QUERY_PARAM) === release) {
    return null;
  }

  url.searchParams.set(AIRIA_RELEASE_QUERY_PARAM, release);
  return url.href;
}
