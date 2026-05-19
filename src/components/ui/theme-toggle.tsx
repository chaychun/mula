"use client";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { SunIcon, MoonIcon, MonitorIcon } from "@phosphor-icons/react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative">
            <SunIcon
              className={cn(
                "size-4 transition-all",
                resolvedTheme === "dark" ? "scale-0 rotate-90" : "scale-100 rotate-0"
              )}
            />
            <MoonIcon
              className={cn(
                "absolute size-4 transition-all",
                resolvedTheme === "dark" ? "scale-100 rotate-0" : "scale-0 -rotate-90"
              )}
            />
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner className="isolate z-50 outline-none" sideOffset={4}>
          <MenuPrimitive.Popup className="data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 bg-popover text-popover-foreground min-w-28 rounded-none shadow-md ring-1 duration-100 z-50 overflow-hidden outline-none">
            <MenuPrimitive.Item
              className={cn(
                "focus:bg-accent focus:text-accent-foreground gap-2 rounded-none px-2 py-2 text-xs flex cursor-default items-center outline-hidden select-none",
                theme === "light" && "bg-accent/50"
              )}
              onClick={() => setTheme("light")}
            >
              <SunIcon className="size-4" />
              Light
            </MenuPrimitive.Item>
            <MenuPrimitive.Item
              className={cn(
                "focus:bg-accent focus:text-accent-foreground gap-2 rounded-none px-2 py-2 text-xs flex cursor-default items-center outline-hidden select-none",
                theme === "dark" && "bg-accent/50"
              )}
              onClick={() => setTheme("dark")}
            >
              <MoonIcon className="size-4" />
              Dark
            </MenuPrimitive.Item>
            <MenuPrimitive.Item
              className={cn(
                "focus:bg-accent focus:text-accent-foreground gap-2 rounded-none px-2 py-2 text-xs flex cursor-default items-center outline-hidden select-none",
                theme === "system" && "bg-accent/50"
              )}
              onClick={() => setTheme("system")}
            >
              <MonitorIcon className="size-4" />
              System
            </MenuPrimitive.Item>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
