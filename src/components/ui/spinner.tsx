import * as React from "react";
import { SpinnerIcon as PhosphorSpinner } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<SVGSVGElement> {
  size?: number;
}

function Spinner({ className, size = 16, ...props }: SpinnerProps) {
  return (
    <PhosphorSpinner
      size={size}
      className={cn("animate-spin text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Spinner };
