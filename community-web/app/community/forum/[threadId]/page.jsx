import ForumThreadView from '../../../../components/ForumThreadView';

export const metadata = {
  title: 'Forum Thread',
  description: 'Read and reply to community forum conversations.'
};

export default function ForumThreadPage({ params }) {
  return <ForumThreadView threadId={params.threadId} />;
}
