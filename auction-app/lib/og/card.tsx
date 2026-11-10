import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * Link-preview cards (WhatsApp / iMessage / social) — Project Socialize H-2.
 * One branded frame for every card; pages pass a title, subtitle and optional table rows.
 * Satori rules: every element with children needs display:flex; no grid.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_SITE_HOST = "hfwauction.vercel.app";

let logoPromise: Promise<string> | null = null;
function logoDataUrl(): Promise<string> {
  logoPromise ??= readFile(join(process.cwd(), "assets/og/hfw-logo.png")).then(
    (buf) => `data:image/png;base64,${buf.toString("base64")}`,
  );
  return logoPromise;
}

export function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** "UEFA Champions League GW4" → "GW4" (falls back to the full name). */
export function shortGwName(name: string): string {
  const m = name.match(/(GW|MW|Matchday|Gameweek)\s*\d+/i);
  return m ? m[0] : name;
}

export type OgRow = {
  /** Left column, e.g. rank "1" or a position "FW". */
  lead?: string;
  name: string;
  /** Smaller text after the name, e.g. team name or club. */
  sub?: string | null;
  /** Right column, e.g. points or price. */
  value: string;
  highlight?: boolean;
};

export type OgCardInput = {
  /** Small label above the title, e.g. "Standings" or "HFW profile". */
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  rows?: OgRow[];
  /** Header shown above the rows' value column, e.g. "Pts". */
  valueLabel?: string;
  /** Shown when there are no rows. */
  note?: string | null;
  /** Optional image (data URL) shown left of the title, e.g. a profile photo. */
  avatarDataUrl?: string | null;
  avatarInitials?: string;
};

export async function ogCard(input: OgCardInput): Promise<ImageResponse> {
  const logo = await logoDataUrl();
  const rows = input.rows ?? [];
  const hasAvatar = Boolean(input.avatarDataUrl || input.avatarInitials);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "40px 56px",
          background: "linear-gradient(120deg, #0f172a 0%, #0c4a6e 55%, #0369a1 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top bar: logo chip + eyebrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "white",
              borderRadius: 18,
              padding: "8px 16px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={112} height={80} alt="" />
          </div>
          {input.eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 600,
                color: "#bae6fd",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {clip(input.eyebrow, 40)}
            </div>
          ) : null}
        </div>

        {/* Title block */}
        <div style={{ display: "flex", alignItems: "center", marginTop: rows.length ? 22 : 56 }}>
          {hasAvatar ? (
            input.avatarDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={input.avatarDataUrl}
                width={128}
                height={128}
                alt=""
                style={{ borderRadius: 64, border: "4px solid white", marginRight: 32, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 128,
                  height: 128,
                  borderRadius: 64,
                  background: "#e0f2fe",
                  color: "#0c4a6e",
                  fontSize: 52,
                  fontWeight: 700,
                  marginRight: 32,
                }}
              >
                {input.avatarInitials}
              </div>
            )
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                fontSize: rows.length ? 50 : 66,
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {clip(input.title, rows.length ? 42 : 34)}
            </div>
            {input.subtitle ? (
              <div style={{ display: "flex", fontSize: 28, color: "#bae6fd", marginTop: 8 }}>
                {clip(input.subtitle, 70)}
              </div>
            ) : null}
          </div>
        </div>

        {/* Table */}
        {rows.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 22,
              background: "white",
              borderRadius: 20,
              padding: "10px 26px",
              color: "#0f172a",
            }}
          >
            {input.valueLabel ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  fontSize: 18,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  paddingTop: 4,
                }}
              >
                {input.valueLabel}
              </div>
            ) : null}
            {rows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 50,
                  borderTop: i === 0 ? "none" : "1px solid #e2e8f0",
                  fontWeight: row.highlight ? 700 : 500,
                }}
              >
                {row.lead !== undefined ? (
                  <div style={{ display: "flex", width: 56, fontSize: 26, color: "#0369a1", fontWeight: 700 }}>
                    {row.lead}
                  </div>
                ) : null}
                <div style={{ display: "flex", flex: 1, alignItems: "baseline", minWidth: 0 }}>
                  <div style={{ display: "flex", fontSize: 28 }}>
                    {clip(row.name, row.lead !== undefined ? 26 : 36)}
                  </div>
                  {row.sub ? (
                    <div style={{ display: "flex", fontSize: 21, color: "#64748b", marginLeft: 14 }}>
                      {clip(row.sub, 30)}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>{row.value}</div>
              </div>
            ))}
          </div>
        ) : input.note ? (
          <div style={{ display: "flex", fontSize: 30, color: "#e0f2fe", marginTop: 36, lineHeight: 1.35 }}>
            {clip(input.note, 120)}
          </div>
        ) : null}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#bae6fd",
          }}
        >
          <div style={{ display: "flex" }}>Fantasy football auctions with friends</div>
          <div style={{ display: "flex" }}>{OG_SITE_HOST}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}

/** Generic HFW card — used when a page has nothing public to show. */
export function ogDefaultCard(): Promise<ImageResponse> {
  return ogCard({
    title: "HFW Fantasy Auction",
    subtitle: "How Football Works",
    note: "Bid on real footballers, score from real matches, and battle your friends for the trophy.",
  });
}
