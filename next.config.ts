import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        // Cloudinary-hosted profile pictures (optional avatars).
        remotePatterns: [
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
            },
        ],
    },
};

export default nextConfig;
