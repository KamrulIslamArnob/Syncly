import localFont from "next/font/local";
import "./globals.css";
import ThemeProvider from "../components/ThemeProvider";

const jakarta = localFont({
  src: "../public/fonts/plusjakartasans-var.woff2",
  weight: "200 800",
  variable: "--font-body",
  display: "swap",
});

const jetbrains = localFont({
  src: "../public/fonts/jetbrainsmono-var.woff2",
  weight: "100 800",
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Syncly · Local-First Bookmark OS for Chrome",
  description:
    "A zero-backend bookmark manager built on your real Chrome bookmarks. Workspaces, collections and tags — synced by Chrome itself. No account, no server, no telemetry.",
  openGraph: {
    title: "Syncly · Local-First Bookmark OS for Chrome",
    description:
      "Workspaces, collections and tags on your real Chrome bookmarks. Synced by Chrome itself — no backend, no account, no telemetry.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('syncly-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',t||(d?'dark':'dark'));document.documentElement.setAttribute('data-aura','purple');document.documentElement.setAttribute('data-pattern','dots');}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${jakarta.variable} ${jetbrains.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
