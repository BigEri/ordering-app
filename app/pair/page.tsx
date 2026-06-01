import { redirect } from "next/navigation";

/** Dříve „jednoduché párování“ — sjednoceno na párování u stolů s Dotykačkou. */
export default function PairPage() {
  redirect("/admin/devices/pair-kiosk");
}
