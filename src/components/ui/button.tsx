import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'default';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", ...props }, ref) => (
    <button
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        variant === "ghost" ? "hover:bg-accent hover:text-accent-foreground" :
        variant === "outline" ? "border border-input hover:bg-accent hover:text-accent-foreground" :
        "bg-primary text-primary-foreground hover:bg-primary/90"
      } ${size === "sm" ? "h-9 px-3" : "h-10 px-4 py-2"} ${className}`}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button }
