import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 【追加1】これをインポートする
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chatia（チャティア）- 匿名・登録不要で気軽に話せるチャットサイト", 
  description: "誰でも登録不要ですぐに話せるチャットサイトです。趣味の話題から暇つぶしまで、みんなでワイワイ盛り上がろう！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja" 
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* 【追加2】ここに入れる！ */}
        <Analytics />
      </body>
    </html>
  );
}