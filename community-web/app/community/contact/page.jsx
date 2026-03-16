export const metadata = {
  title: 'Contact',
  description: 'Contact Wizard of Wor community support for moderation, account, and platform inquiries.'
};

export default function ContactPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Contact & Support</h1>
      <section className="card space-y-2 text-sm text-zinc-300">
        <p>For support, moderation appeals, event questions, or ad/compliance inquiries:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Email: support@wizardofwor.community</li>
          <li>Moderation: moderation@wizardofwor.community</li>
          <li>Business/Ads: business@wizardofwor.community</li>
        </ul>
      </section>
      <section className="card text-sm text-zinc-300">
        <p>Response target: 24–72 hours depending on request volume.</p>
      </section>
    </div>
  );
}
