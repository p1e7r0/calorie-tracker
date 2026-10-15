export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" fill="#15201b" />
      <path
        d="M14 41a18 18 0 0 1 36 0"
        fill="none"
        stroke="#a9d95b"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M32 41 41 28" stroke="#f5f7f3" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="41" r="4.5" fill="#f5f7f3" />
    </svg>
  );
}
