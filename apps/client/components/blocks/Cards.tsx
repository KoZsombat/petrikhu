import type { BlockProps } from '@petrik/shared/blocks'
import { isEmail } from '@petrik/shared/links'
import { cx } from '../cx'
import { Picture } from '../Picture'
import { SmartLink } from '../SmartLink'
import { Container, DateTag, take } from './shared'
import type { BlockContext } from './shared'

type Props = BlockProps<'cards'>
type TextItem = Extract<Props, { variant: 'text' }>['items'][number]
type PersonItem = Extract<Props, { variant: 'person' }>['items'][number]
type StatItem = Extract<Props, { variant: 'stat' }>['items'][number]

/* Full class names are written out on purpose so Tailwind can detect them. */
const COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
}

const CARD = 'relative rounded-lg border border-petriklinesoft bg-petrikcard'
/* Clickable card: the link's ::after layer covers the whole card. */
const STRETCH = "after:absolute after:inset-0 after:content-['']"
const CARD_FOCUS = 'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-petrikaccent'

export function Cards(props: Props, ctx: BlockContext) {
  const heading = props.variant === 'stat' ? undefined : props.heading
  return (
    <section data-component="cards" data-variant={props.variant} className="py-14 md:py-16">
      <Container>
        {heading && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{heading}</h2>}
        <ul className={cx('grid gap-4', props.variant === 'stat' && 'gap-y-8', COLUMNS[props.columns])}>
          {props.variant === 'text' && take(props.items, props.limit).map((item, i) => <TextCard key={i} item={item} ctx={ctx} />)}
          {props.variant === 'person' && take(props.items, props.limit).map((item, i) => <PersonCard key={i} item={item} ctx={ctx} />)}
          {props.variant === 'stat' && take(props.items, props.limit).map((item, i) => <StatCard key={i} item={item} />)}
        </ul>
      </Container>
    </section>
  )
}

function TextCard({ item, ctx }: { item: TextItem; ctx: BlockContext }) {
  const { title, text, eyebrow, date, href, linkLabel } = item
  return (
    <li className="flex">
      <article className={cx(CARD, 'flex w-full flex-col items-start p-[22px]', href && cx('motion-safe:transition-shadow hover:shadow-md', CARD_FOCUS))}>
        {date && <DateTag date={date} className="mb-3" />}
        {eyebrow && <p className="petrik-eyebrow mb-2">{eyebrow}</p>}
        <h3 className="font-display text-[17px] font-bold leading-snug">{title}</h3>
        {text && <p className="mt-2 whitespace-pre-line text-sm leading-[1.55] text-petriksoft">{text}</p>}
        {href && (
          <SmartLink href={href} className={cx('petrik-eyebrow mt-auto pt-4 font-medium hover:underline', STRETCH)}>
            {linkLabel ?? ctx.t('common.details')}
          </SmartLink>
        )}
      </article>
    </li>
  )
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0][0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

function PersonCard({ item, ctx }: { item: PersonItem; ctx: BlockContext }) {
  const { name, role, room, phone, email, photo } = item
  return (
    <li className="flex">
      <article className={cx(CARD, 'flex w-full items-start gap-4 p-[22px]')}>
        {photo ? (
          <Picture src={photo} alt={ctx.t('common.photoOf', { name })} sizes="48px" loading="lazy" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-petriktint font-mono text-sm font-medium text-petrikaccentdark">
            {initials(name)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-body text-base font-semibold leading-snug">{name}</h3>
          {role && <p className="petrik-eyebrow mt-1">{role}</p>}
          <div className="mt-2 space-y-0.5 text-[13px] leading-normal text-petriksoft">
            {room && <p className="whitespace-pre-line">{room}</p>}
            {phone && (
              <p>
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:underline">
                  {phone}
                </a>
              </p>
            )}
            {email && (
              <p className="break-words">
                {isEmail(email) ? (
                  <a href={`mailto:${email}`} className="hover:underline">
                    {email}
                  </a>
                ) : (
                  email
                )}
              </p>
            )}
          </div>
        </div>
      </article>
    </li>
  )
}

function StatCard({ item }: { item: StatItem }) {
  return (
    <li>
      <p className="font-display text-[40px] font-bold leading-none text-petrikaccentdark md:text-[42px]">{item.value}</p>
      <p className="mt-2 font-mono text-[11.5px] uppercase tracking-[0.08em] text-petrikfaint">{item.label}</p>
    </li>
  )
}
