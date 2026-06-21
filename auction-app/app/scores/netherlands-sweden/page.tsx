import { redirect } from "next/navigation";

export default function NetherlandsSwedenRedirect() {
  redirect("/match-scores?match=netherlands-sweden");
}
