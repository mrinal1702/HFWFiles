import { OG_CONTENT_TYPE, OG_SIZE, ogDefaultCard } from "@/lib/og/card";

// Default link preview for every page that doesn't define its own.
export const alt = "HFW Fantasy Auction";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogDefaultCard();
}
