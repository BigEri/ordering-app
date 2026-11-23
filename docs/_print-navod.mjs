import fs from "node:fs";

const md = fs.readFileSync(new URL("./navod-pro-vedouciho.md", import.meta.url), "utf8");

function inline(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

const lines = md.replace(/\r\n/g, "\n").split("\n");
const out = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (line.trim() === "") {
    i++;
    continue;
  }
  if (line.trim() === "---") {
    out.push("<hr>");
    i++;
    continue;
  }
  if (line.startsWith("# ")) {
    out.push(`<h1>${inline(line.slice(2))}</h1>`);
    i++;
    continue;
  }
  if (line.startsWith("## ")) {
    out.push(`<h2>${inline(line.slice(3))}</h2>`);
    i++;
    continue;
  }
  if (line.startsWith("| ")) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith("|")) {
      const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
      if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      i++;
    }
    const [head, ...body] = rows;
    out.push("<table>");
    if (head) out.push("<thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead>");
    out.push("<tbody>");
    for (const row of body) out.push("<tr>" + row.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
    out.push("</tbody></table>");
    continue;
  }
  if (line.startsWith("- ")) {
    const items = [];
    while (i < lines.length && lines[i].startsWith("- ")) {
      items.push(`<li>${inline(lines[i].slice(2))}</li>`);
      i++;
    }
    out.push("<ul>" + items.join("") + "</ul>");
    continue;
  }
  if (/^\d+\. /.test(line)) {
    const items = [];
    while (i < lines.length && /^\d+\. /.test(lines[i])) {
      let body = inline(lines[i].replace(/^\d+\. /, ""));
      i++;
      const nested = [];
      while (i < lines.length && /^\s+- /.test(lines[i])) {
        nested.push(`<li>${inline(lines[i].replace(/^\s+- /, ""))}</li>`);
        i++;
      }
      if (nested.length) body += "<ul>" + nested.join("") + "</ul>";
      items.push(`<li>${body}</li>`);
    }
    out.push("<ol>" + items.join("") + "</ol>");
    continue;
  }
  if (/^\s+- /.test(line)) {
    const items = [];
    while (i < lines.length && /^\s+- /.test(lines[i])) {
      items.push(`<li>${inline(lines[i].replace(/^\s+- /, ""))}</li>`);
      i++;
    }
    out.push("<ul>" + items.join("") + "</ul>");
    continue;
  }
  const para = [line];
  i++;
  while (
    i < lines.length &&
    lines[i].trim() !== "" &&
    !lines[i].startsWith("#") &&
    !lines[i].startsWith("- ") &&
    !lines[i].startsWith("|") &&
    lines[i].trim() !== "---" &&
    !/^\d+\. /.test(lines[i])
  ) {
    para.push(lines[i]);
    i++;
  }
  out.push(`<p>${inline(para.join(" "))}</p>`);
}

const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<title>Administrace Tableflow — návod pro vedoucího</title>
<style>
  @page { size: A4; margin: 16mm 16mm 18mm; }
  body { font-family: "Segoe UI", sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
  h1 { font-size: 20pt; line-height: 1.2; margin: 0 0 12px; }
  h2 { font-size: 14pt; margin: 18px 0 8px; page-break-after: avoid; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 0 0 10px; padding-left: 1.2em; }
  li > ul { margin: 4px 0 6px; }
  li { margin: 2px 0; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 14px 0; }
  strong { font-weight: 650; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 10pt; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f3f3f3; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
${out.join("\n")}
</body>
</html>`;

fs.writeFileSync(new URL("./navod-pro-vedouciho.print.html", import.meta.url), html);
