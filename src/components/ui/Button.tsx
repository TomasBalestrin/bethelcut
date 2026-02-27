'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const variantClasses = {
      primary:
        'bg-accent-primary hover:bg-accent-secondary text-white',
      secondary:
        'bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border-default/60',
      ghost:
        'hover:bg-bg-hover text-text-secondary hover:text-text-primary',
      danger:
        'bg-accent-danger/10 hover:bg-accent-danger/15 text-accent-danger border border-accent-danger/20',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-2.5 text-sm',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:ring-1 focus-visible:ring-accent-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary disabled:opacity-40 disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <LoadingSpinner size="sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
