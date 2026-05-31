import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codewalk",
  description: "Guided pull request review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
