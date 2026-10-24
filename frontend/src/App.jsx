import { useEffect, useState } from "react";
import axios from "axios";
import InputPanel from "./components/InputPanel.jsx";
import ResultCard from "./components/ResultCard.jsx";

const API_BASE = "http://localhost:8000";

export default function App() {
  const [fieldUpdate, setFieldUpdate] = useState("");
  const [outletName, setOutletName] = useState("");
  const [sku, setSku] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [defaultModel, setDefaultModel] = useState("gemini-2.5-flash");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [usedModel, setUsedModel] = useState(null);

  async function refreshModels() {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const response = await axios.get(`${API_BASE}/models`, { timeout: 15000 });
      const nextModels = response.data.models || [];
      const nextDefault = response.data.default_model || "gemini-2.5-flash";
      setModels(nextModels);
      setDefaultModel(nextDefault);
      setSelectedModel((current) => {
        if (nextModels.some((model) => model.id === current)) return current;
        const firstOnline = nextModels.find((model) => model.online);
        return firstOnline?.id || nextDefault;
      });
    } catch (err) {
      setModelsError("Could not check model status. Retry to refresh.");
    } finally {
      setModelsLoading(false);
    }
  }

  useEffect(() => {
    refreshModels();
    const timer = setInterval(refreshModels, 30000);
    return () => clearInterval(timer);
  }, []);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/analyze`,
        {
          field_update: fieldUpdate,
          outlet_name: outletName || null,
          sku: sku || null,
          model: selectedModel,
        },
        { timeout: 30000 },
      );
      setResult(response.data);
      setRequestId(response.headers["x-request-id"] || null);
      setUsedModel(response.headers["x-model-id"] || selectedModel);
    } catch (err) {
      setResult(null);
      const message =
        err.response?.data?.error ||
        err.message ||
        "Unable to analyze this field update.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    analyze();
  }

  function handleScenarioSelect(scenario) {
    setSelectedScenarioId(scenario.id);
    setFieldUpdate(scenario.field_update);
    setOutletName(scenario.outlet);
    setSku(scenario.sku);
    setError(null);
    setResult(null);
    setRequestId(null);
    setUsedModel(null);
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex items-center justify-between bg-[#0b1f3a] px-6 py-4 text-white">
        <h1 className="text-xl font-bold tracking-tight">⚡ SalesEasy</h1>
        <p className="text-sm text-slate-200">FMCG Field Sales Copilot</p>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Input</h2>
          <InputPanel
            fieldUpdate={fieldUpdate}
            outletName={outletName}
            sku={sku}
            loading={loading}
            selectedScenarioId={selectedScenarioId}
            onFieldUpdateChange={setFieldUpdate}
            onOutletNameChange={setOutletName}
            onSkuChange={setSku}
            onScenarioSelect={handleScenarioSelect}
            onSubmit={handleSubmit}
            models={models}
            selectedModel={selectedModel}
            defaultModel={defaultModel}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            onModelSelect={setSelectedModel}
            onRefreshModels={refreshModels}
            apiBase={API_BASE}
          />
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Result</h2>
          {error ? (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={analyze}
                className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-gray-500">Analyzing field update…</p>
          ) : null}

          {!loading && !result && !error ? (
            <p className="text-sm text-gray-500">
              Submit a field update to see classification, evidence, and next actions.
            </p>
          ) : null}

          <ResultCard result={result} requestId={requestId} modelId={usedModel} />
        </section>
      </main>
    </div>
  );
}
