import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Painel de Leads", description: "Painel de recebimento e gestão de leads" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}