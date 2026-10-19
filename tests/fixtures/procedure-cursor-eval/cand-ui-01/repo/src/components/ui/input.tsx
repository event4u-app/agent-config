import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-md border bg-background p-4", className)} {...props} />
  )
);
Input.displayName = "Input";

export { Input };
