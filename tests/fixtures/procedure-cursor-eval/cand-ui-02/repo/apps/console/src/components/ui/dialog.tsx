import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Dialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Root ref={ref} className={cn("dialog", className)} {...props} />
));
Dialog.displayName = DialogPrimitive.Root.displayName;

export { Dialog };
