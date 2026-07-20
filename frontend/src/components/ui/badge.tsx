import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Memory layer badges
        working: "border-memory-working bg-memory-working/10 text-memory-working",
        episodic: "border-memory-episodic bg-memory-episodic/10 text-memory-episodic",
        semantic: "border-memory-semantic bg-memory-semantic/10 text-memory-semantic",
        procedural: "border-memory-procedural bg-memory-procedural/10 text-memory-procedural",
        // Mood badges
        happy: "border-amber-500 bg-amber-50 text-amber-700",
        sad: "border-blue-500 bg-blue-50 text-blue-700",
        nostalgic: "border-purple-500 bg-purple-50 text-purple-700",
        funny: "border-green-500 bg-green-50 text-green-700",
        serious: "border-slate-500 bg-slate-50 text-slate-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
