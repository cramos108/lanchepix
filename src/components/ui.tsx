"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "min-h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 text-lg font-semibold text-white placeholder:text-muted/70 outline-none focus:border-sun";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-sun">
        {label}
      </span>
      {children}
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

type BtnVariant = "sun" | "ghost" | "mint" | "alert" | "amber" | "line";

const variants: Record<BtnVariant, string> = {
  sun: "bg-sun text-sunink border-sun",
  ghost: "bg-transparent text-white border-line",
  mint: "bg-mint text-sunink border-mint",
  alert: "bg-alert text-white border-alert",
  amber: "bg-amber text-sunink border-amber",
  line: "bg-surface2 text-white border-line",
};

export function Button({
  variant = "sun",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-base font-extrabold tracking-wide uppercase disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/75"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border-2 border-line bg-ink p-5 sm:rounded-3xl ${
          wide ? "sm:max-w-lg" : "sm:max-w-md"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="modal-title" className="text-2xl font-black leading-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-xl border-2 border-line text-xl font-black"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="grid h-12 w-12 place-items-center rounded-xl border-2 border-line bg-surface2 text-2xl font-black"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Diminuir quantidade"
      >
        −
      </button>
      <span className="min-w-8 text-center text-xl font-black tabular-nums">{value}</span>
      <button
        type="button"
        className="grid h-12 w-12 place-items-center rounded-xl border-2 border-sun bg-sun text-2xl font-black text-sunink"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Aumentar quantidade"
      >
        +
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line bg-surface px-5 py-10 text-center">
      <p className="text-xl font-black">{title}</p>
      <p className="mt-2 text-base text-muted">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
