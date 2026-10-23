import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
// A10 — فراخوانی‌های toast در Creator از sonner هستند؛ Toaster همان سیستم نصب می‌شود
import { Toaster } from "@/components/ui/sonner";

const vazirmatn = localFont({
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-vazir",
  display: "swap",
});

export const metadata: Metadata = {
  title: "شخصیت‌ساز قهرمانان | Character Forge",
  description:
    "ساخت شخصیت فانتزی سه‌بعدی با نژادهای انسان، الف، ارگ و دورف — شخصی‌سازی کامل و کتابخانه انیمیشن با Three.js",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0c08",
  width: "device-width",
  initialScale: 1,
  // A28 — محدودیت zoom حذف شد تا بزرگ‌نمایی مرورگر کار کند
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazirmatn.variable} ${vazirmatn.className} antialiased bg-[#0f0c08] text-[#e8ddc8]`}>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
