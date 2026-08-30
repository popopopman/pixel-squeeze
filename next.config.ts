import type { NextConfig } from "next";

const repoName = "pixel-squeeze";
const basePath = process.env.GITHUB_PAGES === "true" ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
