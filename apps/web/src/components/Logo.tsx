export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M22 14a18 18 0 1 0 0 36a18 18 0 1 0 0-36Z M42 14a18 18 0 1 0 0 36a18 18 0 1 0 0-36Z"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]">
      <Mark size={22} />
      otto
    </span>
  );
}
