"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Open/close state for a search panel: closing with Close or Escape returns
// focus to the control that opened it; on desktop a click outside closes it.
export function useSearchDisclosure<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const opener = useRef<T>(null);
  const area = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

  const close = useCallback((returnFocus = true) => {
    restoreFocus.current = returnFocus;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    opener.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      if (area.current && !area.current.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  return { open, setOpen, close, opener, area };
}
