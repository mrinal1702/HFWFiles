import { redirect } from "next/navigation";

export default function CzechiaMexicoRedirect() {
  redirect("/match-scores?match=czechia-mexico");
}
