'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Input. Spec: .claude/design/COMPONENT-INVENTORY.md §2
 *
 * 40px standard; 48px (`inputSize="lg"`) for the primary field on focused
 * single-task forms such as login.
 *
 * Error state is a red BORDER plus a message — never a red background fill,
 * which destroys text contrast.
 */
export interface InputProps
  // `prefix` is a real (legacy) HTML attribute typed as string, so it must be
  // omitted before we can use it for a ReactNode adornment.
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  inputSize?: 'md' | 'lg';
  invalid?: boolean;
  /** Rendered inside the field on the left, e.g. ₹ */
  prefix?: React.ReactNode;
  /** Rendered inside the field on the right, e.g. a show/hide toggle */
  suffix?: React.ReactNode;
  /** Mono + tabular + right-aligned. Every money and quantity field. */
  figure?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type = 'text', inputSize = 'md', invalid, prefix, suffix, figure, ...props },
    ref,
  ) => {
    const height = inputSize === 'lg' ? 'h-12' : 'h-10';

    const field = (
      <input
        type={type}
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full rounded-sm border bg-transparent px-3 text-foreground',
          'placeholder:text-muted-foreground/70',
          'transition-colors duration-100',
          'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-muted',
          'read-only:bg-muted read-only:border-transparent read-only:text-muted-foreground',
          height,
          inputSize === 'lg' ? 'text-[15px]' : 'text-sm',
          invalid ? 'border-destructive' : 'border-input hover:border-muted-foreground/50',
          figure && 'figure',
          prefix && 'pl-8',
          suffix && 'pr-11',
          className,
        )}
        {...props}
      />
    );

    if (!prefix && !suffix && !invalid) return field;

    return (
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        {field}
        {suffix ? (
          <span className="absolute right-1 top-1/2 -translate-y-1/2">{suffix}</span>
        ) : (
          invalid && (
            <AlertCircle
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-destructive"
              aria-hidden
            />
          )
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
