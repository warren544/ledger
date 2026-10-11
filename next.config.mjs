/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // `npm run check` owns these pinned checks; avoid Next's auto-install path
  // during production bundling on this Windows workspace.
  typescript: { ignoreBuildErrors: true },
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"]
    };
    if (Array.isArray(config.externals)) config.externals.push("raindrop-ai");
    return config;
  }
};
export default nextConfig;
