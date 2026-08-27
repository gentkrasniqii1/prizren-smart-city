import Image from 'next/image';

export function UserAvatar({
  name,
  avatarUrl,
  size = 32,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  if (avatarUrl) {
    return (
      <span
        className="relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Image src={avatarUrl} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
