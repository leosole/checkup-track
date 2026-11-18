import Svg, { Path, Rect } from "react-native-svg";

/**
 * The web app's logo (frontend/public/logo.svg): a rounded brand square with
 * a white pulse line. Kept in sync with that asset.
 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Rect width={36} height={36} rx={12} fill="#7c3aed" />
      <Path
        d="M3 12h4l2-6 4 12 2-6h6"
        transform="translate(8 8) scale(.833333)"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
