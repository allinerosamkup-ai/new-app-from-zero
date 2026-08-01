export const AIRIA_RELEASE_QUERY_PARAM = "__airia_release";

export interface ReleaseWindowClient {
  url: string;
  navigate(url: string): Promise<unknown>;
}

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

export async function navigateClientsToRelease(
  clients: ReleaseWindowClient[],
  buildId: string,
): Promise<void> {
  await Promise.allSettled(
    clients.map(async (client) => {
      const navigationUrl = getReleaseNavigationUrl(client.url, buildId);
      if (navigationUrl) await client.navigate(navigationUrl);
    }),
  );
}
