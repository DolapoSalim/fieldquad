
import type {Metadata} from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'FieldQuAD - Field Quadrant Annotator',
  description: 'Annotate images of fieldwork quadrants with ease.',
  // Favicon links are automatically handled by Next.js when using icon.tsx/favicon.ico
  // icons: {
  //   icon: '/favicon.ico', // Keep if you have a static favicon.ico
  //   // other icons...
  // },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${roboto.variable} font-sans antialiased h-full`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
