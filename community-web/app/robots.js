export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: ['/community', '/community/*'], disallow: ['/admin'] }],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://wizardofwor.duckdns.org'}/sitemap.xml`
  };
}
