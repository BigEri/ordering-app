"use client";

import * as React from "react";

import { KioskAnchor } from "./kiosk/KioskAnchor";
import { KioskStaffBackButton } from "./kiosk/KioskStaffBackButton";
import { isKioskWebView } from "../lib/kiosk/isKioskWebView";
import { buildKioskMenuUrl, kioskNavigate } from "../lib/kiosk/nav";
import type { WelcomeLayoutPreset } from "../lib/menu/welcomeLayoutPreset";
import {
  assignWelcomeShowcaseSlots,
  welcomeLayoutInsufficientMessage,
} from "../lib/menu/welcomeShowcaseSlots";
import { usePosTableFields } from "./DeviceTableProvider";
import { LocaleFlag, type FlagCode } from "./LocaleFlag";
import { useLanguage } from "./LanguageProvider";

const SHOWCASE_IMAGE_MS = 15_000;

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} preserveAspectRatio="xMidYMid meet">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm7.94 9h-3.14a16.7 16.7 0 0 0-1.44-6.02A8.03 8.03 0 0 1 19.94 11ZM12 4c.9 0 2.35 2.18 3.08 7H8.92C9.65 6.18 11.1 4 12 4Zm-3.36.98A16.7 16.7 0 0 0 7.2 11H4.06a8.03 8.03 0 0 1 4.58-6.02ZM4.06 13H7.2c.3 2.11.85 4.2 1.44 6.02A8.03 8.03 0 0 1 4.06 13ZM12 20c-.9 0-2.35-2.18-3.08-7h6.16c-.73 4.82-2.18 7-3.08 7Zm3.36-.98c.59-1.82 1.14-3.91 1.44-6.02h3.14a8.03 8.03 0 0 1-4.58 6.02Z"
      />
    </svg>
  );
}

function flagForLocale(code: string): FlagCode | null {
  const lc = code.trim().toLowerCase();
  if (lc === "cs") return "cz";
  if (lc === "en") return "gb";
  if (lc === "ko") return "kr";
  return null;
}

