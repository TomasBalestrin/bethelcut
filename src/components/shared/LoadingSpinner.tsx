import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-[1.5px] border-border-default border-t-accent-primary',
        sizeClasses[size],
        className
      )}
    />
  );
}
