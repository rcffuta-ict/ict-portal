import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Registration moved to /profile. Links already shared on WhatsApp keep working:
    // the query (?invite=…&reason=…) is carried across by the redirect.
    async redirects() {
        return [{ source: "/register", destination: "/profile", permanent: true }];
    },
    images: {
        remotePatterns: [
            // Cloudinary-hosted profile pictures (optional avatars).
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
            },
            // Development only: the avatars scripts/seed-test.mjs gives its fake members.
            // Gated on NODE_ENV so a production build accepts Cloudinary and nothing else
            // — the seed never runs against production, and neither should its image host
            // be reachable from one.
            ...(process.env.NODE_ENV !== "production"
                ? [{ protocol: "https" as const, hostname: "randomuser.me" }]
                : []),
        ],
    },
};

export default nextConfig;
