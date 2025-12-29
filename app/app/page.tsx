import DashboardClient from "./dashboard-client";

// Force dynamic rendering to prevent static page generation issues with Clerk auth
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardClient />;
}
