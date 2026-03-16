import './globals.css';

export const metadata = {
  title: 'Wizard of Wor Community',
  description: 'Community and competitive layer'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}
