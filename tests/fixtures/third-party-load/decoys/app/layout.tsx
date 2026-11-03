import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return <html lang="de" className={inter.className}><body>{children}</body></html>;
}
