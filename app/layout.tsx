import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import Providers from './providers';
import { ToastProvider } from '@/components/Toast';
import { LatencyMonitor } from '@/components/LatencyMonitor';

export const metadata = {
  title: 'IntervYou',
  description: 'Mock technical interviews made simple.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 flex flex-col">
        <Providers>
          <ToastProvider>
            <Navbar />
            <div className="flex-1">
              {children}
            </div>
            <Footer />
            <LatencyMonitor />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
