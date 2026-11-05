#!/bin/bash
mkdir -p components/ui styles
cat > components/ui/button.tsx <<'TSX'
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("inline-flex items-center justify-center rounded-md text-sm font-medium", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border border-input bg-background hover:bg-accent",
      ghost: "hover:bg-accent hover:text-accent-foreground",
    },
    size: { default: "h-10 px-4 py-2", sm: "h-9 px-3", lg: "h-11 px-8" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
))
Button.displayName = "Button"
TSX
cat > styles/tokens.css <<'CSS'
:root { --brand-500: #2f6fed; --brand-600: #2259c7; --neutral-100: #f3f4f6; --neutral-900: #111827; --radius-md: 6px; }
CSS
