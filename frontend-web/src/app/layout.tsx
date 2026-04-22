import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { FCMProvider } from "@/components/fcm-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MySmartStudy",
  description: "Collaborative learning platform for students and lecturers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <FCMProvider>
            <AuthProvider>{children}</AuthProvider>
          </FCMProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
