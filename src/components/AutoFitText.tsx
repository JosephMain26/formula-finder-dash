import { useEffect, useRef, useState } from "react";

interface AutoFitTextProps {
  text: string;
  /** Maximum font size in px */
  max?: number;
  /** Minimum font size in px */
  min?: number;
  /** Tailwind / CSS classes (font-weight, color, etc.) */
  className?: string;
  /** If true, allow wrapping onto multiple lines (still scales to fit). Default false. */
  multiline?: boolean;
  title?: string;
}

/**
 * Scales font-size down so the text fits its parent box on both axes.
 * Uses ResizeObserver to react to container size changes (drag-resize friendly).
 */
export function AutoFitText({ text, max = 28, min = 9, className = "", multiline = false, title }: AutoFitTextProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState(max);

  useEffect(() => {
    const wrap = wrapRef.current;
    const span = spanRef.current;
    if (!wrap || !span) return;

    let raf = 0;
    const fit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let lo = min;
        let hi = max;
        // Binary search the largest size that fits
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          span.style.fontSize = `${mid}px`;
          const fits = span.scrollWidth <= wrap.clientWidth && span.scrollHeight <= wrap.clientHeight;
          if (fits) lo = mid; else hi = mid;
        }
        span.style.fontSize = `${lo}px`;
        setSize(lo);
      });
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [text, max, min, multiline]);

  return (
    <div ref={wrapRef} className="w-full h-full overflow-hidden flex items-center" title={title ?? text}>
      <span
        ref={spanRef}
        className={className}
        style={{
          fontSize: `${size}px`,
          lineHeight: 1.1,
          whiteSpace: multiline ? "normal" : "nowrap",
          display: "inline-block",
          maxWidth: "100%",
        }}
      >
        {text}
      </span>
    </div>
  );
}
