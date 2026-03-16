const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://wizardofwor.duckdns.org';

export default function sitemap() {
  const paths = [
    '/community',
    '/community/features',
    '/community/leaderboards',
    '/community/challenges',
    '/community/chat',
    '/community/about',
    '/community/faq',
    '/community/contact',
    '/community/privacy-policy',
    '/community/terms-of-service'
  ];
  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date()
  }));
}
