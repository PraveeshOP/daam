"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthActionState = { error?: string; success?: string } | undefined;

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const trimmedField = (formData: FormData, name: string) => String(formData.get(name) || "").trim();

function friendlyAuthError(message: string) {
  if (/already registered/i.test(message)) return "An account with that email already exists. Try logging in instead.";
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email before logging in — check your inbox.";
  if (/password/i.test(message) && /(least|short|weak)/i.test(message)) return "Please choose a longer password.";
  return "Something went wrong. Please try again.";
}

export async function signUpAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = trimmedField(formData, "email");
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Please enter your email and password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) return { error: friendlyAuthError(error.message) };
  return { success: "Check your email to confirm your account, then log in." };
}

export async function loginAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = trimmedField(formData, "email");
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Please enter your email and password." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendlyAuthError(error.message) };
  redirect("/account");
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = trimmedField(formData, "email");
  if (!email) return { error: "Please enter your email address." };

  const supabase = await createServerSupabaseClient();
  // Always return the same message whether or not the email exists — don't let this form
  // leak which addresses have accounts.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
  return { success: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePasswordAction(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Could not update your password. Please request a new reset link." };
  redirect("/account");
}
