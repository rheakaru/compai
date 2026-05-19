'use client';

import { useAuth } from './AuthProvider';

export function AuthGateModal({
  open,
  onClose,
  onSignedIn
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const { signIn } = useAuth();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-6">
      <div className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-900">
          Sign in to save your correction
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          You've spotted something we got wrong. Sign in to save it and watch your profile sharpen.
        </p>
        <button
          type="button"
          onClick={async () => {
            try {
              await signIn();
              onSignedIn();
            } catch {
              // user closed the popup — keep modal open
            }
          }}
          className="mt-5 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-600"
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-md border border-ink-200 bg-white px-4 py-2 text-sm text-ink-500 hover:text-ink-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
