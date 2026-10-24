import {
  AlertTriangle,
  GitCompare,
  HelpCircle,
  PackageX,
  ShieldAlert,
  ShieldOff,
  Tag,
} from "lucide-react";
import EvidenceBlock from "./EvidenceBlock.jsx";
import HumanReviewAlert from "./HumanReviewAlert.jsx";
import UrgencyBadge from "./UrgencyBadge.jsx";

const CATEGORY_META = {
  stockout: { icon: PackageX, label: "Stockout" },
  pricing: { icon: Tag, label: "Pricing" },
  product_quality: { icon: AlertTriangle, label: "Product Quality" },
  data_conflict: { icon: GitCompare, label: "Data Conflict" },
  safety: { icon: ShieldAlert, label: "Safety" },
  prompt_injection: { icon: ShieldOff, label: "Prompt Injection" },
  other: { icon: HelpCircle, label: "Other" },
};

export default function ResultCard({ result, requestId, modelId }) {
  if (!result) return null;

  const meta = CATEGORY_META[result.issue_category] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  const missing = result.missing_information ?? [];

  return (
    <article className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-6 w-6 text-slate-800" />
          <h2 className="text-lg font-semibold text-gray-900">{meta.label}</h2>
        </div>
        <UrgencyBadge urgency={result.urgency} />
      </header>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Recommended Action
        </h3>
        <p className="text-sm leading-6 text-gray-900">{result.recommended_next_action}</p>
      </section>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <EvidenceBlock evidence={result.evidence} />
      </div>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Missing Information
        </h3>
        {missing.length === 0 ? (
          <p className="text-sm text-gray-700">None</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
            {missing.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      {result.needs_human_review ? (
        <HumanReviewAlert reviewReason={result.review_reason} />
      ) : null}

      <footer className="text-xs text-gray-400">
        Request ID: {requestId || "n/a"}
        {modelId ? ` · Model: ${modelId}` : ""}
      </footer>
    </article>
  );
}
