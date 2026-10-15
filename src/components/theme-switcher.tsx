"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const options = [
  { value: "light", label: "Chiaro", icon: SunIcon },
  { value: "dark", label: "Scuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const;

function subscribe() {
  return () => {};
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const selectedTheme = mounted ? (theme ?? "system") : "system";

  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      value={[selectedTheme]}
      onValueChange={(values) => {
        const [nextTheme] = values;
        if (nextTheme) setTheme(nextTheme);
      }}
      aria-label="Tema"
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
          <option.icon />
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
