export async function recoverGoalActionsOnce(
  guard: { status: 'idle' | 'inFlight' | 'completed' },
  recoverGoalActions: () => Promise<void>,
): Promise<void> {
  if (guard.status !== 'idle') return;
  guard.status = 'inFlight';
  try {
    await recoverGoalActions();
    guard.status = 'completed';
  } catch (error) {
    guard.status = 'idle';
    throw error;
  }
}

export function GoalRecoveryNotice({
  message,
  retryLabel,
  retrying,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <section
      role="alert"
      style={{
        marginBottom: 14,
        padding: '13px 14px',
        border: '1px solid rgba(134,183,154,.35)',
        borderRadius: 16,
        background: 'rgba(255,255,255,.9)',
      }}
    >
      <p style={{ margin: '0 0 10px', color: 'var(--text-2)', fontSize: 12, lineHeight: 1.45 }}>
        {message}
      </p>
      <button
        type="button"
        disabled={retrying}
        onClick={onRetry}
        style={{
          minHeight: 40,
          border: '1px solid var(--nectarine)',
          borderRadius: 12,
          background: 'transparent',
          color: 'var(--nectarine)',
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 800,
          cursor: retrying ? 'wait' : 'pointer',
        }}
      >
        {retrying ? '…' : retryLabel}
      </button>
    </section>
  );
}
