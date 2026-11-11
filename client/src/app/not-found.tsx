import Link from "next/link";
import { Translated } from "@/components/i18n/language";
export default function NotFound() { return <main className="mx-auto max-w-xl space-y-5 px-4 py-16"><h1 className="text-3xl font-bold"><Translated text="Page not found"/></h1><p><Translated text="The page may have moved or is unavailable."/></p><Link href="/" className="text-blue-700 underline"><Translated text="Home"/></Link></main>; }
