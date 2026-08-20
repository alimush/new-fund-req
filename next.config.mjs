/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/vouchers/reports/export": [
      "./lib/voucher/templates/voucher-daily-form.xlsx",
      "./public/templates/voucher-daily-form.xlsx",
      "./lib/voucher/templates/logos/**/*",
      "./public/بدور_النجف.png",
      "./public/بدور_بغداد.png",
      "./public/طيبة_النجف.png",
      "./public/غدير_كربلاء.png",
      "./public/الغدير.png",
    ],
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  env: {
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    MONGODB_URI: process.env.MONGODB_URI,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    MAIL_FROM: process.env.MAIL_FROM,
  },
};

export default nextConfig;
