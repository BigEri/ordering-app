import type { MenuItemData } from "../../components/MenuItem";

/**
 * Lokální úpravy nad daty z Dotykačky.
 *
 * Pozn.: Automatické doplňování ingrediencí (např. "Rajče" u burgerů) je vypnuté.
 * Ingredience se spravují ručně v administraci (Překlady menu → Ingredience).
 */
export function applyMenuItemOverrides(item: MenuItemData): MenuItemData {
  return item;
}
