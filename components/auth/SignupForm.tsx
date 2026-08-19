"use client";

import { useActionState } from "react";
import { signUpAction } from "@/lib/auth/actions";
import { FieldLabel, FormMessage, authInputClass } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function SignupForm() {
  const [state, formAction] = useActionState(signUpAction, undefined);
  return (
    <form action={formAction}>
      <FormMessage error={state?.error} success={state?.success} />
      <div className="mb-4">
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <input id="email" name="email" type="email" required autoComplete="email" className={authInputClass} />
      </div>
      <div className="mb-5">
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={authInputClass} />
        <p className="mt-1.5 text-xs text-[#88948e]">At least 8 characters.</p>
      </div>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
