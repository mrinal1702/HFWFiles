import { redirect } from "next/navigation";

/** @deprecated Use `/dashboard` — kept so old links still work. */
export default function AuctionsIndexRedirect() {
  redirect("/dashboard");
}
