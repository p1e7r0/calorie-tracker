export default function FocusLayout({ children }: LayoutProps<"/">) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-safe">{children}</main>;
}
