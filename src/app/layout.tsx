import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

/* eslint-disable @next/next/no-page-custom-font -- App Router layout makes the font available to every exported page. */

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata: Metadata = {
  title: "Pixel Squeeze — 無料の画像圧縮・変換",
  description:
    "ブラウザだけで画像を圧縮、リサイズ、WebP/JPEG/PNGへ変換。画像は端末の外へ送信されません。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {adsenseClient && <meta name="google-adsense-account" content={adsenseClient} />}
      </head>
      <body>
        {adsenseClient && (
          <Script
            id="adsense"
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
        {children}
      </body>
    </html>
  );
}
