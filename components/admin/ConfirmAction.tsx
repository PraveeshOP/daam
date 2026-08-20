"use client";

import { useRef, useState, useTransition } from "react";

/**
 * A native `<dialog>` confirmation modal for dangerous admin actions (spec §27) — no browser
 * `confirm()`, and no extra modal library needed since `showModal()` already gives a proper
 * focus-trapped, backdrop, Escape-to-close dialog. Calls the Server Action directly (Next.js
 * lets a Client Component invoke one like a normal async function) so it can close the dialog
 * on success and show the error inline on failure, instead of leaving a stale open dialog.
 */
export function ConfirmAction({
  action,
  hiddenFields = {},
  triggerLabel,
  triggerClassName = "rounded-[3px] border border-[#d6dfda] px-3 py-1.5 text-sm font-bold transition hover:border-[#c0392b] hover:text-[#c0392b]",
  title,
  description,
  confirmLabel,
  danger = true,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  hiddenFields?: Record<string, string>;
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result?.error) {
          setError(result.error);
          return;
        }
        dialogRef.current?.close();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => { setError(null); dialogRef.current?.showModal(); }} className={triggerClassName}>
        {triggerLabel}
      </button>
      <dialog ref={dialogRef} className="max-w-[420px] rounded-[4px] border border-[#e3e9e5] p-0 backdrop:bg-[#17221f]/40">
        <form onSubmit={handleSubmit} className="p-6">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">{description}</p>
          {error && <p role="alert" className="mt-3 rounded-[3px] bg-[#fdecea] px-3 py-2 text-sm font-semibold text-[#c0392b]">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-[3px] border border-[#d6dfda] px-4 py-2.5 text-sm font-bold transition hover:border-[#17221f]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`rounded-[3px] px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${danger ? "bg-[#c0392b] hover:bg-[#a5311f]" : "bg-[#17221f] hover:bg-[#0c8b67]"}`}
            >
              {isPending ? "Working…" : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
