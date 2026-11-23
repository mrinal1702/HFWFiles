import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : "ealowpaiiwsrbwucgkng.supabase.co";
  } catch {
    return "ealowpaiiwsrbwucgkng.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  // Match-score manifests + CSVs and Best XI overlays are read from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*"],
  },
  // Public HFW Stats dashboard (static page in public/hfw-stats/, built by scripts/build-public-stats.mjs).
  // Not permanent, so /stats can point at a new competition later.
  async redirects() {
    return [{ source: "/stats", destination: "/hfw-stats/uefa-cl-2026-27/index.html", permanent: false }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
