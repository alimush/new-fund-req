import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderWrapper from "../components/Header"; // نضيف wrapper
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});


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
        <HeaderWrapper />
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
