/* eslint-disable @next/next/no-img-element */
export default function TokenAvatar({ src, alt, size = 48, className = "" }: { src: string; alt: string; size?: number; className?: string }) {
  const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='28' fill='#1E45D6'/><text x='60' y='76' font-size='48' text-anchor='middle' font-family='serif' fill='white'>${(alt || "?").slice(0, 1).toUpperCase()}</text></svg>`
  )}`;
  return (
    <img
      src={src || fallback}
      alt={alt}
      width={size}
      height={size}
      onError={(e) => ((e.currentTarget as HTMLImageElement).src = fallback)}
      className={`shrink-0 rounded-xl object-cover ring-1 ring-royal-100 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
