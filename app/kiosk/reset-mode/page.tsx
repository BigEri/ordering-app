export const dynamic = "force-dynamic";

export default async function KioskResetModePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const toRaw = sp.to;
  const to = typeof toRaw === "string" ? toRaw.trim().toLowerCase() : "";

  const title =
    to === "host" ? "Přepínám na režim host" : to === "admin" ? "Přepínám na admin" : "Režim byl resetován";
  const body =
    to === "host" ? (
      <>
        Tablet přejde na <strong>Host (kiosk)</strong> — spárování nebo menu pro hosty.
      </>
    ) : to === "admin" ? (
      <>
        Tablet přejde do režimu <strong>Admin</strong>.
      </>
    ) : (
      <>
        Pokud jste v Android kiosk aplikaci, měla by se teď zobrazit úvodní volba <strong>Host / Admin</strong>.
      </>
    );

  return (
    <main style={{ maxWidth: 620, margin: "48px auto", padding: "0 20px", lineHeight: 1.55 }}>
      <h1 style={{ margin: "0 0 12px", fontSize: "1.4rem" }}>{title}</h1>
      <p style={{ margin: 0, opacity: 0.9 }}>{body}</p>
    </main>
  );
}

