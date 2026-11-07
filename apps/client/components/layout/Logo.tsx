/** The school logo: a small palette PNG at 1x / 2x (the original was a 175 KB PNG). */
export function Logo({ className, alt }: { className?: string; alt: string }) {
  return <img src="/img/logo-208.png" srcSet="/img/logo-208.png 1x, /img/logo-416.png 2x" width={208} height={44} alt={alt} className={className} />
}
