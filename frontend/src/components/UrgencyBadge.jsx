const URGENCY_CLASSES = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-gray-900",
  low: "bg-green-500 text-white",
};

export default function UrgencyBadge({ urgency }) {
  const colorClass = URGENCY_CLASSES[urgency] ?? "bg-gray-400 text-white";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide ${colorClass}`}
    >
      {(urgency || "unknown").toUpperCase()}
    </span>
  );
}
