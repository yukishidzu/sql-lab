import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'default', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45',
        variant === 'default' && 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/88',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        variant === 'ghost' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
        variant === 'outline' && 'border border-border bg-background hover:bg-accent',
        variant === 'destructive' && 'bg-destructive text-white hover:bg-destructive/85',
        size === 'sm' && 'h-8 px-3 text-xs max-md:h-9',
        size === 'md' && 'h-9 px-4 max-md:h-10',
        size === 'icon' && 'size-9 p-0 max-md:size-10',
        className,
      )}
      {...props}
    />
  )
})
