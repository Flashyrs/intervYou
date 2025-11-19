/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pg', '@neondatabase/serverless'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark these packages as external to prevent webpack from bundling them
      config.externals.push('pg', 'pg-native', 'pg-connection-string');
    } else {
      // For client-side, replace with empty modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        'pg-native': false,
      };
    }
    return config;
  },
};

export default nextConfig;
