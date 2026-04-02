import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dazzle Links",
  description: "인스타그램 프로필 링크 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col items-center bg-[#f9fafb]">
        {children}
      </body>
    </html>
  );
}
