"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import { FieldLabel, FormMessage, authInputClass } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, undefined);
  return (
    <form action={formAction}>
      <FormMessage error={state?.error} success={state?.success} />
      <div className="mb-4">
        <FieldLabel htmlFor="password">New password</FieldLabel>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={authInputClass} />
      </div>
      <div className="mb-5">
        <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
        <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className={authInputClass} />
      </div>
      <SubmitButton pendingText="Updating…">Update password</SubmitButton>
    </form>
  );
}
