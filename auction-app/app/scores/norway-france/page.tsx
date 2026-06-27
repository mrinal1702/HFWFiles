import { redirect } from "next/navigation";

export default function NorwayFranceRedirect() {
  redirect("/match-scores?match=norway-france");
}
