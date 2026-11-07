/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // optional deps pulled in by wallet libraries that we don't use
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = { ...config.resolve.fallback, "@react-native-async-storage/async-storage": false };
    // optional payment modules pulled in by the Coinbase SDK that the launchpad never uses
    for (const m of ["@x402/evm", "@x402/evm/upto/client", "@x402/evm/exact/client", "@x402/core/client", "@x402/svm/exact/client", "@x402/core", "@x402/svm"]) config.resolve.alias[m] = false;
    return config;
  },
};
export default nextConfig;
