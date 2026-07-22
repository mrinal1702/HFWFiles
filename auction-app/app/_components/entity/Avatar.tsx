"use client";

import Image from "next/image";

const SIZE_CLASS = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-28 w-28 text-2xl sm:h-32 sm:w-32 sm:text-3xl",
} as const;

const SIZE_PX = {
  xs: 20,
  sm: 32,
  md: 48,
  lg: 128,
} as const;

export type AvatarSize = keyof typeof SIZE_CLASS;

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
};

/** Read-only circular avatar with initials fallback (inline chips / headers). */
export function Avatar({ name, avatarUrl, size = "xs", className = "" }: Props) {
  const shown = avatarUrl?.trim() || null;
  const initials = initialsFrom(name);
  const px = SIZE_PX[size];

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-200 bg-sky-50 font-semibold tracking-wide text-sky-800 ${SIZE_CLASS[size]} ${className}`}
      aria-hidden={shown ? true : undefined}
      title={name}
    >
      {shown ? (
        <Image
          src={shown}
          alt=""
          width={px}
          height={px}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}
