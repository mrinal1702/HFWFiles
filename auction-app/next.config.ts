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
