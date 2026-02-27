'use client';

import { UserMenu } from './UserMenu';

interface DashboardNavProps {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
}

export function DashboardNav({ fullName, email, avatarUrl }: DashboardNavProps) {
  return <UserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />;
}
