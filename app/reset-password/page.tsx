import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password — daam" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" subtitle="You followed a password reset link — set a new password below.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