function shuffleUrls(urls: readonly string[]): string[] {
  const a = [...urls];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function baseGalleryFromProps(showcaseImageUrls: readonly string[]): string[] {
  const u = showcaseImageUrls.filter(Boolean);
  if (u.length > 0) return [...u];
  return [];
}

/** Lokální i externí fotky přes `<img>` — ve WebView kiosku spolehlivější než next/image. */
function ShowcaseFillImage({
  src,
  className,
  reduceMotion,
  animKey,
  onError,
}: {
  src: string;
  className: string;
  priority?: boolean;
  sizes: string;
  reduceMotion: boolean;
  animKey: string;
  onError?: (src: string) => void;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={reduceMotion ? src : animKey}
      src={src}
      alt=""
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      onError={() => onError?.(src)}
    />
  );
}

/**
 * Texty úvodní stránky jsou záměrně česky; výběr jazyka ukládá preferenci pro veřejné menu (`/menu`).
 */
const WelcomeShowcaseInner = React.memo(function WelcomeShowcaseInner({
  onSelectLanguage,
  navigatingLang,
  brandName,
  t,
  availableLocales,
  actions,
  showcaseImageUrls,
  layoutPreset,
}: {
  onSelectLanguage: (code: string) => void;
  navigatingLang: string | null;
  brandName: string;
  t: (key: string) => string;
  availableLocales: Array<{ code: string; label: string }>;
  actions?: React.ReactNode;
  showcaseImageUrls: readonly string[];
  layoutPreset: WelcomeLayoutPreset;
}) {
  const langCount = availableLocales.length;
  const langCols = Math.max(1, Math.min(3, langCount));
  const langMaxRem = langCols === 1 ? 20 : langCols === 2 ? 32 : 44;

  const gallerySeed = showcaseImageUrls.join("|");
  // DŮLEŽITÉ: tento Client Component se SSR renderuje.
  // Random shuffle v initial state by způsobil hydration mismatch (server a klient vygenerují jiné pořadí).
  // Proto je initial pořadí deterministické a shuffle děláme až po mountu v effectu.
  const [galleryUrls, setGalleryUrls] = React.useState<string[]>(() => baseGalleryFromProps(showcaseImageUrls));
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(() => new Set());
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [imageIdx, setImageIdx] = React.useState(0);
  const [kioskUa, setKioskUa] = React.useState(false);

  React.useEffect(() => {
    setKioskUa(isKioskWebView());
  }, []);

  React.useEffect(() => {
    setGalleryUrls(shuffleUrls(baseGalleryFromProps(showcaseImageUrls)));
    setFailedUrls(new Set());
    setImageIdx(0);
  }, [gallerySeed, layoutPreset, showcaseImageUrls]);

  const onImageError = React.useCallback((src: string) => {
    if (!src) return;
    setFailedUrls((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  const effectiveGalleryUrls = React.useMemo(() => {
    const filtered = galleryUrls.filter((u) => !failedUrls.has(u));
    if (filtered.length > 0) return filtered;
    return baseGalleryFromProps(showcaseImageUrls).filter((u) => !failedUrls.has(u));
  }, [failedUrls, galleryUrls, showcaseImageUrls]);

  // Na tabletu (kiosk APK) vždy celá plocha — mozaika tam nechává černé díry.
  const presetForRender: WelcomeLayoutPreset = kioskUa ? "fade" : layoutPreset;

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  React.useEffect(() => {
    const nImg = effectiveGalleryUrls.length;
    const imgId =
      nImg <= 1
        ? null
        : window.setInterval(() => {
            setImageIdx((j) => (j + 1) % nImg);
          }, SHOWCASE_IMAGE_MS);

    return () => {
      if (imgId !== null) window.clearInterval(imgId);
    };
  }, [effectiveGalleryUrls.length]);

  const slotAssignment = assignWelcomeShowcaseSlots(effectiveGalleryUrls, presetForRender, imageIdx);
  const { slots, sufficient, uniqueCount, layoutPreset: renderPreset } = slotAssignment;
  const insufficientMsg =
    !kioskUa && !sufficient ? welcomeLayoutInsufficientMessage(layoutPreset, uniqueCount) : null;
  const src0 = slots[0] ?? "";
  const src1 = slots[1] ?? "";
  const src2 = slots[2] ?? "";
  const src3 = slots[3] ?? "";
  const galleryLabel = t("welcome.slideshow.alt");

  const renderCell = (
    src: string,
    opts: {
      sizes: string;
      priority?: boolean;
      animKey: string;
      className?: string;
      vignette?: "main" | false;
    },
  ) => {
    const cellClass = ["welcomePhotoCell", opts.className].filter(Boolean).join(" ");
    if (!src.trim()) {
      return (
        <div className={`${cellClass} welcomePhotoCell--empty`} aria-hidden="true">
          <div className="welcomePhotoEmptyFill" />
        </div>
      );
    }
    return (
      <div className={cellClass}>
        <ShowcaseFillImage
          src={src}
          sizes={opts.sizes}
          priority={opts.priority}
          reduceMotion={reduceMotion}
          animKey={opts.animKey}
          className={`welcomePhotoImg${anim}`}
          onError={onImageError}
        />
        {opts.vignette === "main" ? <div className="welcomePhotoVignette welcomePhotoVignette--main" aria-hidden="true" /> : null}
        <div className="welcomePhotoFrameLine" aria-hidden="true" />
      </div>
    );
  };
  const anim = reduceMotion ? "" : " welcomePhotoImg--enter";
  const motionStatic = reduceMotion ? " welcomePhotoMosaic--static" : "";

  let media: React.ReactNode;
  if (renderPreset === "fade") {
    media = (
      <div className={`welcomePhotoFade${motionStatic}`} role="presentation">
        <div className="welcomePhotoFadeCell">{renderCell(src0, { sizes: "100vw", priority: imageIdx === 0, animKey: `${src0}-${imageIdx}-fade`, vignette: "main" })}</div>
      </div>
    );
  } else if (renderPreset === "split_half") {
    media = (
      <div className={`welcomePhotoSplit${motionStatic}`} role="presentation">
        {renderCell(src0, { sizes: "50vw", priority: imageIdx === 0, animKey: `${src0}-${imageIdx}-sh0` })}
        {renderCell(src1, { sizes: "50vw", animKey: `${src1}-${imageIdx}-sh1` })}
      </div>
    );
  } else if (renderPreset === "grid_four") {
    media = (
      <div className={`welcomePhotoGridFour${motionStatic}`} role="presentation">
        {renderCell(src0, { sizes: "50vw", priority: imageIdx === 0, animKey: `${src0}-${imageIdx}-g0` })}
        {renderCell(src1, { sizes: "50vw", animKey: `${src1}-${imageIdx}-g1` })}
        {renderCell(src2, { sizes: "50vw", animKey: `${src2}-${imageIdx}-g2` })}
        {renderCell(src3, { sizes: "50vw", animKey: `${src3}-${imageIdx}-g3` })}
      </div>
    );
  } else {
    media = (
      <div className={`welcomePhotoMosaic${motionStatic}`} role="presentation">
        {renderCell(src0, {
          sizes: "100vw",
          priority: imageIdx === 0,
          animKey: `${src0}-${imageIdx}-0`,
          className: "welcomePhotoCell--main",
          vignette: "main",
        })}
        {renderCell(src1, {
          sizes: "50vw",
          animKey: `${src1}-${imageIdx}-1`,
          className: "welcomePhotoCell--side welcomePhotoCell--a",
        })}
        {renderCell(src2, {
          sizes: "50vw",
          animKey: `${src2}-${imageIdx}-2`,
          className: "welcomePhotoCell--side welcomePhotoCell--b",
        })}
      </div>
    );
  }

  return (
    <main className="welcomePage">
      <div className={`welcomeFullscreenMedia${effectiveGalleryUrls.length === 0 ? " welcomeFullscreenMedia--fallback" : ""}`} aria-hidden="true">
        {media}
        <div className="welcomeMediaScrim" aria-hidden="true" />
      </div>

      <div className="welcomeOverlayStack">
        <KioskStaffBackButton />
        {insufficientMsg ? (
          <p className="welcomeLayoutWarn" role="alert">
            {insufficientMsg}
          </p>
        ) : null}
        <div className="welcomeCopyCard">
          <div className="welcomeRotatingCopy" role="group" aria-label={galleryLabel} aria-live="polite" aria-atomic="true">
            <p className="welcomeBrand">{brandName}</p>
            <p className="welcomeKicker">{t("welcome.kicker")}</p>
            <h1 className="welcomeTitle">{t("welcome.title")}</h1>
            <p className="welcomeSubtitle">{t("welcome.subtitle")}</p>
          </div>
        </div>

        {actions ?? null}

        <div
          className="welcomeLangDock"
          role="group"
          aria-label={t("welcome.langHint")}
          style={
            {
              // 2 jazyky => 2 sloupce, 3+ => 3 sloupce; panel se zvětší podle sloupců.
              // 5 jazyků => 3 + 2 (bez scrollu), 6 => 3 + 3.
              "--welcome-lang-cols": langCols,
              "--welcome-lang-max": `${langMaxRem}rem`,
            } as React.CSSProperties
          }
        >
          <div className="welcomeLangPanel">
            <span className="welcomeLangHint">{t("welcome.langHint")}</span>
            <div className="welcomeLangGrid">
              {availableLocales.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className="welcomeLangBtn"
                  disabled={navigatingLang !== null}
                  onClick={() => onSelectLanguage(item.code)}
                  style={{ cursor: navigatingLang !== null ? "wait" : "pointer" }}
                >
                  <span className="welcomeLangBtnInner">
                    {navigatingLang === item.code ? (
                      <span className="welcomeLangLabel">…</span>
                    ) : (
                      <>
                        {(() => {
                          const f = flagForLocale(item.code);
                          return f ? (
                            <LocaleFlag code={f} className={`welcomeLangFlag welcomeLangFlag--${f}`} />
                          ) : (
                            <GlobeIcon className="welcomeLangFlag" />
                          );
                        })()}
                        <span className="welcomeLangLabel">{item.label}</span>
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
});

export function WelcomePage({
  brandName,
  showcaseImageUrls = [],
  layoutPreset = "mosaic",
}: {
  brandName: string;
  /** SSR: URL fotek pro aktivní / výchozí provozovnu. */
  showcaseImageUrls?: readonly string[];
  layoutPreset?: WelcomeLayoutPreset;
}) {
  const { setLocale, t, availableLocales } = useLanguage();
  const { ready, needsPairing, pairingCode, pairingExpiresAtIso } = usePosTableFields();
  const [navigatingLang, setNavigatingLang] = React.useState<string | null>(null);

  const onSelectLanguage = React.useCallback(
    (code: string) => {
      setLocale(code);
      if (!ready || needsPairing) return;
      setNavigatingLang(code);
      kioskNavigate(buildKioskMenuUrl());
    },
    [needsPairing, ready, setLocale],
  );

  // Important: `ready` starts false and flips after client-side init.
  // If we render the staff/login block before `ready`, it will "flash" briefly on already-paired tablets.
  const actions =
    !ready || !needsPairing ? null : (
      <div className="welcomeKioskPairingDock" role="region" aria-label="Akce">
        <div className="welcomeKioskPairingCard">
          <p className="welcomeKioskPairingTitle">Personál</p>
          <p className="welcomeKioskPairingText">
            Přihlaste se do administrace (vedoucí / správce) pro nastavení zařízení a propojení s Dotykačkou.
          </p>
          <KioskAnchor href="/admin/login" className="chip" style={{ display: "inline-block", textDecoration: "none" }}>
            Přihlásit se →
          </KioskAnchor>
        </div>

        <div className="welcomeKioskPairingCard" style={{ marginTop: 12 }}>
          <p className="welcomeKioskPairingTitle">Tablet u stolu</p>
          <>
            <p className="welcomeKioskPairingText">
              V administraci otevřete <strong>Zařízení → Párování u stolů</strong> a zadejte tento kód.
            </p>
            <p style={{ margin: "10px 0 6px" }}>
              <code
                style={{
                  display: "inline-block",
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.35)",
                }}
              >
                {pairingCode ?? "—"}
              </code>
            </p>
            {pairingExpiresAtIso ? (
              <p className="welcomeKioskPairingMuted" style={{ marginTop: 6 }}>
                Platnost do {new Date(pairingExpiresAtIso).toLocaleString("cs-CZ")}
              </p>
            ) : null}
            <p className="welcomeKioskPairingMuted" style={{ marginTop: 10 }}>
              Až bude zařízení spárováno, menu se automaticky zpřístupní.
            </p>
          </>
        </div>
      </div>
    );

  const innerKey = `${layoutPreset}::${showcaseImageUrls.join("::")}`;

  return (
    <WelcomeShowcaseInner
      key={innerKey}
      onSelectLanguage={onSelectLanguage}
      navigatingLang={navigatingLang}
      brandName={brandName}
      t={t}
      availableLocales={availableLocales}
      actions={actions}
      showcaseImageUrls={showcaseImageUrls}
      layoutPreset={layoutPreset}
    />
  );
}
