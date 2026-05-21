"use client";

import { KioskAnchor } from "./kiosk/KioskAnchor";
import * as React from "react";

import type { VirtualPosEvent } from "../lib/pos/virtualPosTypes";
import { buildToastMessage, typeBadgeModifier, typeLabel } from "../lib/pos/virtualPosLabels";
import { VirtualPosClearButton } from "./VirtualPosClearButton";
import { VirtualPosEventBody } from "./VirtualPosEventBody";

const POLL_MS = 2000;

export function VirtualPosLive({ initialEvents }: { initialEvents: VirtualPosEvent[] }) {
  const [events, setEvents] = React.useState<VirtualPosEvent[]>(initialEvents);
  const [toast, setToast] = React.useState<string | null>(null);
  const knownIdsRef = React.useRef<Set<string>>(new Set(initialEvents.map((e) => e.id)));

  React.useEffect(() => {
    let cancelled = false;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const showToast = (msg: string) => {
      if (toastTimer) clearTimeout(toastTimer);
      setToast(msg);
      toastTimer = setTimeout(() => {
        setToast(null);
      }, 4500);
    };

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`/api/pos/virtual-log?limit=200`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { events?: VirtualPosEvent[] };
        const incoming = data.events ?? [];

        const arrived = incoming.filter((e) => !knownIdsRef.current.has(e.id));
        if (arrived.length > 0) {
          showToast(buildToastMessage(arrived));
        }

        knownIdsRef.current = new Set(incoming.map((e) => e.id));
        setEvents(incoming);
      } catch {
        /* síť / dočasný výpadek */
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (toastTimer) clearTimeout(toastTimer);
    };
  }, []);

  return (
    <main className="virtualPosPage">
      {toast ? (
        <div className="virtualPosToast" role="status" aria-live="polite" aria-atomic="true">
          <span className="virtualPosToastText">{toast}</span>
          <button type="button" className="virtualPosToastClose chip" onClick={() => setToast(null)} aria-label="Zavřít upozornění">
            ×
          </button>
        </div>
      ) : null}

      <section className="virtualPosHero" aria-labelledby="virtual-pos-title">
        <div className="virtualPosHeroTop">
          <div>
            <span className="virtualPosKicker">Náhled integrace</span>
            <h1 id="virtual-pos-title" className="virtualPosTitle">
              Virtuální POS
            </h1>
            <p className="virtualPosLead">
              Události z objednávkové aplikace se ukládají na disk a na této stránce se obnovují automaticky (cca každé {POLL_MS / 1000}&nbsp;s).
            </p>
          </div>
          <div className="virtualPosActions">
            <VirtualPosClearButton disabled={events.length === 0} />
            <KioskAnchor href="/menu" className="chip chipLink">
              Zpět na menu
            </KioskAnchor>
          </div>
        </div>
        <div className="virtualPosMetaRow">
          <span className="virtualPosStat">
            Záznamů v náhledu: <strong>{events.length}</strong>
          </span>
          <span className="textMuted2" style={{ fontSize: 13 }}>
            Soubor <code className="virtualPosFilePath">data/virtual-pos/events.jsonl</code>
          </span>
        </div>
      </section>

      {events.length === 0 ? (
        <div className="virtualPosEmpty">
          <div className="virtualPosEmptyIcon" aria-hidden="true">
            📋
          </div>
          <h2 className="virtualPosEmptyTitle">Zatím nic v logu</h2>
          <p className="virtualPosEmptyText">
            V menu zkus <strong>Přivolat personál</strong>, <strong>Žádost o účet</strong>, v účtu <strong>Zaplatit</strong>, nebo potvrď objednávku – objeví se to zde bez obnovení stránky.
          </p>
        </div>
      ) : (
        <ul className="virtualPosEventList">
          {events
            .slice()
            .reverse()
            .map((e) => (
              <li key={e.id} className="virtualPosEventCard">
                <div className="virtualPosEventHead">
                  <div className="virtualPosEventHeadLeft">
                    <span className={`virtualPosTypeBadge ${typeBadgeModifier(e.type)}`}>{typeLabel(e.type)}</span>
                    <span className="virtualPosEventTime">{new Date(e.tsIso).toLocaleString("cs-CZ")}</span>
                  </div>
                </div>
                <div className="virtualPosEventId" title={e.id}>
                  {e.id}
                </div>
                <VirtualPosEventBody event={e} />
              </li>
            ))}
        </ul>
      )}

    </main>
  );
}
