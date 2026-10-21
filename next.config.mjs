/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  /* Origines autorisées en développement */
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/structures",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
