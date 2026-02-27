'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NewProjectPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/projects');
  }, [router]);

  return null;
}
