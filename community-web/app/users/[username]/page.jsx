import { redirect } from 'next/navigation';

// F1: Top-Level `/users/<name>` (zuvor Next-404) leitet auf die kanonische
// Profil-Route `/community/profile/<name>` weiter.
export default function TopLevelUserAliasPage({ params }) {
  redirect(`/community/profile/${encodeURIComponent(params.username)}`);
}
