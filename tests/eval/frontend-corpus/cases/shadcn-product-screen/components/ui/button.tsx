import { cn } from "@/lib/utils";
export function Button({ className, variant = "default", ...props }) {
  return <button className={cn("inline-flex h-9 items-center rounded-md px-4 text-sm font-medium", variant === "default" && "bg-primary text-primary-foreground", className)} {...props} />;
}
