import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    // La landing pubblica arriva in una fase successiva: per ora "/" porta all'app.
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
