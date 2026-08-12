import 'react'

declare module 'react' {
  function useRef<T>(initialValue: T | null): React.MutableRefObject<T | null>
}
