import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Aref_Ruqaa } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});
// خط الرقعة للعناوين والألقاب (طابع ألف ليلة وليلة)
const ruqaa = Aref_Ruqaa({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-ruqaa",
});

export const metadata: Metadata = {
  title: "حصالة علي بابا والأربعين حرامي",
  description: "سجّل نقاط الفريق وشاهد كنز الحمار يمتلئ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${plex.className} ${ruqaa.variable}`}>{children}</body>
    </html>
  );
}