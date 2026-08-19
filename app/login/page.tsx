import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in — daam" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to manage your favorites and price alerts."
      footer={
        <p>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-bold text-[#0c8b67] hover:underline">
            Create account
          </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
