export function Badge({ variant, children }: { variant: string; children: React.ReactNode }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
