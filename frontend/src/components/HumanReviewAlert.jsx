import { ShieldAlert } from "lucide-react";

export default function HumanReviewAlert({ reviewReason }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border-2 border-red-600 bg-red-50 p-4 text-red-900"
    >
      <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
      <div>
        <p className="text-base font-bold">Human Review Required</p>
        {reviewReason ? (
          <p className="mt-1 text-sm text-red-800">{reviewReason}</p>
        ) : null}
      </div>
    </div>
  );
}
