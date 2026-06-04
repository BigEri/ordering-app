"use client";

import * as React from "react";
import { FilePickButton } from "../../../components/FilePickButton";
import { AdminChipLink } from "../../../components/admin/AdminNavLink";

import { parseWelcomeLayoutPreset, type WelcomeLayoutPreset } from "../../../lib/menu/welcomeLayoutPreset";
import {
  uniqueWelcomeImageUrls,
  welcomeLayoutInsufficientMessage,
  welcomeLayoutVisibleSlotCount,
} from "../../../lib/menu/welcomeShowcaseSlots";

type MeOk = {
  ok: true;
  session: { userId: string; email: string; globalRole: "SUPER_ADMIN" | "USER" };
  activeRestaurantId: string | null;
  memberships: { restaurantId: string; role: string }[];
};

type WelcomePayload = {
  ok?: boolean;
  layoutPreset?: string;
  imageUrls?: string[];
  hasCustomRow?: boolean;
  rejectedUrls?: string[];
  savedCount?: number;
  error?: string;
};

/** V editoru vždy aspoň jeden řádek — po smazání všech jinak zmizí vstupy a nejde nahrát fotku. */
function editorImageSlots(urls: string[]): string[] {
  return urls.length > 0 ? [...urls] : [""];
}

function cleanedUrlsFromEditor(urls: string[]): string[] {
  return urls.map((x) => x.trim()).filter(Boolean);
}

