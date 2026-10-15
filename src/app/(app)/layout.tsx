import { BottomNavigation } from "@/components/app-shell/bottom-navigation";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-safe pb-24">{children}</main>
      <BottomNavigation />
    </>
  );
}
