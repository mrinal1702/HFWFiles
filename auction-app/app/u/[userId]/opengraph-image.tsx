import { OG_CONTENT_TYPE, OG_SIZE, ogCard, ogDefaultCard } from "@/lib/og/card";
import { loadPublicProfile } from "@/lib/public-profile";

// Link preview for a public profile: photo, name and past finishes. Allowlisted fields only.
export const alt = "HFW profile";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-dynamic";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Fetch the avatar as a data URL (PNG/JPEG only — what the image renderer supports). */
async function avatarDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (type !== "image/png" && type !== "image/jpeg") return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const profile = await loadPublicProfile(userId).catch(() => null);
  if (!profile) return ogDefaultCard();

  const finishes = profile.finishes;
  const wins = finishes.filter((f) => f.rank === 1).length;
  const podiums = finishes.filter((f) => f.rank >= 1 && f.rank <= 3).length;
  const summary =
    finishes.length === 0
      ? "New to HFW"
      : [
          `${finishes.length} auction${finishes.length === 1 ? "" : "s"}`,
          wins ? `${wins} win${wins === 1 ? "" : "s"}` : null,
          podiums ? `${podiums} podium${podiums === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return ogCard({
    eyebrow: "HFW profile",
    title: profile.displayName,
    subtitle: summary,
    avatarDataUrl: await avatarDataUrl(profile.avatarUrl),
    avatarInitials: initials(profile.displayName) || "HFW",
    rows: finishes.slice(0, 3).map((f) => ({
      name: f.auctionName,
      sub: String(f.year),
      value: ordinal(f.rank),
      highlight: f.rank === 1,
    })),
    note: finishes.length ? null : "Their trophy cabinet is waiting.",
  });
}
