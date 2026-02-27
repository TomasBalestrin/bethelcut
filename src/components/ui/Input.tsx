'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-medium text-text-muted"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-md border bg-bg-primary/50 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 transition-colors',
            'focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20',
            error ? 'border-accent-danger/40' : 'border-border-default/60',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-accent-danger">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
