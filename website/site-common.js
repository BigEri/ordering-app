(() => {
  const toggle = document.querySelector(".top__toggle");
  const nav = document.getElementById("site-nav");

  function setNav(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Zavřít menu" : "Otevřít menu");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("is-nav", open);
  }

  toggle?.addEventListener("click", () => {
    setNav(toggle.getAttribute("aria-expanded") !== "true");
  });
  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNav(false));
  });

  const contactForm = document.getElementById("contact-form");
  const contactStatus = document.getElementById("contact-status");
  const contactSubmit = document.getElementById("contact-submit");
  const WEB3FORMS_ACCESS_KEY = "cd183827-deda-4fbd-92ea-af2e4de3eace";
  const pageSource = document.body?.dataset?.source || "web";

  function setContactStatus(type, text) {
    if (!contactStatus) return;
    contactStatus.hidden = !text;
    contactStatus.className = `contact__status${type ? ` contact__status--${type}` : ""}`;
    contactStatus.textContent = text || "";
  }

  contactForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.botcheck?.checked) return;

    const venue = form.venue.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const tables = form.tables.value.trim();
    const message = form.message.value.trim();

    if (!venue) {
      setContactStatus("error", "Zadejte název provozovny.");
      form.venue.focus();
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setContactStatus("error", "Zadejte platný e-mail, ať vám můžeme odepsat.");
      form.email.focus();
      return;
    }

    if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY.startsWith("REPLACE_")) {
      setContactStatus("error", "Formulář ještě není napojený. Napište nám prosím na info@tableflow.cz.");
      return;
    }

    contactSubmit.disabled = true;
    contactSubmit.textContent = "Odesílám…";
    setContactStatus("pending", "Odesílám poptávku…");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: `Poptávka Tableflow — ${pageSource}`,
          from_name: "Tableflow web",
          email,
          name: venue,
          Provozovna: venue,
          Telefon: phone || "—",
          "Počet stolů": tables || "—",
          Zpráva: message || "—",
          Zdroj: pageSource,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || "Odeslání se nepovedlo.");
          form.reset();
          setContactStatus("ok", "Poptávka je odeslaná. Ozveme se na váš e-mail.");
          if (typeof window.gtag === "function") {
            window.gtag("event", "generate_lead", {
              method: "contact_form",
              page_source: pageSource,
            });
          }
        } catch (err) {
      setContactStatus("error", "Odeslání se nepovedlo. Napište nám prosím na info@tableflow.cz.");
    } finally {
      contactSubmit.disabled = false;
      contactSubmit.textContent = "Domluvit prezentaci";
    }
  });
})();
