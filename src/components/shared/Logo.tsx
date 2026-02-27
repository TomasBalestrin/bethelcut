import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ size = 'md', className }: LogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div
          className={cn(
            'font-black tracking-tight bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent',
            sizeClasses[size]
          )}
        >
          BETHEL
        </div>
        <span
          className={cn(
            'font-light text-text-secondary',
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
          )}
        >
          studio
        </span>
      </div>
    </div>
  );
}
