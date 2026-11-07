/**
 * The home page (hand-written, not built from blocks). Server components; only the molecule canvas and the
 * count-up numbers run in the browser.
 */
import { ArrowRight, Blocks, Clock, Cpu, Droplet, FlaskConical, Globe, Sparkle, User, Users } from 'lucide-react'
import type { MessageKey } from '@petrik/shared/i18n'
import { dateTag } from '@petrik/shared/format'
import { getPosts } from '@/lib/api'
import type { Locale, T } from '@/lib/i18n'
import { thumbnail } from '../Picture'
import { SmartLink } from '../SmartLink'
import { YouTube } from '../YouTube'
import { CountUp } from './CountUp'
import { MoleculeField } from './MoleculeField'

const STATS: { value: number; prefix: string; suffix: string; label: MessageKey }[] = [
  { value: 140, prefix: '', suffix: '+', label: 'home.statYears' },
  { value: 1200, prefix: '~', suffix: '', label: 'home.statStudents' },
  { value: 25, prefix: '~', suffix: '%', label: 'home.statBilingual' },
]

const HERO_FALLBACK = '/img/hero-640.webp'

function Hero({ t }: { t: T }) {
  const words = t('home.headline').split(' ')
  return (
    <section className="relative isolate w-full max-w-screen overflow-x-hidden overflow-hidden bg-[#1B2420] text-petrikcream">
      <picture className="contents">
        <source type="image/avif" srcSet="/img/hero-640.avif 640w, /img/hero-1280.avif 1280w, /img/hero-1920.avif 1920w" sizes="100vw" />
        <source type="image/webp" srcSet="/img/hero-640.webp 640w, /img/hero-1280.webp 1280w, /img/hero-1920.webp 1920w" sizes="100vw" />
        <img src="/img/hero-1280.jpg" srcSet="/img/hero-640.jpg 640w, /img/hero-1280.jpg 1280w, /img/hero-1920.jpg 1920w" sizes="100vw" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <div className="absolute inset-0 bg-black/60" />
      <div className="hero-glow absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-petrikaccent/40 blur-[120px]" />
      <div className="hero-glow absolute -bottom-52 right-0 h-[30rem] w-[30rem] rounded-full bg-petriklight/20 blur-[130px] [animation-delay:-6s]" />
      <MoleculeField />
      <div className="hero-stripes pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-[40rem] max-w-7xl flex-col justify-center px-6 py-10 md:min-h-[46rem] md:px-10">
        <p className="hero-rise font-mono text-[10px] uppercase tracking-[0.2em] text-petrikpale md:text-xs" style={{ animationDelay: '0.1s' }}>
          {t('home.eyebrow')}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-[1.05] md:text-6xl">
          {words.map((word, i) => (
            <span key={i} className="mr-[0.25em] inline-block overflow-hidden align-bottom">
              <span className="hero-word inline-block" style={{ animationDelay: `${0.25 + i * 0.09}s` }}>
                {word}
              </span>
            </span>
          ))}
        </h1>
        <p className="hero-rise mt-5 max-w-lg font-body text-sm leading-relaxed text-petrikcream/80 md:text-base" style={{ animationDelay: '1s' }}>
          {t('home.lead')}
        </p>
        <div className="hero-rise mt-6 flex flex-wrap items-center gap-x-6 gap-y-4" style={{ animationDelay: '1.15s' }}>
          <SmartLink
            href="/nyolcadikos"
            className="group inline-flex items-center gap-3 rounded-full bg-petrikaccent px-6 py-3 text-sm font-body font-semibold text-white shadow-[0_0_40px_-4px_rgba(43,130,114,0.8)] transition hover:bg-petrikaccentdark"
          >
            {t('nav.eighthGraders')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </SmartLink>
          <SmartLink href="/technikusi-kepzesek" className="border-b-2 border-petrikcream/30 pb-0.5 text-sm font-body font-semibold transition hover:border-petriklight hover:text-petriklight">
            {t('home.explore')}
          </SmartLink>
        </div>
        <dl className="hero-rise mt-8 grid max-w-2xl grid-cols-3 gap-4 border-t border-petrikcream/20 pt-5 md:mt-10" style={{ animationDelay: '1.3s' }}>
          {STATS.map((s) => (
            <div key={s.label}>
              <dd className="font-display text-2xl font-semibold tabular-nums md:text-4xl">
                <CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} />
              </dd>
              <dt className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-petrikcream/60 md:text-[11px]">{t(s.label)}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

async function News({ t, locale }: { t: T; locale: Locale }) {
  const { posts } = await getPosts({ limit: 8 })
  if (posts.length === 0) return null
  return (
    <section className="px-4 py-20 bg-petrikpale/30 w-full max-w-screen overflow-x-hidden min-h-screen">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h2 className="text-2xl font-bold md:text-4xl">{t('home.latestNews')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {posts.map((post) => (
            <article key={post.slug} className="flex flex-col bg-petrikcard rounded-xl overflow-hidden border border-black/5 shadow-sm">
              <div
                className="relative h-44 border-b-4 border-petrikaccent"
                style={{ backgroundImage: `url(${post.image ? thumbnail(post.image) : HERO_FALLBACK})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              >
                <span className="absolute top-4 left-4 bg-petrikaccent text-white font-mono font-semibold text-xs uppercase tracking-widest px-4 py-2 rounded-full">{dateTag(post.publishedAt, locale)}</span>
              </div>
              <div className="flex flex-col flex-1 p-5 gap-2">
                <h3 className="font-display font-semibold text-lg text-petrikink">{post.title}</h3>
                <p className="font-body text-petriksoft leading-relaxed text-sm flex-1 line-clamp-3">{post.excerpt}</p>
                <SmartLink href={`/hirek/${post.slug}`} className="mt-4 text-xs font-semibold uppercase tracking-wider text-petrikaccentdark">
                  {t('home.details')}
                </SmartLink>
              </div>
            </article>
          ))}
        </div>
        <SmartLink className="text-petrikaccentdark border-b-2 border-petrikaccentdark w-max" href="/hirek">
          {t('home.allNews')}
        </SmartLink>
      </div>
    </section>
  )
}

const PROGRAMMES = [
  { icon: FlaskConical, bg: 'bg-petrikaccent', title: 'home.chemistry', text: 'home.chemistryText', href: '/vegyipar-agazat' },
  { icon: Droplet, bg: 'bg-petrikink', title: 'home.environment', text: 'home.environmentText', href: '/kornyezetvedelem-agazat' },
  { icon: Cpu, bg: 'bg-petrikaccentdark', title: 'home.it', text: 'home.itText', href: '/informatika-agazat' },
] as const

function Occupations({ t }: { t: T }) {
  return (
    <section className="px-4 py-20 bg-petrikbg w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h2 className="text-2xl font-bold md:text-4xl w-140 max-w-full">{t('home.programmes')}</h2>
        <p className="text-petrikfaint text-md w-140 max-w-full">{t('home.programmesLead')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:max-w-4/6 mx-auto mt-10">
        {PROGRAMMES.map(({ icon: Icon, bg, title, text, href }) => (
          <article key={href} className="flex flex-col bg-petrikcard rounded-lg border border-petriklinesoft p-8">
            <div className={`${bg} text-white size-12 rounded-md flex items-center justify-center`}>
              <Icon size={24} />
            </div>
            <h3 className="font-display font-semibold text-xl text-petrikink mt-6">{t(title)}</h3>
            <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">{t(text)}</p>
            <SmartLink href={href} className="text-xs font-semibold uppercase tracking-wider text-petrikaccentdark mt-auto pt-8">
              {t('home.learnMore')}
            </SmartLink>
          </article>
        ))}
      </div>
    </section>
  )
}

const REASONS = [
  { icon: Sparkle, n: 1 },
  { icon: Blocks, n: 2 },
  { icon: Globe, n: 3 },
  { icon: Users, n: 4 },
  { icon: Clock, n: 5 },
  { icon: User, n: 6 },
] as const

function Reasons({ t }: { t: T }) {
  return (
    <section className="px-4 py-20 bg-white w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h2 className="text-2xl font-bold md:text-4xl w-140 max-w-full">{t('home.whyUs')}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12 md:max-w-4/6 mx-auto mt-10">
        {REASONS.map(({ icon: Icon, n }) => (
          <article key={n} className="flex flex-col w-full items-center text-center md:text-start md:items-start">
            <div className="bg-petriktint text-petrikaccentdark size-12 rounded-full flex items-center justify-center">
              <Icon size={24} strokeWidth={1.5} />
            </div>
            <h3 className="font-display font-semibold text-xl text-petrikink mt-6">{t(`home.reason${n}Title`)}</h3>
            <p className="font-body text-petriksoft mt-4 leading-relaxed text-sm">{t(`home.reason${n}Text`)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

const PROJECT_LOGOS: [string, MessageKey][] = [
  ['mupa', 'home.logoMupa'],
  ['languagecert', 'home.logoLanguageCert'],
  ['tempus', 'home.logoTempus'],
  ['erasmus', 'home.logoErasmus'],
  ['penz7', 'home.logoPenz7'],
  ['etwinning', 'home.logoEtwinning'],
  ['digitalis', 'home.logoDigitalis'],
  ['codeweek', 'home.logoCodeweek'],
  ['otpfay', 'home.logoOtpFay'],
  ['prosuli', 'home.logoProsuli'],
]
const PARTNER_LOGOS: [string, string][] = [
  ['egis', 'EGIS'],
  ['richter', 'Gedeon Richter Ltd.'],
  ['teva', 'Teva'],
  ['sanofi', 'Sanofi'],
  ['cisco', 'Cisco'],
  ['microsoft', 'Microsoft'],
]

function PartnerLogo({ name, alt }: { name: string; alt: string }) {
  return (
    <picture className="contents">
      <source type="image/webp" srcSet={`/img/partners/${name}.webp`} />
      <img src={`/img/partners/${name}.png`} alt={alt} loading="lazy" className="w-40 shrink-0 md:w-full h-32 object-contain" />
    </picture>
  )
}

function Projects({ t }: { t: T }) {
  return (
    <section className="px-4 py-20 bg-petrikbg w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h2 className="text-2xl font-bold md:text-4xl w-200 max-w-full">{t('home.projectsTitle')}</h2>
        <p className="text-petrikfaint text-md w-140 max-w-full">{t('home.projectsLead')}</p>
      </div>
      <div className="flex overflow-x-auto md:overflow-visible md:grid md:grid-cols-5 gap-x-10 gap-y-12 md:max-w-4/6 mx-auto mt-10 items-center pb-4">
        {PROJECT_LOGOS.map(([name, alt]) => (
          <PartnerLogo key={name} name={name} alt={t(alt)} />
        ))}
      </div>
    </section>
  )
}

const COUNTERS: [string, MessageKey][] = [
  ['1178', 'home.counterStudents'],
  ['120', 'home.counterTeachers'],
  ['35', 'home.counterClassrooms'],
  ['23', 'home.counterLabs'],
  ['1', 'home.counterGoal'],
]

function Introduction({ t }: { t: T }) {
  return (
    <section className="px-4 py-20 bg-white w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:flex-row justify-evenly items-center md:max-w-4/6 mx-auto gap-10">
        <div className="md:w-1/2 w-full aspect-video overflow-hidden rounded-lg">
          <YouTube id="NnanAwvV8FI" title={t('home.videoTitle')} playLabel={t('common.playVideo', { title: t('home.videoTitle') })} />
        </div>
        <div className="flex flex-col gap-5 md:w-1/2 text-center md:text-start">
          <h2 className="text-2xl font-bold italic font-serif">{t('home.aboutTitle')}</h2>
          <p className="text-petrikfaint text-md">{t('home.aboutText')}</p>
        </div>
      </div>
      <dl className="mx-auto mt-14 grid grid-cols-2 gap-6 text-center sm:grid-cols-5 md:max-w-4/6">
        {COUNTERS.map(([value, label]) => (
          <div key={label}>
            <dd className="font-display text-4xl font-bold text-petrikaccentdark">{value}</dd>
            <dt className="mt-1 font-mono text-xs uppercase tracking-[0.15em] text-petriksoft">{t(label)}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Partners({ t }: { t: T }) {
  return (
    <section className="px-4 py-20 bg-petrikbg w-full max-w-screen overflow-x-hidden min-h-max">
      <div className="flex flex-col md:max-w-4/6 mx-auto gap-10">
        <h2 className="text-2xl font-bold md:text-4xl w-140 max-w-full">{t('home.partnersTitle')}</h2>
      </div>
      <div className="flex overflow-x-auto md:overflow-visible md:grid md:grid-cols-6 gap-x-10 gap-y-12 md:max-w-4/6 mx-auto mt-10 items-center pb-4">
        {PARTNER_LOGOS.map(([name, alt]) => (
          <PartnerLogo key={name} name={name} alt={alt} />
        ))}
      </div>
    </section>
  )
}

export function Landing({ t, locale }: { t: T; locale: Locale }) {
  return (
    <>
      <Hero t={t} />
      <News t={t} locale={locale} />
      <Occupations t={t} />
      <Reasons t={t} />
      <Projects t={t} />
      <Introduction t={t} />
      <Partners t={t} />
    </>
  )
}
