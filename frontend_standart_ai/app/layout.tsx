import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Standart Tahlil AI",
  description: "Hujjatlardagi aniq imlo xatolarini tahlil qiluvchi AI tizim",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50">{children}</body>
    </html>
  );
}
