import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import { Scissors, Subtitles, Palette, Monitor } from 'lucide-react';

const features = [
  {
    icon: Scissors,
    title: 'Corte Automático de Silêncio',
    description:
      'Detecta e remove automaticamente pausas e filler words do seu vídeo com análise inteligente de waveform.',
  },
  {
    icon: Subtitles,
    title: 'Legendas com IA',
    description:
      'Gere legendas automáticas com transcrição por IA. Edite em modo timeline ou lista com word-level timestamps.',
  },
  {
    icon: Palette,
    title: 'Estilização Dinâmica',
    description:
      'Customize fontes, cores, animações e efeitos de highlight. Use presets prontos ou crie seus próprios estilos.',
  },
  {
    icon: Monitor,
    title: 'Multi Aspect Ratio',
    description:
      'Redimensione para YouTube, TikTok, Reels, Instagram e mais com auto-reframe inteligente.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg-primary overflow-y-auto">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-default bg-bg-primary/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-accent-primary hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Começar Grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm mb-6">
            Editor de Vídeo Profissional com IA
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-6">
            Edite vídeos com{' '}
            <span className="bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
              inteligência artificial
            </span>
          </h1>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-10">
            Corte silêncios, gere legendas, estilize e exporte para qualquer plataforma.
            Tudo no navegador, sem instalar nada.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3 bg-accent-primary hover:bg-blue-600 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-accent-primary/25"
            >
              Começar Agora
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 bg-bg-surface hover:bg-bg-hover text-text-primary rounded-xl font-semibold text-lg transition-colors border border-border-default"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Tudo que você precisa para criar conteúdo profissional
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-border-default bg-bg-secondary hover:border-accent-primary/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-accent-primary/10 flex items-center justify-center mb-4 group-hover:bg-accent-primary/20 transition-colors">
                  <feature.icon
                    size={24}
                    className="text-accent-primary"
                  />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-default py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <p className="text-xs text-text-muted">
            &copy; 2026 Bethel Studio. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
