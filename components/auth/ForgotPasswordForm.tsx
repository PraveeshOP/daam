"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { FieldLabel, FormMessage, authInputClass } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, undefined);
  return (
    <form action={formAction}>
      <FormMessage error={state?.error} success={state?.success} />
      <div className="mb-5">
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <input id="email" name="email" type="email" required autoComplete="email" className={authInputClass} />
      </div>
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
