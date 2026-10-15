import { LogoMark } from "@/components/brand/logo-mark";

export default function AuthenticationLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 pt-safe">
      <div className="flex items-center gap-2.5 pt-14 pb-10">
        <LogoMark className="size-9" />
        <span className="font-heading text-xl font-semibold tracking-tight">Bilancia</span>
      </div>
      {children}
    </main>
  );
}
