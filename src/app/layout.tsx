import type { Metadata } from 'next'
import { AuthProvider } from '@/features/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Codewalk',
  description: 'Guided pull request review.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem("codewalk-theme");
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                const shouldUseDark = theme ? theme === "dark" : prefersDark;
                document.documentElement.classList.toggle("dark", shouldUseDark);
                document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
              } catch {}
            `,
          }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
