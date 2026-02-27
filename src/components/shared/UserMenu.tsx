'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UserMenuProps {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
}

export function UserMenu({ fullName, email, avatarUrl }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : email[0].toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-hover transition-colors"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName || email}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-sm font-medium text-white">
            {initials}
          </div>
        )}
        <span className="text-sm text-text-secondary hidden sm:block">
          {fullName || email}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border-default bg-bg-secondary shadow-xl z-50">
            <div className="p-3 border-b border-border-default">
              <p className="text-sm font-medium text-text-primary">
                {fullName || 'Usuário'}
              </p>
              <p className="text-xs text-text-muted">{email}</p>
            </div>
            <div className="p-1">
              <button className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                <User size={16} />
                Perfil
              </button>
              <button className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                <Settings size={16} />
                Configurações
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-accent-danger hover:bg-bg-hover transition-colors"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
