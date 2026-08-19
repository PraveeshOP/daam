import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create account — daam" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Save products and get an email when the price drops."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[#0c8b67] hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
