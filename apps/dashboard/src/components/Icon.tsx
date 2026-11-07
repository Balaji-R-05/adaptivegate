// Material Symbols Outlined is loaded as a font (index.html) and rendered by
// ligature text, e.g. <Icon name="grid_view" /> — not an npm icon package.
export function Icon({ name, className = 'text-[18px]' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}
