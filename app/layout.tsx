import '../styles/globals.css';
import { Navbar } from '@/components/Navbar';
import Providers from './providers';
import { ToastProvider } from '@/components/Toast';

export const metadata = {
  title: 'IntervYou',
  description: 'Mock technical interviews made simple.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <Providers>
          <ToastProvider>
            <Navbar />
            {children}
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
