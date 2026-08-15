export default function SpecTable({
  specs,
  title,
}: {
  specs: Record<string, string>;
  title?: string;
}) {
  const entries = Object.entries(specs);
  if (entries.length === 0) return null;

  return (
    <div>
      {title && (
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">{title}</h3>
      )}
      <div className="border border-border-base rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {entries.map(([key, value], i) => (
              <tr key={key} className={i % 2 === 1 ? "bg-surface-alt" : "bg-surface"}>
                <th scope="row" className="text-left font-semibold text-slate-900 align-top px-4 py-3 w-2/5">
                  {key}
                </th>
                <td className="text-slate-600 px-4 py-3">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
