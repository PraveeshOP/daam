"use client";

import { useFormStatus } from "react-dom";
import { authSubmitClass } from "@/components/auth/AuthCard";

export function SubmitButton({ children, pendingText }: { children: string; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={authSubmitClass}>
      {pending ? pendingText : children}
    </button>
  );
}
