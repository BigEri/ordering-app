"use client";

import * as React from "react";
import Link from "next/link";

import { parseWelcomeLayoutPreset, type WelcomeLayoutPreset } from "../../../lib/menu/welcomeLayoutPreset";

type MeOk = {
  ok: true;
  session: { userId: string; email: string; globalRole: "SUPER_ADMIN" | "USER" };
  activeRestaurantId: string | null;
  memberships: { restaurantId: string; role: string }[];
};

function defaultAppUrls(): string[] {
  // Už nechceme fallback na "demo" fotky z aplikace.
  return [];
}

export function WelcomeSettingsClient() {
  const [me, setMe] = React.useState<MeOk | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);
  const [healthErr, setHealthErr] = React.useState<string | null>(null);
  const [brokenExternalUrls, setBrokenExternalUrls] = React.useState<Array<{ url: string; status?: number; reason?: string }>>([]);
  const [healthCheckedAtIso, setHealthCheckedAtIso] = React.useState<string | null>(null);
  const [healthCheckedCount, setHealthCheckedCount] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [layoutPreset, setLayoutPreset] = React.useState<WelcomeLayoutPreset>("mosaic");
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const fileRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const [menuPickerOpen, setMenuPickerOpen] = React.useState(false);
  const [menuPickerLoading, setMenuPickerLoading] = React.useState(false);
  const [menuPickerErr, setMenuPickerErr] = React.useState<string | null>(null);
  const [menuImages, setMenuImages] = React.useState<Array<{ menuItemId: string; imageUrl: string }>>([]);
  const [activeSlotIdx, setActiveSlotIdx] = React.useState<number | null>(null);

  const rid = me?.ok ? me.activeRestaurantId : null;
  const canEdit =
    me?.ok &&
    (me.session.globalRole === "SUPER_ADMIN" ||
      (rid ? me.memberships.some((m) => m.restaurantId === rid && m.role === "RESTAURANT_ADMIN") : false));

  React.useEffect(() => {
    void (async () => {
      setLoadErr(null);
      try {
        const meR = await fetch("/api/admin/me", { cache: "no-store" });
        const meJ = (await meR.json()) as MeOk | { ok: false };
        if (!meR.ok || !meJ.ok) {
          setLoadErr("Nejste přihlášeni.");
          setMe(null);
          setHydrated(true);
          return;
        }
        setMe(meJ);
        const active = meJ.activeRestaurantId?.trim() ?? "";
        if (!active) {
          setLoadErr("Vyberte aktivní restauraci v Přehledu.");
          setImageUrls(defaultAppUrls());
          setHydrated(true);
          return;
        }
        const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(active)}/welcome`, { cache: "no-store" });
        const j = (await r.json()) as {
          ok?: boolean;
          layoutPreset?: string;
          imageUrls?: string[];
          hasCustomRow?: boolean;
          error?: string;
        };
        if (!r.ok || !j.ok) {
          setLoadErr(j.error ?? "Nelze načíst nastavení.");
          setImageUrls(defaultAppUrls());
          setHydrated(true);
          return;
        }
        setLayoutPreset(parseWelcomeLayoutPreset(j.layoutPreset));
        if (Array.isArray(j.imageUrls)) {
          if (j.hasCustomRow) setImageUrls([...j.imageUrls]);
          else setImageUrls(j.imageUrls.length > 0 ? [...j.imageUrls] : []);
        } else {
          setImageUrls([]);
        }
        setHydrated(true);
      } catch {
        setLoadErr("Síťová chyba.");
        setHydrated(true);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (!hydrated || !rid) return;
    void (async () => {
      setHealthErr(null);
      try {
        const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(rid)}/welcome/health`, { cache: "no-store" });
        const j = (await r.json()) as {
          ok?: boolean;
          broken?: Array<{ url?: string; status?: number; reason?: string }>;
          checkedCount?: number;
          error?: string;
        };
        if (!r.ok || !j.ok) {
          setHealthErr(j.error ?? "Nelze ověřit externí URL obrázků.");
          setBrokenExternalUrls([]);
          setHealthCheckedAtIso(new Date().toISOString());
          setHealthCheckedCount(null);
          return;
        }
        const broken = Array.isArray(j.broken)
          ? j.broken
              .map((x) => ({ url: String(x.url ?? ""), status: x.status, reason: x.reason }))
              .filter((x) => x.url)
          : [];
        setBrokenExternalUrls(broken);
        setHealthCheckedAtIso(new Date().toISOString());
        setHealthCheckedCount(typeof j.checkedCount === "number" ? j.checkedCount : null);
      } catch {
        setHealthErr("Nelze ověřit externí URL obrázků (síť).");
        setBrokenExternalUrls([]);
        setHealthCheckedAtIso(new Date().toISOString());
        setHealthCheckedCount(null);
      }
    })();
  }, [hydrated, rid]);

  const setUrlAt = (idx: number, val: string) => {
    setImageUrls((prev) => {
      const next = [...prev];
      while (next.length <= idx) next.push("");
      next[idx] = val;
      return next;
    });
  };

  const firstEmptySlotIdx = React.useMemo(() => {
    const i = imageUrls.findIndex((x) => !String(x ?? "").trim());
    return i >= 0 ? i : null;
  }, [imageUrls]);

  const openMenuPicker = React.useCallback(
    async (idx: number | null) => {
      if (!rid || !canEdit) return;
      setActiveSlotIdx(idx);
      setMenuPickerOpen(true);
      setMenuPickerErr(null);
      setMenuPickerLoading(true);
      try {
        const r = await fetch(`/api/admin/menu/images?restaurantId=${encodeURIComponent(rid)}`, { cache: "no-store" });
        const j = (await r.json()) as {
          ok?: boolean;
          images?: Array<{ menuItemId?: string; imageUrl?: string }>;
          error?: string;
        };
        if (!r.ok || !j.ok || !Array.isArray(j.images)) {
          setMenuPickerErr(j.error ?? "Nelze načíst fotky z menu.");
          setMenuImages([]);
          return;
        }
        const cleaned = j.images
          .map((x) => ({
            menuItemId: String(x.menuItemId ?? "").trim(),
            imageUrl: String(x.imageUrl ?? "").trim(),
          }))
          .filter((x) => x.menuItemId && x.imageUrl);
        setMenuImages(cleaned);
      } catch {
        setMenuPickerErr("Nelze načíst fotky z menu (síť).");
        setMenuImages([]);
      } finally {
        setMenuPickerLoading(false);
      }
    },
    [canEdit, rid],
  );

  const applyPickedMenuImage = React.useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const idx = activeSlotIdx ?? firstEmptySlotIdx ?? 0;
      setUrlAt(idx, trimmed);
      setMenuPickerOpen(false);
    },
    [activeSlotIdx, firstEmptySlotIdx],
  );

  const addSlot = () => {
    setImageUrls((prev) => (prev.length >= 6 ? prev : [...prev, ""]));
  };

  const removeSlot = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const onUpload = async (idx: number, file: File | null) => {
    if (!file || !rid || !canEdit) return;
    setSaveErr(null);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(rid)}/welcome/upload`, {
        method: "POST",
        body: fd,
      });
      const j = (await r.json()) as { ok?: boolean; imageUrl?: string; error?: string };
      if (!r.ok || !j.ok || !j.imageUrl) {
        setSaveErr(j.error ?? "Nahrání selhalo.");
        return;
      }
      setUrlAt(idx, j.imageUrl);
    } catch {
      setSaveErr("Nahrání selhalo (síť).");
    }
  };

  const onSave = async () => {
    if (!rid || !canEdit) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const cleaned = imageUrls.map((x) => x.trim()).filter(Boolean);
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(rid)}/welcome`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layoutPreset, imageUrls: cleaned }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        imageUrls?: string[];
        layoutPreset?: string;
        hasCustomRow?: boolean;
      };
      if (!r.ok || !j.ok) {
        setSaveErr(j.error ?? "Uložení selhalo.");
        return;
      }
      if (typeof j.layoutPreset === "string") setLayoutPreset(parseWelcomeLayoutPreset(j.layoutPreset));
      if (Array.isArray(j.imageUrls)) {
        if (j.hasCustomRow) setImageUrls([...j.imageUrls]);
        else if (j.imageUrls.length > 0) setImageUrls([...j.imageUrls]);
        else setImageUrls(defaultAppUrls());
      }
    } catch {
      setSaveErr("Uložení selhalo (síť).");
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated) {
    return (
      <main className="adminPage">
        <p className="textMuted2">Načítám…</p>
      </main>
    );
  }

  return (
    <main className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>Úvodní stránka (welcome)</h1>
      <p className="textMuted2" style={{ margin: "0 0 12px", maxWidth: 720 }}>
        Max. velikost pro nahrání: <strong>10 MB</strong> na obrázek.
      </p>
      <p className="textMuted2" style={{ margin: "0 0 20px", maxWidth: 720, lineHeight: 1.55 }}>
        Fotky na úvodní stránce <Link href="/">/</Link> pro hosty a nepárované tablety. Můžete zadat URL (HTTPS nebo
        lokální cesta z nahraného souboru), nahrát obrázek z telefonu, nebo vybrat fotku z menu. Limit je max.{" "}
        <strong>6 obrázků</strong>. Nahrávání podporuje <strong>JPEG/PNG/WebP</strong> a max. <strong>10 MB</strong> na
        soubor (po nahrání se optimalizuje pro rychlé načítání). Rozložení: klasická mozaika (1+2), dvě poloviny 50/50,
        čtyři čtvrtiny 2×2, nebo jedna plocha se střídáním fotek.
      </p>

      {brokenExternalUrls.length > 0 ? (
        <p role="alert" style={{ color: "#fde68a", marginBottom: 16, maxWidth: 720, lineHeight: 1.55 }}>
          Některé externí URL obrázků se nepodařilo ověřit ({brokenExternalUrls.length}). Na welcome stránce se mohou
          nezobrazit. Doporučujeme obrázky nahrát nebo použít import do úložiště.{" "}
          <span className="textMuted2" style={{ display: "block", marginTop: 6 }}>
            {brokenExternalUrls
              .slice(0, 3)
              .map((x) => x.url)
              .join(" • ")}
            {brokenExternalUrls.length > 3 ? "…" : ""}
          </span>
        </p>
      ) : healthErr ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 16, maxWidth: 720 }}>
          {healthErr}
        </p>
      ) : (
        <p style={{ color: "#86efac", marginBottom: 16, maxWidth: 720 }}>
          {healthCheckedCount === 0
            ? "Žádné externí URL obrázků k ověření."
            : `Externí URL obrázků ověřeny${typeof healthCheckedCount === "number" ? ` (${healthCheckedCount})` : ""}: vše v pořádku.`}
          {healthCheckedAtIso ? (
            <span className="textMuted2" style={{ display: "block", marginTop: 6 }}>
              Zkontrolováno {new Date(healthCheckedAtIso).toLocaleString("cs-CZ")}
            </span>
          ) : null}
        </p>
      )}

      {loadErr ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 16 }}>
          {loadErr}
        </p>
      ) : null}

      {!canEdit && me?.ok && rid ? (
        <p className="textMuted2" style={{ marginBottom: 16 }}>
          Úpravy má jen <strong>vedoucí restaurace</strong> (RESTAURANT_ADMIN). Vy zatím můžete jen náhled.
        </p>
      ) : null}

      <section style={{ display: "grid", gap: 20, maxWidth: 720 }}>
        <div>
          <span style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Rozložení</span>
          <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: canEdit ? "pointer" : "not-allowed" }}>
            <input
              type="radio"
              name="wl"
              checked={layoutPreset === "mosaic"}
              disabled={!canEdit}
              onChange={() => setLayoutPreset("mosaic")}
            />
            Mozaika — velký vlevo, dva menší vpravo
          </label>
          <label
            style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, cursor: canEdit ? "pointer" : "not-allowed" }}
          >
            <input
              type="radio"
              name="wl"
              checked={layoutPreset === "split_half"}
              disabled={!canEdit}
              onChange={() => setLayoutPreset("split_half")}
            />
            Dvě poloviny — 50 % / 50 % (ideálně 2+ obrázků v rotaci)
          </label>
          <label
            style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, cursor: canEdit ? "pointer" : "not-allowed" }}
          >
            <input
              type="radio"
              name="wl"
              checked={layoutPreset === "grid_four"}
              disabled={!canEdit}
              onChange={() => setLayoutPreset("grid_four")}
            />
            Čtyři čtvrtiny — mřížka 2×2 přes celou obrazovku (4 sloty + rotace)
          </label>
          <label
            style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, cursor: canEdit ? "pointer" : "not-allowed" }}
          >
            <input
              type="radio"
              name="wl"
              checked={layoutPreset === "fade"}
              disabled={!canEdit}
              onChange={() => setLayoutPreset("fade")}
            />
            Jedna plocha — celá obrazovka, střídání fotek
          </label>
        </div>

        <div>
          <span style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Obrázky (pořadí = rotace na welcome)</span>
          <div style={{ display: "grid", gap: 10 }}>
            {imageUrls.map((url, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <input
                  className="chip"
                  style={{ padding: "8px 10px", flex: "1 1 200px", minWidth: 0, boxSizing: "border-box" }}
                  value={url}
                  disabled={!canEdit}
                  placeholder="https://… nebo /uploads/welcome/…"
                  onChange={(e) => setUrlAt(idx, e.target.value)}
                />
                <input
                  ref={(el) => {
                    fileRefs.current[idx] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void onUpload(idx, f);
                  }}
                />
                <button type="button" className="chip" disabled={!canEdit || !rid} onClick={() => fileRefs.current[idx]?.click()}>
                  Nahrát
                </button>
                <button type="button" className="chip" disabled={!canEdit || !rid} onClick={() => void openMenuPicker(idx)}>
                  Vybrat z menu…
                </button>
                <button type="button" className="chip" disabled={!canEdit} onClick={() => removeSlot(idx)}>
                  Odstranit řádek
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="chip" disabled={!canEdit || imageUrls.length >= 6} onClick={addSlot}>
              Přidat URL řádek
            </button>
            <button type="button" className="chip" disabled={!canEdit || !rid} onClick={() => void openMenuPicker(null)}>
              Vybrat z fotek menu…
            </button>
          </div>
        </div>

        {saveErr ? (
          <p role="alert" style={{ color: "#fecaca" }}>
            {saveErr}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btnPrimary" disabled={!canEdit || !rid || saving} onClick={() => void onSave()}>
            {saving ? "Ukládám…" : "Uložit"}
          </button>
          <Link href="/" className="chip" style={{ textDecoration: "none" }}>
            Otevřít welcome ↗
          </Link>
        </div>
      </section>

      {menuPickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vybrat fotku z menu"
          onClick={() => setMenuPickerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 100%)",
              maxHeight: "min(78vh, 820px)",
              overflow: "auto",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(16,22,36,0.96)",
              boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
              padding: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Vybrat fotku z menu</div>
                <div className="textMuted2" style={{ marginTop: 4, fontSize: 13 }}>
                  Kliknutím vložíte fotku do slotu {activeSlotIdx != null ? `#${activeSlotIdx + 1}` : " (první prázdný)"}.
                </div>
              </div>
              <button type="button" className="chip" onClick={() => setMenuPickerOpen(false)}>
                Zavřít
              </button>
            </div>

            {menuPickerLoading ? <p className="textMuted2" style={{ marginTop: 12 }}>Načítám fotky…</p> : null}
            {menuPickerErr ? (
              <p role="alert" style={{ color: "#fecaca", marginTop: 12 }}>
                {menuPickerErr}
              </p>
            ) : null}
            {!menuPickerLoading && !menuPickerErr && menuImages.length === 0 ? (
              <p className="textMuted2" style={{ marginTop: 12 }}>
                V menu zatím nejsou žádné uložené fotky. Nahrajte fotky u položek v <Link href="/admin/menu">Úpravy menu</Link>.
              </p>
            ) : null}

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              {menuImages.map((img) => (
                <button
                  key={`${img.menuItemId}-${img.imageUrl}`}
                  type="button"
                  onClick={() => applyPickedMenuImage(img.imageUrl)}
                  className="chip"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  title={img.imageUrl}
                >
                  <div
                    style={{
                      height: 110,
                      backgroundImage: `url(${img.imageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="textMuted2" style={{ padding: "8px 10px", fontSize: 12 }}>
                    {img.menuItemId}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
