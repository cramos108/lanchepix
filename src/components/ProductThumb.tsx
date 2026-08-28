"use client";

import { categoryEmoji } from "@/lib/productImage";

export function ProductThumb({
  imageData,
  category,
  name,
  size = "md",
}: {
  imageData?: string;
  category: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg"
      ? "h-36 w-full"
      : size === "sm"
        ? "h-14 w-14"
        : "h-20 w-20";
  const emoji =
    size === "lg" ? "text-6xl" : size === "sm" ? "text-2xl" : "text-4xl";

  if (imageData) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageData}
        alt={name}
        className={`${box} rounded-2xl object-cover`}
      />
    );
  }

  return (
    <div
      className={`${box} grid place-items-center rounded-2xl border-2 border-line bg-surface2`}
      aria-hidden
    >
      <span className={emoji}>{categoryEmoji(category)}</span>
    </div>
  );
}
