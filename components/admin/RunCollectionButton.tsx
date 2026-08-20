"use client";

import { useState, useTransition } from "react";
import { triggerCollectionAction } from "@/app/admin/actions/stores";

/** §8: queues a job through the existing BullMQ queue and reports back — never runs the
 * collector inside this request, so the click resolves immediately either way. */
export function RunCollectionButton({ storeId }: { storeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const handleClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await triggerCollectionAction(storeId);
      setMessage("error" in result ? { text: result.error, tone: "error" } : { text: result.message, tone: "success" });
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-[3px] bg-[#17221f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0c8b67] disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Queuing…" : "Run collection"}
      </button>
      {message && (
        <p className={`mt-2 text-xs font-semibold ${message.tone === "success" ? "text-[#0c8b67]" : "text-[#c0392b]"}`}>{message.text}</p>
      )}
    </div>
  );
}
