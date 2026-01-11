import * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- htmlFor is passed via props spread
    <label
      data-slot="label"
      className={cn(
        "text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Label };
