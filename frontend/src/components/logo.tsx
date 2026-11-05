interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return <img src="/logo.svg" alt="" aria-hidden="true" className={className} />;
}