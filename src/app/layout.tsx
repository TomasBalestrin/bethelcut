import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bethel Studio - Editor de Vídeo com IA',
  description:
    'Plataforma profissional de edição de vídeos com corte automático de silêncio, legendas com IA e muito mais.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
