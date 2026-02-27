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
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-default/60 bg-bg-primary/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-1.5 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded-md font-medium transition-colors hover:bg-accent-primary/15"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted mb-6 font-medium">
            Editor de vídeo com inteligência artificial
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-5 leading-[1.15] text-text-primary">
            Edite vídeos de forma{' '}
            <span className="text-accent-primary">inteligente</span>
          </h1>
          <p className="text-base text-text-secondary max-w-xl mx-auto mb-10 leading-relaxed">
            Corte silêncios, gere legendas, estilize e exporte para qualquer plataforma.
            Tudo no navegador, sem instalar nada.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/register"
              className="px-6 py-2.5 bg-accent-primary text-white rounded-md font-medium text-sm transition-colors hover:bg-accent-secondary"
            >
              Começar agora
            </Link>
            <Link
              href="/login"
              className="px-6 py-2.5 bg-bg-surface text-text-secondary rounded-md font-medium text-sm transition-colors border border-border-default hover:text-text-primary hover:border-border-active/40"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted text-center mb-3 font-medium">
            Funcionalidades
          </p>
          <h2 className="text-2xl font-semibold text-center mb-14 text-text-primary">
            Tudo que você precisa para criar conteúdo profissional
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-default/60 rounded-lg overflow-hidden border border-border-default/60">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-8 bg-bg-secondary"
              >
                <div className="w-9 h-9 rounded-md bg-bg-surface flex items-center justify-center mb-4 border border-border-default/60">
                  <feature.icon
                    size={18}
                    className="text-text-secondary"
                  />
                </div>
                <h3 className="text-sm font-medium mb-2 text-text-primary">{feature.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-default/60 py-8 px-6">
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
