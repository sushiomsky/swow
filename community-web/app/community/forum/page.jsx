import ForumBoard from '../../../components/ForumBoard';

export const metadata = {
  title: 'Forum',
  description: 'Join discussions, share tactics, and connect with other Wizard of Wor players.'
};

export default function ForumPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Forum</h1>
      <p className="text-sm text-zinc-400">
        Diskutiere Strategien, teile Spielgeschichten und finde Mitspieler.
      </p>
      <ForumBoard />
    </div>
  );
}
