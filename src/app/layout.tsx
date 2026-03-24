import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';

export const metadata: Metadata = {
  title: 'ArroFeeder',
  description: 'Control your smart pet feeder.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Source+Code+Pro:wght@500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <div className="absolute top-0 left-0 -z-10 h-full w-full bg-background">
          <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,hsla(217,78%,58%,0.1),rgba(255,255,255,0))]"></div>
          <div className="absolute bottom-0 right-[-20%] top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,hsla(217,78%,58%,0.1),rgba(255,255,255,0))]"></div>
        </div>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
