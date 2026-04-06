import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { Dashboard } from '@/shared/components/dashboard/Dashboard';

const authenticatedApi = getRouteApi('/_authenticated');

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { session } = authenticatedApi.useRouteContext();
  return <Dashboard session={session} />;
}
