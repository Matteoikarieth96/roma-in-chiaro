import { Suspense } from "react";
import { ConfrontoView } from "@/components/ConfrontoView";

export const metadata = { title: "Confronta due municipi · Roma in chiaro" };

/* I due municipi stanno nell'indirizzo (?a=6&b=12): la pagina si compone nel browser. */
export default function Page() {
  return <Suspense fallback={<main id="app" className="wrap" />}><ConfrontoView /></Suspense>;
}
