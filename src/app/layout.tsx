import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo, Tajawal, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-cairo",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "تواصُل | صالون الدردشة الفوري عبر المتصفح",
  description:
    "منصة دردشة جماعية فورية عبر المتصفح تدعم النصوص، الصور، الفيديو، والتسجيلات الصوتية مع رصد لحظي فائق الدقة للمتصلين.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${tajawal.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="bg-[#070A12] text-[#F8FAFC] antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
