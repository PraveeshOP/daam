"use client";

import { useRef, useState, useTransition } from "react";
import { acceptAllMatchesAction } from "@/app/admin/actions/matches";

/**
 * Bulk-accept trigger. Separate from ConfirmAction because that component only reports failure —
 * this one has to report a *result* ("accepted 100, 303 still pending"), since the server caps
 * each click at a batch and the operator needs to know whether to click again.
 */
export function AcceptAllMatches({ pendingTotal, batchSize }: { pendingTotal: number; batchSize: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ accepted: number; skipped: number; blocked: number; remaining: number } | null>(null);

  if (!pendingTotal) return null;
  const thisBatch = Math.min(pendingTotal, batchSize);

  const run = () => {
    setError(null);
    startTransition(async () => {
      const response = await acceptAllMatchesAction();
      if (response.error) { setError(response.error); return; }
      setResult({ accepted: response.accepted ?? 0, skipped: response.skipped ?? 0, blocked: response.blocked ?? 0, remaining: response.remaining ?? 0 });
      dialogRef.current?.close();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setResult(null); dialogRef.current?.showModal(); }}
        className="rounded-full border border-[#d6dfda] px-3 py-1.5 text-sm font-bold text-[#66736e] transition hover:border-[#c0392b] hover:text-[#c0392b]"
      >
        Accept all ({pendingTotal})
      </button>

      {result && (
        <p className="w-full text-sm text-[#66736e]" role="status">
          Merged {result.accepted} match{result.accepted === 1 ? "" : "es"}
          {result.blocked ? `, held back ${result.blocked} whose details disagree` : ""}
          {result.skipped ? `, skipped ${result.skipped} already decided` : ""}.{" "}
          {result.remaining ? <strong>{result.remaining} still pending — click again to continue.</strong> : "Nothing left to review."}
        </p>
      )}

      <dialog ref={dialogRef} className="w-[min(30rem,92vw)] rounded-[4px] border border-[#e3e9e5] p-0 backdrop:bg-black/40">
        <div className="p-6">
          <h2 className="text-xl font-bold">Accept {thisBatch} match{thisBatch === 1 ? "" : "es"}?</h2>
          {/*
            Stated plainly rather than softened: every row in this queue is here precisely because
            the matcher scored it 55-74% — uncertain by definition. Bulk-accepting will merge some
            pairs that are not the same product, and there is no unmerge.
          */}
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            This merges each pair into one product, moving offers, price history, favourites and
            alerts onto the surviving product. <strong>It cannot be undone.</strong>
          </p>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Pairs whose names state a different capacity, processor, generation, screen size or
            part number are <strong>held back automatically</strong> and left for you to judge
            individually — so this merges only pairs with nothing concrete contradicting them.
          </p>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            That check is on the product details, not the match percentage. Confidence is not a
            reliable guide here: across the full queue, higher-scoring pairs disagreed on their
            details <em>more</em> often, not less.
          </p>
          {pendingTotal > batchSize && (
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              {pendingTotal} are pending; this handles the oldest {batchSize}.
            </p>
          )}
          {error && <p className="mt-3 text-sm font-semibold text-[#c0392b]">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-[3px] border border-[#d6dfda] px-4 py-2 text-sm font-bold"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={run}
              className="rounded-[3px] bg-[#c0392b] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? `Merging ${thisBatch}…` : `Accept ${thisBatch}`}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
