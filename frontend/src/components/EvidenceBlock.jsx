function EvidenceList({ items, emptyLabel, dotClass }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-gray-500 italic">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm text-gray-800">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function EvidenceBlock({ evidence }) {
  const fromField = evidence?.from_field_update ?? [];
  const fromVerified = evidence?.from_verified_data ?? [];

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Evidence Trace
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">From Field Report</h4>
          <EvidenceList
            items={fromField}
            emptyLabel="No field evidence recorded"
            dotClass="bg-blue-600"
          />
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">From Verified Data</h4>
          <EvidenceList
            items={fromVerified}
            emptyLabel="No verified match found"
            dotClass="bg-emerald-600"
          />
        </div>
      </div>
    </section>
  );
}
