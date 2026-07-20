"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

import { clearAvatarAction, setAvatarUrlAction } from "./avatar-actions";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type Props = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export function ProfileAvatar({ userId, displayName, avatarUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = previewUrl;
  const initials = initialsFrom(displayName);

  function openPicker() {
    setError(null);
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Please choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 2 MB or smaller.");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const ext = extensionFor(file.type);
        const path = `${userId}/avatar.${ext}`;

        const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });
        if (upErr) {
          setError(upErr.message);
          return;
        }

        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

        const result = await setAvatarUrlAction(publicUrl.split("?")[0]!);
        if (result?.ok === false) {
          setError(result.message);
          return;
        }

        setPreviewUrl(publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  function onRemove() {
    startTransition(async () => {
      setError(null);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: listed } = await supabase.storage.from("avatars").list(userId);
        const names = (listed ?? []).map((f) => `${userId}/${f.name}`);
        if (names.length > 0) {
          await supabase.storage.from("avatars").remove(names);
        }

        const result = await clearAvatarAction();
        if (result?.ok === false) {
          setError(result.message);
          return;
        }
        setPreviewUrl(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove photo.");
      }
    });
  }

  return (
    <div className="mb-6 flex flex-col items-center gap-3 sm:mb-8">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onFileChange}
        disabled={pending}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={pending}
        aria-label={shown ? "Change profile picture" : "Upload profile picture"}
        className="group relative h-28 w-28 overflow-hidden rounded-full border-2 border-sky-200 bg-sky-50 shadow-sm transition hover:border-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:opacity-60 sm:h-32 sm:w-32"
      >
        {shown ? (
          <Image
            src={shown}
            alt=""
            fill
            unoptimized
            className="object-cover"
            sizes="128px"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-semibold tracking-wide text-sky-700 sm:text-3xl">
            {initials}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-slate-900/55 py-1.5 text-center text-[11px] font-medium text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {pending ? "Saving…" : shown ? "Change" : "Add photo"}
        </span>
      </button>

      <h1 className="max-w-md text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {displayName}
      </h1>

      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <button
          type="button"
          onClick={openPicker}
          disabled={pending}
          className="font-medium text-sky-700 underline hover:text-sky-900 disabled:opacity-50"
        >
          {shown ? "Change photo" : "Upload profile picture"}
        </button>
        {shown && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {error && (
        <p className="max-w-sm text-center text-sm leading-relaxed text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
