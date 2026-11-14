import type { Metadata } from "next";
import { MunicipioView } from "@/components/views";
import { IDS, ROMANI } from "@/lib/engine";

export const dynamicParams = false;
export function generateStaticParams() {
  return IDS.map(n => ({ n }));
}
export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n } = await params;
  return { title: `Municipio ${ROMANI[+n]} · Roma in chiaro` };
}

export default async function Page({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  return <MunicipioView id={n} />;
}
