import { redirect } from 'next/navigation';

// Aufgeräumt: eigene Features-Seite war Dublette der Community-Landingpage
// (FeatureGrid + CTA stehen jetzt auf /community).
export default function FeaturesAliasPage() {
  redirect('/community');
}
