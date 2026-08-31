"use client";

import * as React from "react";

import { MENU_ITEM_IMAGE_FRAMED, menuItemMediaFallbackGradient } from "../lib/menu/menuItemImageFit";

type MenuItemPhotoPresentation = "framed" | "fill";

type MenuItemPhotoProps = {
  imageUrl?: string;
  /** Pro barevný placeholder když chybí fotka nebo se načítá. */
  seedId: string;
  /** Lazy: u karty se obrázek stáhne prohlížečem (`loading=lazy`), tady jen blur pozadí. */
  visible: boolean;
  className?: string;
  priority?: boolean;
  /** Karta menu: celý produkt + blur. Detail v modalu: vyplnit rámeček bez blur na pozadí. */
  presentation?: MenuItemPhotoPresentation;
};

export function MenuItemPhoto({
  imageUrl,
  seedId,
  visible,
  className,
  priority,
  presentation = "framed",
}: MenuItemPhotoProps) {
  const containerStyle = React.useMemo<React.CSSProperties>(
    () => ({ backgroundImage: menuItemMediaFallbackGradient(seedId) }),
    [seedId],
  );

  const framed = presentation === "framed";

  const imgStyle = React.useMemo<React.CSSProperties>(
    () =>
      framed
        ? {
            objectFit: MENU_ITEM_IMAGE_FRAMED.objectFit,
            objectPosition: MENU_ITEM_IMAGE_FRAMED.objectPosition,
          }
        : { objectFit: "cover", objectPosition: "center" },
    [framed],
  );

  const mediaClass = [
    className ?? "menuItemMedia",
    framed ? "menuItemMedia--framed" : "menuItemMedia--fill",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={mediaClass} style={containerStyle} aria-hidden="true">
      {visible && imageUrl ? (
        <>
          {framed && MENU_ITEM_IMAGE_FRAMED.useBlurBackdrop ? (
            <div className="menuItemMediaBackdrop" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" />
          ) : null}
          <img
            src={imageUrl}
            alt=""
            className="menuItemMediaImg"
            style={imgStyle}
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
          />
        </>
      ) : null}
      {priority && imageUrl ? <link rel="preload" as="image" href={imageUrl} /> : null}
    </div>
  );
}
