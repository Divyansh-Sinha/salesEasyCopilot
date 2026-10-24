import { Loader2 } from "lucide-react";
import ModelSelector from "./ModelSelector.jsx";
import ScenarioSelector from "./ScenarioSelector.jsx";

const MAX_LENGTH = 2000;

export default function InputPanel({
  fieldUpdate,
  outletName,
  sku,
  loading,
  selectedScenarioId,
  onFieldUpdateChange,
  onOutletNameChange,
  onSkuChange,
  onScenarioSelect,
  onSubmit,
  models,
  selectedModel,
  defaultModel,
  modelsLoading,
  modelsError,
  onModelSelect,
  onRefreshModels,
  apiBase,
}) {
  const remaining = MAX_LENGTH - (fieldUpdate?.length || 0);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <ScenarioSelector selectedId={selectedScenarioId} onSelect={onScenarioSelect} />

      <ModelSelector
        models={models}
        selectedModel={selectedModel}
        defaultModel={defaultModel}
        loading={modelsLoading}
        error={modelsError}
        onSelect={onModelSelect}
        onRefresh={onRefreshModels}
        apiBase={apiBase}
      />

      <div>
        <label htmlFor="field-update" className="mb-1 block text-sm font-medium text-gray-700">
          Field Update
        </label>
        <textarea
          id="field-update"
          value={fieldUpdate}
          maxLength={MAX_LENGTH}
          onChange={(event) => onFieldUpdateChange(event.target.value)}
          placeholder="Enter the sales rep's field report..."
          rows={8}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-amber-700">Field updates are treated as untrusted input.</p>
          <p className={`text-xs ${remaining < 100 ? "text-red-600" : "text-gray-500"}`}>
            {fieldUpdate.length}/{MAX_LENGTH}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="outlet-name" className="mb-1 block text-sm font-medium text-gray-700">
          Outlet Name (optional)
        </label>
        <input
          id="outlet-name"
          type="text"
          value={outletName}
          onChange={(event) => onOutletNameChange(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
        />
      </div>

      <div>
        <label htmlFor="sku" className="mb-1 block text-sm font-medium text-gray-700">
          SKU (optional)
        </label>
        <input
          id="sku"
          type="text"
          value={sku}
          onChange={(event) => onSkuChange(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !fieldUpdate.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0b1f3a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123056] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Analyze Update
      </button>
    </form>
  );
}
