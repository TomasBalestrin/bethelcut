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
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="relative">
        <div
          className={cn(
            'font-bold tracking-tight text-text-primary',
            sizeClasses[size]
          )}
        >
          BETHEL
        </div>
        <span
          className={cn(
            'font-light text-text-muted tracking-widest uppercase',
            size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-[10px]' : 'text-xs'
          )}
        >
          studio
        </span>
      </div>
    </div>
  );
}
