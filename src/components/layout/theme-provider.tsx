"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Dark mode is not a preference here — the plant runs early mornings and late
 * evenings. `disableTransitionOnChange` stops every coloured element on the
 * page animating at once when the theme flips.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
