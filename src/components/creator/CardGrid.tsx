import { Container } from "./Container";
import { useLang } from "../../i18n/languageContext";
import { DateTag } from "./DateTag";
import { cx, linkProps } from "./utils";

export type CardGridTextItem = {
  title: string;
  text?: string;
  eyebrow?: string;
  date?: string;
  href?: string;
  linkLabel?: string;
};

export type CardGridPersonItem = {
  name: string;
  role?: string;
  room?: string;
  phone?: string;
  email?: string;
  photo?: string;
};

export type CardGridStatItem = { value: string; label: string };

export type CardGridNewsItem = {
  title: string;
  date: string;
  image?: { src: string; alt: string };
  href: string;
};

export type CardGridProps =
  | { variant: "text"; columns?: 2 | 3 | 4; heading?: string; items: CardGridTextItem[]; className?: string; limit?: number }
  | { variant: "person"; columns?: 2 | 3 | 4; heading?: string; items: CardGridPersonItem[]; className?: string; limit?: number }
  | { variant: "stat"; columns?: 3 | 4; items: CardGridStatItem[]; className?: string; limit?: number }
  | { variant: "news"; columns?: 3 | 4; items: CardGridNewsItem[]; className?: string; limit?: number }
  | { variant: "highlight"; title?: string; text: string; className?: string };

/* A teljes osztálynevek szándékosan szerepelnek, hogy a Tailwind felismerje őket. */
const COLUMNS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
};

const CARD = "relative rounded-lg border border-petriklinesoft bg-petrikcard";
/* Kattintható kártya: a link ::after rétege lefedi az egész kártyát. */
const STRETCH = "after:absolute after:inset-0 after:content-['']";
const CARD_FOCUS = "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-petrikaccent";

/** Az első `limit` elemet jeleníti meg; nélküle az összeset. */
function take<T>(items: T[], limit?: number): T[] {
  return limit === undefined ? items : items.slice(0, Math.max(0, limit));
}

export function CardGrid(props: CardGridProps) {
  const { className } = props;

  if (props.variant === "highlight") {
    return (
      <section data-component="CardGrid" data-variant="highlight" className={cx("py-14 md:py-16", className)}>
        <Container>
          <div className="rounded-r-lg border-l-4 border-petrikaccent bg-petriktint px-6 py-5">
            {props.title && <p className="petrik-eyebrow mb-2">{props.title}</p>}
            <p className="max-w-[72ch] text-[15.5px] leading-relaxed text-petrikink">{props.text}</p>
          </div>
        </Container>
      </section>
    );
  }

  const columns = props.columns ?? (props.variant === "stat" ? 4 : 3);
  const heading = props.variant === "text" || props.variant === "person" ? props.heading : undefined;

  return (
    <section data-component="CardGrid" data-variant={props.variant} className={cx("py-14 md:py-16", className)}>
      <Container>
        {heading && <h2 className="mb-6 font-display text-2xl font-bold text-balance">{heading}</h2>}
        <ul className={cx("grid gap-4", props.variant === "stat" && "gap-y-8", COLUMNS[columns])}>
          {props.variant === "text" && take(props.items, props.limit).map((item, i) => <TextCard key={i} item={item} />)}
          {props.variant === "person" && take(props.items, props.limit).map((item, i) => <PersonCard key={i} item={item} />)}
          {props.variant === "stat" && take(props.items, props.limit).map((item, i) => <StatCard key={i} item={item} />)}
          {props.variant === "news" && take(props.items, props.limit).map((item, i) => <NewsCard key={i} item={item} />)}
        </ul>
      </Container>
    </section>
  );
}

function TextCard({ item }: { item: CardGridTextItem }) {
  const { tr } = useLang();
  const { title, text, eyebrow, date, href, linkLabel } = item;
  return (
    <li className="flex">
      <article
        className={cx(
          CARD,
          "flex w-full flex-col items-start p-[22px]",
          href && cx("motion-safe:transition-shadow hover:shadow-md", CARD_FOCUS),
        )}
      >
        {date && <DateTag date={date} className="mb-3" />}
        {eyebrow && <p className="petrik-eyebrow mb-2">{eyebrow}</p>}
        <h3 className="font-display text-[17px] font-bold leading-snug">{title}</h3>
        {text && <p className="mt-2 whitespace-pre-line text-sm leading-[1.55] text-petriksoft">{text}</p>}
        {href && (
          <a
            href={href}
            {...linkProps(href)}
            className={cx("petrik-eyebrow mt-auto pt-4 font-medium hover:underline", STRETCH)}
          >
            {linkLabel ?? tr("RÉSZLETEK →")}
          </a>
        )}
      </article>
    </li>
  );
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function PersonCard({ item }: { item: CardGridPersonItem }) {
  const { tr } = useLang();
  const { name, role, room, phone, email, photo } = item;
  return (
    <li className="flex">
      <article className={cx(CARD, "flex w-full items-start gap-4 p-[22px]")}>
        {photo ? (
          <img src={photo} alt={`${name} ${tr("fényképe")}`} className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-petriktint font-mono text-sm font-medium text-petrikaccentdark"
          >
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
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                  {phone}
                </a>
              </p>
            )}
            {email && (
              <p className="break-words">
                <a href={`mailto:${email}`} className="hover:underline">
                  {email}
                </a>
              </p>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}

function StatCard({ item }: { item: CardGridStatItem }) {
  return (
    <li>
      <p className="font-display text-[40px] font-bold leading-none text-petrikaccentdark md:text-[42px]">
        {item.value}
      </p>
      <p className="mt-2 font-mono text-[11.5px] uppercase tracking-[0.08em] text-petrikfaint">{item.label}</p>
    </li>
  );
}

function NewsCard({ item }: { item: CardGridNewsItem }) {
  const { title, date, image, href } = item;
  return (
    <li className="flex">
      <article
        className={cx(
          CARD,
          "group w-full overflow-hidden motion-safe:transition motion-safe:hover:-translate-y-0.5 hover:shadow-md",
          CARD_FOCUS,
        )}
      >
        <div className="relative aspect-[16/10] w-full">
          {image ? (
            <img src={image.src} alt={image.alt} className="size-full object-cover" />
          ) : (
            <div aria-hidden="true" className="petrik-stripes size-full" />
          )}
          <DateTag date={date} className="absolute top-3 left-3" />
        </div>
        <h3 className="p-[18px] font-display text-[15.5px] font-semibold leading-snug sm:text-base">
          <a href={href} {...linkProps(href)} className={cx("hover:underline", STRETCH)}>
            {title}
          </a>
        </h3>
      </article>
    </li>
  );
}
