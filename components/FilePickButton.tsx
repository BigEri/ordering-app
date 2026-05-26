"use client";

import * as React from "react";

type FilePickButtonProps = {
  accept?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onFile: (file: File) => void;
};

/**
 * Výběr souboru — tlačítko spouští skrytý input (spolehlivé na PC i tabletu).
 * stopPropagation brání zavření modalu při klepnutí.
 */
export function FilePickButton({ accept, disabled, className, style, children, onFile }: FilePickButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) onFile(f);
    },
    [onFile],
  );

  const openPicker = React.useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      const el = inputRef.current;
      if (!el) return;
      try {
        if (typeof el.showPicker === "function") {
          el.showPicker();
          return;
        }
      } catch {
        /* fallback */
      }
      el.click();
    },
    [disabled],
  );

  const acceptAttr = accept?.includes("image/") ? accept : accept ? `${accept},image/*` : "image/*";

  return (
    <span
      className="filePickBtnWrap"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" className={className ?? "chip"} disabled={disabled} onClick={openPicker}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        disabled={disabled}
        className="filePickHiddenInput"
        tabIndex={-1}
        aria-hidden
        onChange={onInputChange}
      />
    </span>
  );
}
