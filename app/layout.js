import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderWrapper from "../components/Header";
import { PermissionProvider } from "@/context/PermissionContext";
import { UserProvider } from "@/context/UserContext";
import AuthGate from "@/components/AuthGate";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Fund Request",
  description: "SPC Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Background */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200" />

        {/* Soft blobs */}
        <div className="fixed inset-0 -z-10 opacity-70 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="absolute top-28 right-10 h-80 w-80 rounded-full bg-purple-200/35 blur-3xl" />
          <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
        </div>

        <UserProvider>
          <PermissionProvider>
          <AuthGate>
              <HeaderWrapper />


              <main className="p-6">{children}</main>
            </AuthGate>

          </PermissionProvider>
        </UserProvider>
      </body>
    </html>
  );
}