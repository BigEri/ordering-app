"use client";

import * as React from "react";

type Props = {
  labelEnter: string;
  labelExit: string;
};

function getFullscreenElement(): Element | null {
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return (
    document.fullscreenElement ??
    d.webkitFullscreenElement ??
    d.mozFullScreenElement ??
    d.msFullscreenElement ??
    null
  );
}

/** Rohové tlačítko pro vyzkoušení kiosk režimu na celé obrazovce (tablet / Chrome). */
export function MenuFullscreenButton({ labelEnter, labelExit }: Props) {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const onChange = () => {
      setActive(!!getFullscreenElement());
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as EventListener);
    };
  }, []);

  const toggle = React.useCallback(() => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    if (getFullscreenElement()) {
      const d = document as Document & {
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };
      void (
        document.exitFullscreen?.() ??
        d.webkitExitFullscreen?.() ??
        d.mozCancelFullScreen?.() ??
        d.msExitFullscreen?.()
      );
      return;
    }
    void (
      el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.() ?? el.msRequestFullscreen?.()
    );
  }, []);

  return (
    <button
      type="button"
      className="menuFullscreenBtn"
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? labelExit : labelEnter}
      title={active ? labelExit : labelEnter}
    >
      {active ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 9V4h5M15 4h5v5M4 15v5h5M20 15h-5v5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
