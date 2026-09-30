type Props = { className?: string; size?: number; iconOnly?: boolean };

function Mark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="hsl(var(--copper))" />
      <path
        d="M9 23 L16 9 L23 23"
        stroke="hsl(var(--ink))"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 18.4 H19.8"
        stroke="hsl(var(--ink))"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AicfoLogo({
  className = "",
  size = 28,
  iconOnly = false,
}: Props) {
  if (iconOnly) {
    return (
      <span className={`inline-flex ${className}`}>
        <Mark size={size} />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      role="img"
      aria-label="Aicfo"
    >
      <Mark size={size} />
      <span className="text-[17px] font-semibold tracking-tight">Aicfo</span>
    </span>
  );
}
