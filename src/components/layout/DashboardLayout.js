"use client";

import { useState } from "react";

import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* =====================================================
          CONTENU
      ====================================================== */}

      <div className="lg:pl-[275px]">
        {/* HEADER */}

        <Header
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* PAGE */}

        <main className="min-h-[calc(100vh-88px)]">
          {children}
        </main>
      </div>
    </div>
  );
}