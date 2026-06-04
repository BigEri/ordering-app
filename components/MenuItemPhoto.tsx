"use client";

import * as React from "react";

import { menuItemMediaFallbackGradient, resolveMenuItemImageFit, type MenuItemImageFit } from "../lib/menu/menuItemImageFit";

type MenuItemPhotoProps = {
  imageUrl?: string;
  /** Pro barevný placeholder když chybí fotka nebo se načítá. */
  seedId: string;
  /** Lazy: obrázek se stáhne až když je karta blízko viewportu. */
  visible: boolean;
  className?: string;
  priority?: boolean;
};

const DEFAULT_FIT: MenuItemImageFit = { objectFit: "cover", objectPosition: "center" };

export function MenuItemPhoto({ imageUrl, seedId, visible, className, priority }: MenuItemPhotoProps) {
  const [fit, setFit] = React.useState<MenuItemImageFit>(DEFAULT_FIT);

  React.useEffect(() => {
    setFit(DEFAULT_FIT);
  }, [imageUrl]);

  const containerStyle = React.useMemo<React.CSSProperties>(
    () => ({ backgroundImage: menuItemMediaFallbackGradient(seedId) }),
    [seedId],
  );

  const imgStyle = React.useMemo<React.CSSProperties>(
    () => ({
      objectFit: fit.objectFit,
      objectPosition: fit.objectPosition,
    }),
    [fit],
  );

  return (
    <div className={className ?? "menuItemMedia"} style={containerStyle} aria-hidden="true">
      {visible && imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="menuItemMediaImg"
          style={imgStyle}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          onLoad={(e) => {
            const el = e.currentTarget;
            setFit(resolveMenuItemImageFit(el.naturalWidth, el.naturalHeight));
          }}
        />
      ) : null}
      {priority && imageUrl ? <link rel="preload" as="image" href={imageUrl} /> : null}
    </div>
  );
}
