export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="mb-8">
      {eyebrow ? <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p> : null}
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">{subtitle}</p> : null}
    </section>
  );
}
