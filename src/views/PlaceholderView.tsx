interface PlaceholderViewProps {
  title: string
}

export default function PlaceholderView({ title }: PlaceholderViewProps): JSX.Element {
  return (
    <div className="placeholder-view">
      <h1>{title}</h1>
      <p>This section is planned but not yet implemented.</p>
    </div>
  )
}
