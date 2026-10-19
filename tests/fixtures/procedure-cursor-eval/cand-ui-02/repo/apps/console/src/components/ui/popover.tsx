import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const Popover = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>
>(({ className, ...props }, ref) => (
  <PopoverPrimitive.Root ref={ref} className={cn("popover", className)} {...props} />
));
Popover.displayName = PopoverPrimitive.Root.displayName;

export { Popover };
