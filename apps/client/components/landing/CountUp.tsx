'use client'
import { useEffect, useState } from 'react'

/** Counts from 0 to `to` after the hero animation (instantly with reduced motion). */
export function CountUp({ to, prefix, suffix }: { to: number; prefix: string; suffix: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = reduce ? 0 : 1400
    const dur = reduce ? 1 : 1800
    let raf = 0
    const t0 = performance.now() + delay
    const tick = (t: number) => {
      const p = Math.min(Math.max((t - t0) / dur, 0), 1)
      setN(Math.round(to * (1 - Math.pow(1 - p, 4))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return (
    <>
      {prefix}
      {n}
      {suffix}
    </>
  )
}
