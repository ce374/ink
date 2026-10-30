import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-ui-var",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ink",
  description: "Workspace",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrains.variable} antialiased`}
        style={{ margin: 0 }}
      >
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontSize: "12px",
              borderRadius: "5px",
              border: "1px solid var(--line-2)",
              background: "var(--paper)",
              color: "var(--ink)",
            },
          }}
        />
      </body>
    </html>
  );
}
