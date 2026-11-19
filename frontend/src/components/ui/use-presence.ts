import { useEffect, useRef, useState } from "react";

/**
 * Keeps a dropdown mounted for `exitMs` after `open` turns false so its exit
 * animation can play. `show` is true while it should render at all and
 * `leaving` is true only for the closing pass.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [mounted, set_mounted] = useState(open);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (open) {
      set_mounted(true);
      return;
    }
    if (!mounted) return;
    timer.current = window.setTimeout(() => {
      set_mounted(false);
      timer.current = null;
    }, exitMs);
  }, [open, exitMs, mounted]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { show: open || mounted, leaving: !open };
}