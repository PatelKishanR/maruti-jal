import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Gujarati } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/**
 * Inter has NO Gujarati glyphs.
 *
 * This sits after Inter in the --font-sans stack, and browsers fall back per
 * character — so a line mixing "Ramesh" and "રમેશ" renders correctly in one
 * pass. Without it, every Gujarati name is a row of tofu boxes, and it
 * presents as a data problem rather than a font problem.
 * See .claude/I18N.md §5.3
 */
const notoGujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  variable: "--font-noto-gujarati",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Maruti Jal",
  description: "Water supply business management",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      // next-themes writes the class before paint; without this React warns
      // about the mismatch on every load.
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoGujarati.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* SessionProvider lets the change-password flow refresh THIS device's
            token via update(), so it stays signed in while every other device
            is signed out. */}
        <SessionProvider>
          <NextIntlClientProvider messages={messages}>
            <ThemeProvider>
              {children}
              {/* Inside ThemeProvider so toasts follow light/dark. */}
              <Toaster />
            </ThemeProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
