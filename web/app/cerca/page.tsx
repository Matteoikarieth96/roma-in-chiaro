import { Suspense } from "react";
import { CercaView } from "@/components/views";

export const metadata = { title: "Cerca · Roma in chiaro" };

/* La parola cercata sta nell'indirizzo (?q=Ostia): la pagina si compone nel browser. */
export default function Page() {
  return <Suspense fallback={<main id="app" className="wrap" />}><CercaView /></Suspense>;
}
