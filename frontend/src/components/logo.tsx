import type { LogoProps } from "./types";

export function Logo({ className }: LogoProps) {
  return <img src="/logo.svg" alt="" aria-hidden="true" className={className} />;
}