export function WelcomeSettingsClient() {
  const [me, setMe] = React.useState<MeOk | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [saveErr, setSaveErr] = React.useState<string | null>(null);
  const [saveOk, setSaveOk] = React.useState<string | null>(null);
  const [healthErr, setHealthErr] = React.useState<string | null>(null);
  const [brokenExternalUrls, setBrokenExternalUrls] = React.useState<Array<{ url: string; status?: number; reason?: string }>>([]);
  const [healthCheckedAtIso, setHealthCheckedAtIso] = React.useState<string | null>(null);
  const [healthCheckedCount, setHealthCheckedCount] = React.useState<number | null>(null);
  const [healthChecking, setHealthChecking] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploadingIdx, setUploadingIdx] = React.useState<number | null>(null);
  const [layoutPreset, setLayoutPreset] = React.useState<WelcomeLayoutPreset>("mosaic");
  const [imageUrls, setImageUrls] = React.useState<string[]>(editorImageSlots([]));
  const [pageReady, setPageReady] = React.useState(false);
  const [welcomeLoading, setWelcomeLoading] = React.useState(true);
  const [menuPickerOpen, setMenuPickerOpen] = React.useState(false);
  const [menuPickerLoading, setMenuPickerLoading] = React.useState(false);
  const [menuPickerErr, setMenuPickerErr] = React.useState<string | null>(null);
  const [menuImages, setMenuImages] = React.useState<Array<{ menuItemId: string; imageUrl: string }>>([]);
  const [activeSlotIdx, setActiveSlotIdx] = React.useState<number | null>(null);

  /** Po úpravě uživatele nepřepisovat starým načtením z API (race → „vrací se změny“). */
  const dirtyRef = React.useRef(false);
  const welcomeLoadGenRef = React.useRef(0);

  const rid = me?.ok ? me.activeRestaurantId : null;
  const canEdit =
    me?.ok &&
    (me.session.globalRole === "SUPER_ADMIN" ||
      (rid ? me.memberships.some((m) => m.restaurantId === rid && m.role === "RESTAURANT_ADMIN") : false));

  const markDirty = React.useCallback(() => {
    dirtyRef.current = true;
    setSaveOk(null);
  }, []);

  const applyWelcomePayload = React.useCallback((j: WelcomePayload, force = false) => {
    if (!force && dirtyRef.current) return;
    if (typeof j.layoutPreset === "string") setLayoutPreset(parseWelcomeLayoutPreset(j.layoutPreset));
    if (Array.isArray(j.imageUrls)) {
      if (j.hasCustomRow) setImageUrls(editorImageSlots(j.imageUrls));
      else if (j.imageUrls.length > 0) setImageUrls([...j.imageUrls]);
      else setImageUrls(editorImageSlots([]));
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      setLoadErr(null);
      try {
        const meR = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
        const meJ = (await meR.json()) as MeOk | { ok: false };
        if (!meR.ok || !meJ.ok) {
          setLoadErr("Nejste přihlášeni.");
          setMe(null);
          setPageReady(true);
          setWelcomeLoading(false);
          return;
        }
        setMe(meJ);
        setPageReady(true);
        if (!meJ.activeRestaurantId?.trim()) {
          setLoadErr("Nejdřív dokončete nastavení v Přehledu administrace.");
          setWelcomeLoading(false);
        }
      } catch {
        setLoadErr("Síťová chyba.");
        setPageReady(true);
        setWelcomeLoading(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    const active = rid?.trim() ?? "";
    if (!active) return;

    const gen = ++welcomeLoadGenRef.current;
    setWelcomeLoading(true);
    void (async () => {
      try {
        const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(active)}/welcome`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const j = (await r.json()) as WelcomePayload;
        if (gen !== welcomeLoadGenRef.current) return;
        if (!r.ok || !j.ok) {
          setLoadErr(j.error ?? "Nelze načíst nastavení.");
          return;
        }
        applyWelcomePayload(j);
      } catch {
        if (gen === welcomeLoadGenRef.current) setLoadErr("Síťová chyba při načítání welcome.");
      } finally {
        if (gen === welcomeLoadGenRef.current) setWelcomeLoading(false);
      }
    })();
  }, [rid, applyWelcomePayload]);

  const runHealthCheck = React.useCallback(async () => {
    if (!rid) return;
    setHealthChecking(true);
    setHealthErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(rid)}/welcome/health`, {
        cache: "no-store",
        credentials: "same-origin",
      });
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
      setHealthErr("Nepodařilo se ověřit externí odkazy (zřejmě výpadek připojení).");
      setBrokenExternalUrls([]);
      setHealthCheckedAtIso(new Date().toISOString());
      setHealthCheckedCount(null);
    } finally {
      setHealthChecking(false);
    }
  }, [rid]);

  const setUrlAt = (idx: number, val: string) => {
    markDirty();
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

  const uniqueSavedUrls = React.useMemo(() => uniqueWelcomeImageUrls(cleanedUrlsFromEditor(imageUrls)), [imageUrls]);
  const layoutNeeds = welcomeLayoutVisibleSlotCount(layoutPreset);
  const layoutInsufficient =
    uniqueSavedUrls.length > 0 && uniqueSavedUrls.length < layoutNeeds;
  const layoutWarnMsg = layoutInsufficient
    ? welcomeLayoutInsufficientMessage(layoutPreset, uniqueSavedUrls.length)
    : null;

  const persistWelcome = React.useCallback(
    async (
      urlsForSave: string[],
      preset: WelcomeLayoutPreset,
      opts?: { silent?: boolean },
    ): Promise<boolean> => {
      if (!rid || !canEdit) return false;
      const busy = saving || uploadingIdx != null;
      if (busy && !opts?.silent) return false;

      if (!opts?.silent) {
        setSaving(true);
        setSaveErr(null);
        setSaveOk(null);
      }
      try {
        const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(rid)}/welcome`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ layoutPreset: preset, imageUrls: urlsForSave }),
        });
        const j = (await r.json()) as WelcomePayload;
        if (!r.ok || !j.ok) {
          setSaveErr(j.error ?? "Uložení selhalo.");
          return false;
        }
        applyWelcomePayload(j, true);
        dirtyRef.current = false;

        const rejected = Array.isArray(j.rejectedUrls) ? j.rejectedUrls.filter(Boolean) : [];
        if (rejected.length > 0) {
          const preview = rejected.slice(0, 2).join(" · ");
          setSaveErr(
            `Server odmítl ${rejected.length} URL (neplatná adresa nebo jiná restaurace). ${preview}${rejected.length > 2 ? "…" : ""}`,
          );
          return false;
        }
        setSaveOk(opts?.silent ? "Nahráno a uloženo do databáze." : "Uloženo.");
        return true;
      } catch {
        setSaveErr("Uložení se nezdařilo (zřejmě výpadek připojení). Zkuste to prosím znovu.");
        return false;
      } finally {
        if (!opts?.silent) setSaving(false);
      }
    },
    [rid, canEdit, saving, uploadingIdx, applyWelcomePayload],
  );

  const openMenuPicker = React.useCallback(
    async (idx: number | null) => {
      if (!rid || !canEdit) return;
      setActiveSlotIdx(idx);
      setMenuPickerOpen(true);
      setMenuPickerErr(null);
      setMenuPickerLoading(true);
      try {
        const r = await fetch(`/api/admin/menu/images?restaurantId=${encodeURIComponent(rid)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
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
        setMenuPickerErr("Nepodařilo se načíst fotky z menu (zřejmě výpadek připojení).");
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
      const next = [...imageUrls];
      while (next.length <= idx) next.push("");
      next[idx] = trimmed;
      setImageUrls(editorImageSlots(next));
      markDirty();
      setMenuPickerOpen(false);
      void persistWelcome(cleanedUrlsFromEditor(next), layoutPreset, { silent: true });
    },
    [activeSlotIdx, firstEmptySlotIdx, imageUrls, layoutPreset, markDirty, persistWelcome],
  );

  const addSlot = () => {
    markDirty();
    setImageUrls((prev) => (prev.length >= 6 ? prev : [...prev, ""]));
  };

  const removeSlot = (idx: number) => {
    markDirty();
    setImageUrls((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return editorImageSlots(next);
    });
  };

  const onUpload = async (idx: number, file: File | null) => {
    if (!file || !rid || !canEdit) return;
    setSaveErr(null);
    setSaveOk(null);
    setUploadingIdx(idx);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(rid)}/welcome/upload`, {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const j = (await r.json()) as { ok?: boolean; imageUrl?: string; error?: string };
      if (!r.ok || !j.ok || !j.imageUrl) {
        setSaveErr(j.error ?? "Nahrání selhalo.");
        return;
      }
      const next = [...imageUrls];
      while (next.length <= idx) next.push("");
      next[idx] = j.imageUrl;
      setImageUrls(editorImageSlots(next));
      markDirty();
      await persistWelcome(cleanedUrlsFromEditor(next), layoutPreset, { silent: true });
    } catch {
      setSaveErr("Nahrání se nezdařilo (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setUploadingIdx(null);
    }
  };

  const onSave = async () => {
    await persistWelcome(cleanedUrlsFromEditor(imageUrls), layoutPreset);
  };

  const onLayoutChange = (preset: WelcomeLayoutPreset) => {
    markDirty();
    setLayoutPreset(preset);
  };

  if (!pageReady) {
    return (
      <main className="adminPage">
        <p className="textMuted2">Načítám…</p>
      </main>
    );
  }

  const formBusy = saving || uploadingIdx != null;

  return (
    <main className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>Úvodní stránka (welcome)</h1>
      <p className="textMuted2" style={{ margin: "0 0 12px", maxWidth: 720 }}>
        Max. velikost pro nahrání: <strong>10 MB</strong> na obrázek. Po nahrání se změny <strong>ukládají automaticky</strong> — tlačítkem Uložit potvrdíte i ručně zadané URL.
      </p>
      <p className="textMuted2" style={{ margin: "0 0 20px", maxWidth: 720, lineHeight: 1.55 }}>
        Nastavte fotky pro hosty na úvodní stránce. Maximum <strong>6 obrázků</strong>. Externí HTTPS odkazy lze zkontrolovat tlačítkem níže (nepřidává se při každém otevření stránky).
      </p>

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="chip" disabled={!rid || healthChecking} onClick={() => void runHealthCheck()}>
          {healthChecking ? "Kontroluji URL…" : "Zkontrolovat externí URL"}
        </button>
        {healthCheckedAtIso ? (
          <span className="textMuted2" style={{ fontSize: 12 }}>
            Poslední kontrola {new Date(healthCheckedAtIso).toLocaleString("cs-CZ")}
          </span>
        ) : null}
      </div>

      {brokenExternalUrls.length > 0 ? (
        <p role="alert" style={{ color: "#fde68a", marginBottom: 16, maxWidth: 720, lineHeight: 1.55 }}>
          Některé externí URL se nepodařilo ověřit ({brokenExternalUrls.length}). Nahrajte je raději přes „Nahrát“.{" "}
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
      ) : healthCheckedCount != null && healthCheckedAtIso ? (
        <p style={{ color: "#86efac", marginBottom: 16, maxWidth: 720, fontSize: 14 }}>
          {healthCheckedCount === 0
            ? "Žádné externí HTTPS URL k ověření."
            : `Externí URL (${healthCheckedCount}): v pořádku.`}
        </p>
      ) : null}

      {loadErr ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 16 }}>
          {loadErr}
        </p>
      ) : null}

      {layoutWarnMsg ? (
        <p role="alert" style={{ color: "#fde68a", marginBottom: 16, maxWidth: 720, lineHeight: 1.55 }}>
          {layoutWarnMsg} Stejný obrázek nelze použít dvakrát — každý slot musí mít jinou fotku.
        </p>
      ) : null}

      {welcomeLoading ? (
        <p className="textMuted2" style={{ marginBottom: 16 }}>
          Načítám uložené fotky…
        </p>
      ) : null}

      {!canEdit && me?.ok && rid ? (
        <p className="textMuted2" style={{ marginBottom: 16 }}>
          Úpravy má jen <strong>vedoucí restaurace</strong> (RESTAURANT_ADMIN). Vy zatím můžete jen náhled.
        </p>
      ) : null}

      <section style={{ display: "grid", gap: 20, maxWidth: 720, opacity: welcomeLoading ? 0.65 : 1 }}>
        <div>
          <span style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Rozložení</span>
          <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: canEdit ? "pointer" : "not-allowed" }}>
            <input
              type="radio"
              name="wl"
              checked={layoutPreset === "mosaic"}
              disabled={!canEdit || formBusy}
              onChange={() => onLayoutChange("mosaic")}
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
              disabled={!canEdit || formBusy}
              onChange={() => onLayoutChange("split_half")}
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
              disabled={!canEdit || formBusy}
              onChange={() => onLayoutChange("grid_four")}
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
              disabled={!canEdit || formBusy}
              onChange={() => onLayoutChange("fade")}
            />
            Jedna plocha — celá obrazovka, střídání fotek
          </label>
        </div>

        <div>
          <span style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Obrázky (pořadí = rotace na welcome)</span>
          {imageUrls.every((u) => !String(u ?? "").trim()) ? (
            <p className="textMuted2" style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.45 }}>
              Zatím nemáte vlastní fotky — vyplňte URL, nahrajte soubor, nebo vyberte z menu.
            </p>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {imageUrls.map((url, idx) => (
              <div
                key={`slot-${idx}`}
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
                  disabled={!canEdit || formBusy}
                  placeholder="https://… nebo /uploads/welcome/…"
                  onChange={(e) => setUrlAt(idx, e.target.value)}
                />
                <FilePickButton
                  className="chip"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={!canEdit || !rid || formBusy}
                  onFile={(f) => void onUpload(idx, f)}
                >
                  {uploadingIdx === idx ? "Nahrávám…" : "Nahrát"}
                </FilePickButton>
                <button
                  type="button"
                  className="chip"
                  disabled={!canEdit || !rid || formBusy}
                  onClick={() => void openMenuPicker(idx)}
                >
                  Vybrat z menu…
                </button>
                <button type="button" className="chip" disabled={!canEdit || formBusy} onClick={() => removeSlot(idx)}>
                  Odstranit řádek
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="chip" disabled={!canEdit || imageUrls.length >= 6 || formBusy} onClick={addSlot}>
              Přidat URL řádek
            </button>
            <button
              type="button"
              className="chip"
              disabled={!canEdit || !rid || formBusy}
              onClick={() => void openMenuPicker(null)}
            >
              Vybrat z fotek menu…
            </button>
          </div>
        </div>

        {saveOk ? (
          <p role="status" style={{ color: "#bbf7d0", margin: 0 }}>
            {saveOk}
          </p>
        ) : null}
        {saveErr ? (
          <p role="alert" style={{ color: "#fecaca", margin: 0 }}>
            {saveErr}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btnPrimary" disabled={!canEdit || !rid || formBusy} onClick={() => void onSave()}>
            {saving ? "Ukládám…" : "Uložit"}
          </button>
          <AdminChipLink href="/">Otevřít welcome ↗</AdminChipLink>
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
                  Kliknutím vložíte fotku do slotu {activeSlotIdx != null ? `#${activeSlotIdx + 1}` : " (první prázdný)"} a uložíte.
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
                V menu zatím nejsou žádné uložené fotky. Nahrajte fotky u položek v <a href="/admin/menu">Úpravy menu</a>.
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
