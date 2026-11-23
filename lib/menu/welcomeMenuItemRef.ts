/**
 * Fotka úvodní obrazovky vybraná z menu se ukládá jako odkaz na jídlo, ne na soubor —
 * při změně fotky jídla (TableFlow i pokladna) se změní i na úvodní obrazovce.
 */
const PREFIX = "menu-item:";
const MAX_ID_LEN = 200;

export function welcomeMenuItemRef(menuItemId: string): string {
  return `${PREFIX}${menuItemId.trim()}`;
}

/** ID jídla z odkazu, nebo `null`, pokud jde o obyčejnou adresu fotky. */
export function parseWelcomeMenuItemRef(value: string): string | null {
  const v = value.trim();
  if (!v.startsWith(PREFIX)) return null;
  const id = v.slice(PREFIX.length).trim();
  if (!id || id.length > MAX_ID_LEN || /[\s/\\]/.test(id)) return null;
  return id;
}
