import LicenseGuard from "@/components/auth/LicenseGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Layout({ children }) {
  return (
    <LicenseGuard>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </LicenseGuard>
  );
}