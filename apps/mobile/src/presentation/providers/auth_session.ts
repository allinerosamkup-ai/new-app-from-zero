export type SessionSnapshot = {
  session: {
    user: {
      id: string;
    };
  } | null;
};

export function getSessionUserId(snapshot: SessionSnapshot): string | null {
  return snapshot.session?.user.id ?? null;
}
