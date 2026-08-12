import React from 'react'

export function AsteryonMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ASTERYON"
      role="img"
    >
      <path d="M32 4L39.8 22.2L60 24L44.6 37.2L49.2 57L32 46.4L14.8 57L19.4 37.2L4 24L24.2 22.2L32 4Z" fill="currentColor" opacity="0.16" />
      <path d="M32 8L52 54H42.8L38.7 44H25.3L21.2 54H12L32 8ZM28.4 36.4H35.6L32 27.7L28.4 36.4Z" fill="currentColor" />
      <path d="M32 3L34.8 10.2L42 13L34.8 15.8L32 23L29.2 15.8L22 13L29.2 10.2L32 3Z" fill="currentColor" />
    </svg>
  )
}
