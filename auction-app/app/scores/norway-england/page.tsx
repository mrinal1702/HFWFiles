import { redirect } from "next/navigation";

export default function NorwayEnglandRedirect() {
  redirect("/match-scores?match=norway-england");
}
