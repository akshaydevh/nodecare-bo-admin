import { BrandLockup, IconAlert } from './icons';

/** Shown instead of the console when the build is missing required configuration. */
export function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--surface)] px-4">
      <div className="w-full max-w-lg bg-white border border-[var(--line)] rounded-xl p-6 shadow-[var(--shadow)]">
        <BrandLockup />
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#fecdca] bg-[#fef3f2] p-4">
          <IconAlert className="size-5 shrink-0 text-[var(--danger)] mt-0.5" />
          <div>
            <h1 className="text-[15px] font-semibold text-[#b42318]">Console is not configured</h1>
            <p className="mt-1 text-sm text-[#b42318]">{message}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          No requests were sent. If you are not the administrator of this deployment, contact the NOD Care tech team.
        </p>
      </div>
    </div>
  );
}
