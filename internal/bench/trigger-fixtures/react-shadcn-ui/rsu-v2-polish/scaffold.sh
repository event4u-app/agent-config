#!/bin/bash
set -euo pipefail
mkdir -p src/components/ui src/lib src/pages/admin
cat > package.json <<'J'
{
  "name": "atlas-console",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "tsc -b && vite build" },
  "dependencies": {
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.3",
    "vite": "^6.0.5"
  }
}
J
cat > components.json <<'J'
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/index.css", "baseColor": "zinc", "cssVariables": true, "prefix": "" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
J
cat > src/index.css <<'CSS'
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.5rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.21 0.01 265);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.21 0.01 265);
  --primary: oklch(0.55 0.19 258);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(0.96 0.01 265);
  --secondary-foreground: oklch(0.21 0.01 265);
  --muted: oklch(0.96 0.01 265);
  --muted-foreground: oklch(0.55 0.02 265);
  --accent: oklch(0.96 0.01 265);
  --accent-foreground: oklch(0.21 0.01 265);
  --destructive: oklch(0.58 0.22 27);
  --border: oklch(0.92 0.01 265);
  --input: oklch(0.92 0.01 265);
  --ring: oklch(0.55 0.19 258);
}

.dark {
  --background: oklch(0.17 0.01 265);
  --foreground: oklch(0.97 0 0);
  --card: oklch(0.21 0.01 265);
  --card-foreground: oklch(0.97 0 0);
  --primary: oklch(0.68 0.16 258);
  --primary-foreground: oklch(0.17 0.01 265);
  --secondary: oklch(0.27 0.01 265);
  --secondary-foreground: oklch(0.97 0 0);
  --muted: oklch(0.27 0.01 265);
  --muted-foreground: oklch(0.71 0.02 265);
  --accent: oklch(0.27 0.01 265);
  --accent-foreground: oklch(0.97 0 0);
  --destructive: oklch(0.65 0.2 25);
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.68 0.16 258);
}

@theme inline {
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
CSS
cat > src/lib/utils.ts <<'TS'
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
TS
cat > src/lib/api.ts <<'TS'
export type Role = "owner" | "admin" | "member"
export interface Member { id: string; name: string; email: string; role: Role }

export async function getMembers(workspaceId: string): Promise<Member[]> {
  const res = await fetch(`/api/workspaces/${workspaceId}/members`)
  return res.json()
}
export async function setMemberRole(workspaceId: string, memberId: string, role: Role) {
  await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) })
}
export async function removeMember(workspaceId: string, memberId: string) {
  await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, { method: "DELETE" })
}
export async function deleteWorkspace(workspaceId: string) {
  await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" })
}
TS
cat > src/components/ui/button.tsx <<'TSX'
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: { default: "h-9 px-4 py-2", sm: "h-8 rounded-md px-3 text-xs", lg: "h-10 rounded-md px-8", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = "Button"

export { Button, buttonVariants }
TSX
cat > src/components/ui/input.tsx <<'TSX'
import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
))
Input.displayName = "Input"

export { Input }
TSX
cat > src/components/ui/label.tsx <<'TSX'
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
TSX
cat > src/components/ui/card.tsx <<'TSX'
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-xl border bg-card text-card-foreground shadow", className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
TSX
cat > src/pages/settings.tsx <<'TSX'
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteWorkspace } from "@/lib/api"

export function SettingsPage({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [name, setName] = useState(workspaceName)

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic details about this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="ws-name">Workspace name</Label>
          <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
        </CardContent>
        <CardFooter>
          <Button>Save</Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>Delete workspace</CardTitle>
          <CardDescription>Removes the workspace, its projects and all member access. This cannot be undone.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="destructive" onClick={() => deleteWorkspace(workspaceId)}>
            Delete workspace
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
TSX
cat > src/pages/admin/members.tsx <<'TSX'
import { useEffect, useState } from "react"
import { getMembers, type Member } from "@/lib/api"

export function MembersPage({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    getMembers(workspaceId).then(setMembers)
  }, [workspaceId])

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Members</h1>
      <ul>
        {members.map((m) => (
          <li key={m.id}>
            {m.name} — {m.email} ({m.role})
          </li>
        ))}
      </ul>
    </div>
  )
}
TSX
cat > src/components/pricing-cards.tsx <<'TSX'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const plans = [
  { name: "Starter", price: "$0", blurb: "For trying things out.", features: ["1 workspace", "3 members"] },
  { name: "Team", price: "$12", blurb: "For growing teams.", features: ["5 workspaces", "Unlimited members", "Audit log"], popular: true },
  { name: "Enterprise", price: "Custom", blurb: "For large organisations.", features: ["SSO", "Dedicated support"] },
]

export function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan, i) => (
        <Card key={plan.name} className={i === 0 ? "p-4" : i === 1 ? "p-8" : "p-2"}>
          <CardHeader>
            {plan.popular && (
              <span className="mb-2 w-fit rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800">
                Most popular
              </span>
            )}
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.blurb}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-3xl font-bold">{plan.price}</p>
            <ul className="mb-6 space-y-1 text-sm">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground outline-none">
              Choose {plan.name}
            </button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
TSX
git init -q
git add -A
git -c user.email=dev@example.com -c user.name=dev commit -qm "initial import"
