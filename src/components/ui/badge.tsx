import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 font-medium",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium",
        destructive:
          "bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/60 font-medium",
        outline: "border-border text-foreground font-medium",
        mono: "border-border bg-secondary/90 text-secondary-foreground font-mono tabular-nums text-[11px] rounded-sm",
        hotkey: "border-border/80 bg-zinc-900/90 text-zinc-200 font-mono tabular-nums text-[11px] rounded-sm px-1.5 py-0.5 shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
