import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vizzy - ROS2 Web Dashboard",
  description: "Web application for visualizing and monitoring ROS2 topics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
