import ForumBoard from '../../../components/ForumBoard';

export const metadata = {
  title: 'Forum',
  description: 'Join discussions, share tactics, and connect with other Wizard of Wor players.'
};

export default function ForumPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Community Forum</h1>
      <p className="text-sm text-zinc-400">
        Discuss strategy, share match stories, and find teammates.
      </p>
      <ForumBoard />
    </div>
  );
}
