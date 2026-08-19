"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/lib/auth/actions";
import { FieldLabel, FormMessage, authInputClass } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, undefined);
  return (
    <form action={formAction}>
      <FormMessage error={state?.error} success={state?.success} />
      <div className="mb-4">
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <input id="email" name="email" type="email" required autoComplete="email" className={authInputClass} />
      </div>
      <div className="mb-2">
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={authInputClass} />
      </div>
      <div className="mb-5 text-right">
        <Link href="/forgot-password" className="text-xs font-semibold text-[#0c8b67] hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
    </form>
  );
}
