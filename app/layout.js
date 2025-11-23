import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderWrapper from "../components/Header";
import { PermissionProvider } from "@/context/PermissionContext";
import { UserProvider } from "@/context/UserContext";  // 🟢 تمت الإضافة

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}
      >
        {/* 🟢 لفّ التطبيق كله بداخل UserProvider */}
        <UserProvider>
          {/* 🟢 يبقى PermissionProvider كما هو */}
          <PermissionProvider>
            <HeaderWrapper />
            <main className="p-6">{children}</main>
          </PermissionProvider>
        </UserProvider>
      </body>
    </html>
  );
}