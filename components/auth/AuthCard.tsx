import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-12 sm:py-16">
      <div className="w-full max-w-[420px] rounded-[4px] border border-[#e3e9e5] bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-[#edf1ee] pt-5 text-sm text-[#66736e]">{footer}</div>}
      </div>
    </main>
  );
}

export const authInputClass =
  "w-full rounded-[3px] border border-[#d6dfda] bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#0c8b67] focus:ring-4 focus:ring-[#d9f5ec]";

export const authSubmitClass =
  "flex w-full items-center justify-center rounded-[3px] bg-[#17221f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0c8b67] disabled:cursor-not-allowed disabled:opacity-60";

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-[#66736e]">
      {children}
    </label>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <p
      role="alert"
      className={`mb-4 rounded-[3px] px-3 py-2.5 text-sm font-semibold ${error ? "bg-[#fdecea] text-[#c0392b]" : "bg-[#f0fbf7] text-[#0c8b67]"}`}
    >
      {error || success}
    </p>
  );
}
