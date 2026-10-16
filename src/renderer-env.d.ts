declare module '*.css'

declare module '*.md?raw' {
  const source: string
  export default source
}

declare namespace JSX {
  type Element = import('react').JSX.Element
}