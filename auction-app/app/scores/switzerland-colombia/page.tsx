import { redirect } from "next/navigation";

export default function SwitzerlandColombiaRedirect() {
  redirect("/match-scores?match=switzerland-colombia");
}
