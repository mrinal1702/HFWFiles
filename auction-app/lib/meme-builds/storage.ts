"use client";

import type { MemeBuild } from "@/lib/meme-builds/types";

const STORAGE_VERSION = 1;

function storageKey(userId: string): string {
  return `hfw-meme-builds:v${STORAGE_VERSION}:${userId}`;
}

type StoredPayload = {
  version: number;
  builds: MemeBuild[];
};

function parsePayload(raw: string | null): MemeBuild[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.builds)) return [];
    return parsed.builds.filter(
      (b) =>
        b &&
        typeof b.id === "string" &&
        typeof b.name === "string" &&
        Array.isArray(b.players),
    );
  } catch {
    return [];
  }
}

export function loadMemeBuilds(userId: string): MemeBuild[] {
  if (typeof window === "undefined") return [];
  return parsePayload(window.localStorage.getItem(storageKey(userId)));
}

export function saveMemeBuilds(userId: string, builds: MemeBuild[]): void {
  if (typeof window === "undefined") return;
  const payload: StoredPayload = { version: STORAGE_VERSION, builds };
  window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
}

export function createMemeBuild(name: string): MemeBuild {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled build",
    players: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function touchBuild(build: MemeBuild): MemeBuild {
  return { ...build, updatedAt: new Date().toISOString() };
}
