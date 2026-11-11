import Image from "next/image";

export function ClubLogo({
  className = "",
  sizes = "64px",
  decorative = false,
  preload = false,
}: {
  className?: string;
  sizes?: string;
  decorative?: boolean;
  preload?: boolean;
}) {
  return (
    <Image
      src="/brand/ngc-science-club.png"
      alt={decorative ? "" : "NGC Science Club"}
      width={2502}
      height={2502}
      sizes={sizes}
      preload={preload}
      className={`brand-logo-image h-auto object-contain ${className}`}
    />
  );
}
