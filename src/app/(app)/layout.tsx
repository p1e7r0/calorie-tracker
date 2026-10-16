import { BottomNavigation } from "@/components/app-shell/bottom-navigation";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app-viewport">
      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4 pt-safe">{children}</main>
      <BottomNavigation />
    </div>
  );
}
