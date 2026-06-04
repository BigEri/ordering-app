"use client";

import * as React from "react";

import { MENU_ITEM_IMAGE_FRAMED, menuItemMediaFallbackGradient } from "../lib/menu/menuItemImageFit";

type MenuItemPhotoProps = {
  imageUrl?: string;
  /** Pro barevný placeholder když chybí fotka nebo se načítá. */
  seedId: string;
  /** Lazy: obrázek se stáhne až když je karta blízko viewportu. */
  visible: boolean;
  className?: string;
  priority?: boolean;
};

export function MenuItemPhoto({ imageUrl, seedId, visible, className, priority }: MenuItemPhotoProps) {
  const containerStyle = React.useMemo<React.CSSProperties>(
    () => ({ backgroundImage: menuItemMediaFallbackGradient(seedId) }),
    [seedId],
  );

  const imgStyle = React.useMemo<React.CSSProperties>(
    () => ({
      objectFit: MENU_ITEM_IMAGE_FRAMED.objectFit,
      objectPosition: MENU_ITEM_IMAGE_FRAMED.objectPosition,
    }),
    [],
  );

  const mediaClass = [className ?? "menuItemMedia", "menuItemMedia--framed"].filter(Boolean).join(" ");

  return (
    <div className={mediaClass} style={containerStyle} aria-hidden="true">
      {visible && imageUrl ? (
        <>
          {MENU_ITEM_IMAGE_FRAMED.useBlurBackdrop ? (
            <div className="menuItemMediaBackdrop" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" />
          ) : null}
          <img
            src={imageUrl}
            alt=""
            className="menuItemMediaImg"
            style={imgStyle}
            decoding="async"
            loading={priority ? "eager" : "lazy"}
          />
        </>
      ) : null}
      {priority && imageUrl ? <link rel="preload" as="image" href={imageUrl} /> : null}
    </div>
  );
}
