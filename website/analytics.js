(() => {
  // Google tag / GA4 (Tableflow web)
  const GA_ID = "GTM-5MXZXKGW";

  if (!GA_ID || GA_ID.startsWith("REPLACE_")) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA_ID, { anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);
})();
