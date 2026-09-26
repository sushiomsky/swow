import { redirect } from 'next/navigation';

// N3 follow-up: `/community/users/*` alias (previously Next-404).
// Canonical profile route is `/community/profile/[username]`.
export default function UserAliasPage({ params }) {
  redirect(`/community/profile/${encodeURIComponent(params.username)}`);
}
