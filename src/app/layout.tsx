import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata: Metadata = {
  title: "Pixel Squeeze — 無料の画像圧縮・変換",
  description:
    "ブラウザだけで画像を圧縮、リサイズ、WebP/JPEG/PNGへ変換。画像は端末の外へ送信されません。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>{adsenseClient && <meta name="google-adsense-account" content={adsenseClient} />}</head>
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
