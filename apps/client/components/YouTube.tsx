'use client'
/**
 * A YouTube video that loads nothing from YouTube until it is played: a thumbnail served by this site (the API
 * fetches it once and stores it under /media/youtube/<id>.jpg) and a play button. Only the click inserts the
 * youtube-nocookie.com player, so no third-party cookie or request happens before the visitor asks for it.
 */
import { useRef, useState } from 'react'

export function YouTube({ id, title, playLabel, className = '' }: { id: string; title: string; playLabel: string; className?: string }) {
  const [playing, setPlaying] = useState(false)
  // No thumbnail (not fetched yet, or YouTube unreachable): the dark box with the play button alone.
  const [thumbnail, setThumbnail] = useState(true)
  const frame = useRef<HTMLIFrameElement>(null)
  if (playing) {
    return (
      <iframe
        ref={frame}
        className={`block size-full border-0 ${className}`}
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        onLoad={() => frame.current?.focus()}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={playLabel}
      className={`group relative block size-full cursor-pointer overflow-hidden bg-petrikink focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-petrikaccent ${className}`}
    >
      {thumbnail && (
        <picture className="contents">
          <source type="image/webp" srcSet={`/media/youtube/${id}.jpg?w=960&f=webp`} />
          <img src={`/media/youtube/${id}.jpg`} alt="" loading="lazy" onError={() => setThumbnail(false)} className="absolute inset-0 size-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
        </picture>
      )}
      <span aria-hidden="true" className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-petrikaccent text-white shadow-lg transition-transform group-hover:scale-110 md:size-20">
        <svg viewBox="0 0 24 24" className="ml-1 size-7 md:size-9" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  )
}
