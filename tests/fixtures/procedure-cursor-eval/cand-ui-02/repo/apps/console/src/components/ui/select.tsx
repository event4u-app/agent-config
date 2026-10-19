import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Root ref={ref} className={cn("select", className)} {...props} />
));
Select.displayName = SelectPrimitive.Root.displayName;

export { Select };
