export default function FocusLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app-viewport">
      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4 pt-safe">{children}</main>
    </div>
  );
}
