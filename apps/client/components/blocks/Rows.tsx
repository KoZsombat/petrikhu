import type { BlockProps } from '@petrik/shared/blocks'
import { cx } from '../cx'
import { Container, take } from './shared'

export const ROW = 'border-t border-petrikline last:border-b'

export function Rows(props: BlockProps<'rows'>) {
  return (
    <section data-component="rows" data-variant={props.variant} className="py-14 md:py-16">
      <Container>
        {props.heading && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{props.heading}</h2>}
        {props.variant === 'fact' && (
          <dl>
            {take(props.rows, props.limit).map((row, i) => (
              <div key={i} className={cx(ROW, 'grid gap-1 py-3.5 text-[14.5px] sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-6')}>
                <dt className="font-semibold text-petrikink">{row.label}</dt>
                <dd className="text-petriksoft">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {props.variant === 'step' && (
          <ol>
            {take(props.rows, props.limit).map((row, i) => (
              <li key={i} className={cx(ROW, 'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-3.5 text-[14.5px] sm:gap-6')}>
                <span className="font-mono font-bold text-petrikaccentdark">{row.key}</span>
                <span className="text-petriksoft">{row.text}</span>
              </li>
            ))}
          </ol>
        )}
      </Container>
    </section>
  )
}
