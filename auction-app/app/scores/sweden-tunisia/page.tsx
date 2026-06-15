import { redirect } from "next/navigation";

export default function SwedenTunisiaRedirect() {
  redirect("/match-scores?match=sweden-tunisia");
}
