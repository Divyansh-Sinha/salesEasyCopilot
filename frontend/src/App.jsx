import { useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle, Check, Globe, RefreshCw, Server, Settings, X } from "lucide-react";
import InputPanel from "./components/InputPanel.jsx";
import ResultCard from "./components/ResultCard.jsx";

function getInitialApiBase() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("saleseasy_api_base");
    if (saved) return saved.replace(/\/$/, "");

    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) return "http://localhost:8000";
  }
  return "";
}

export default function App() {
  const [apiBase, setApiBase] = useState(getInitialApiBase);
  const [showApiModal, setShowApiModal] = useState(false);
  const [inputUrl, setInputUrl] = useState(apiBase);

  const [fieldUpdate, setFieldUpdate] = useState("");
  const [outletName, setOutletName] = useState("");
  const [sku, setSku] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash-lite");
  const [defaultModel, setDefaultModel] = useState("gemini-2.5-flash-lite");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [usedModel, setUsedModel] = useState(null);

  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const isCallingLocalhostOnHttps = isHttps && (!apiBase || apiBase.includes("localhost") || apiBase.includes("127.0.0.1"));

  async function refreshModels(targetBase = apiBase) {
    if (!targetBase) {
      setModelsError("Backend URL is not configured. Click 'Configure API' above.");
      return;
    }
    setModelsLoading(true);
    setModelsError(null);
    try {
      const response = await axios.get(`${targetBase}/models`, { timeout: 15000 });
      const nextModels = response.data.models || [];
      const nextDefault = response.data.default_model || "gemini-2.5-flash-lite";
      setModels(nextModels);
      setDefaultModel(nextDefault);
      setSelectedModel((current) => {
        if (nextModels.some((model) => model.id === current)) return current;
        const firstOnline = nextModels.find((model) => model.online);
        return firstOnline?.id || nextDefault;
      });
    } catch (err) {
      setModelsError(`Could not reach backend at ${targetBase}. Click 'API Settings' to update.`);
    } finally {
      setModelsLoading(false);
    }
  }

  useEffect(() => {
    refreshModels(apiBase);
    const timer = setInterval(() => refreshModels(apiBase), 30000);
    return () => clearInterval(timer);
  }, [apiBase]);

  function handleSaveApiUrl(e) {
    e.preventDefault();
    const cleaned = inputUrl.trim().replace(/\/$/, "");
    setApiBase(cleaned);
    if (typeof window !== "undefined") {
      localStorage.setItem("saleseasy_api_base", cleaned);
    }
    setShowApiModal(false);
    refreshModels(cleaned);
  }

  async function analyze() {
    if (!apiBase) {
      setError("Please configure your backend URL first.");
      setShowApiModal(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${apiBase}/analyze`,
        {
          field_update: fieldUpdate,
          outlet_name: outletName || null,
          sku: sku || null,
          model: selectedModel,
        },
        { timeout: 35000 },
      );
      setResult(response.data);
      setRequestId(response.headers["x-request-id"] || null);
      setUsedModel(response.headers["x-model-id"] || selectedModel);
    } catch (err) {
      setResult(null);
      const message =
        err.response?.data?.detail ||
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
      {/* Top Banner if user is on HTTPS (e.g. Vercel) but connected to localhost */}
      {isCallingLocalhostOnHttps && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-slate-950" />
            <span>
              <strong>Deployed on HTTPS:</strong> Browser will block calls to <code>{apiBase || "localhost:8000"}</code>. Please connect your deployed Render backend URL.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setInputUrl(apiBase || "https://");
              setShowApiModal(true);
            }}
            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
          >
            Connect Render Backend URL
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[#0b1f3a] px-6 py-4 text-white">
        <div>
          <h1 className="text-xl font-bold tracking-tight">⚡ SalesEasy</h1>
          <p className="text-xs text-slate-200">FMCG Field Sales Copilot</p>
        </div>

        {/* Backend Connection Indicator & Modal Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setInputUrl(apiBase || "http://localhost:8000");
              setShowApiModal(true);
            }}
            title="Click to view or change backend API URL"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <Server className="h-3.5 w-3.5 text-indigo-400" />
            <span className="font-mono text-[11px] max-w-[200px] truncate">
              {apiBase ? apiBase.replace(/^https?:\/\//, "") : "Set Backend URL"}
            </span>
            <Settings className="h-3 w-3 text-slate-400" />
          </button>
        </div>
      </header>

      {/* API Configuration Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Globe className="h-5 w-5 text-indigo-600" />
                Backend API URL Configuration
              </h3>
              <button
                type="button"
                onClick={() => setShowApiModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-600">
              Enter your live backend URL (e.g. <code>https://saleseasy-backend.onrender.com</code>) or keep <code>http://localhost:8000</code> for local testing.
            </p>
            <form onSubmit={handleSaveApiUrl} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Backend API Endpoint
                </label>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://your-service.onrender.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApiModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-[#0b1f3a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save &amp; Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Container */}
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
            onRefreshModels={() => refreshModels(apiBase)}
            apiBase={apiBase}
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
