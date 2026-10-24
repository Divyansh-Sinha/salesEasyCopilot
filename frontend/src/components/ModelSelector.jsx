import { useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";

export default function ModelSelector({
  models,
  selectedModel,
  defaultModel,
  loading,
  error,
  onSelect,
  onRefresh,
  apiBase = "http://localhost:8000",
}) {
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const activeModel =
    models.find((m) => m.id === selectedModel) ||
    models.find((m) => m.id === defaultModel) ||
    (models.length > 0 ? models[0] : null);

  async function handlePing() {
    if (!selectedModel || !apiBase) return;
    setPinging(true);
    setPingResult(null);
    try {
      const res = await axios.get(`${apiBase}/ping-model/${selectedModel}`, {
        timeout: 15000,
      });
      setPingResult(res.data);
    } catch (err) {
      setPingResult({
        online: false,
        status_reason: err.response?.data?.detail || err.message || "Ping failed",
      });
    } finally {
      setPinging(false);
    }
  }

  function handleModelChange(modelId) {
    onSelect(modelId);
    setPingResult(null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <label
          htmlFor="model-select"
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700"
        >
          <Cpu className="h-4 w-4 text-indigo-600" />
          AI Model &amp; Status
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePing}
            disabled={pinging || !activeModel?.online}
            title={activeModel?.online ? "Send a live ping to verify responsiveness" : "Model is currently offline"}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pinging ? (
              <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
            ) : (
              <Zap className="h-3 w-3 text-amber-500" />
            )}
            <span>{pinging ? "Testing..." : "Ping Model"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPingResult(null);
              onRefresh();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
            ) : (
              <RefreshCw className="h-3 w-3 text-slate-500" />
            )}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pr-8 pl-3 text-sm font-medium text-slate-900 shadow-xs transition-colors hover:border-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
        >
          {(models.length
            ? models
            : [{ id: defaultModel, label: defaultModel, online: false }]
          ).map((m) => (
            <option key={m.id} value={m.id}>
              {m.online ? "● " : "○ "} {m.label} ({m.provider?.toUpperCase()}) — {m.online ? "Online" : "Offline"}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {error ? (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Active Model Status Card */}
      {activeModel ? (
        <div className="mt-3 rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {activeModel.online ? (
                  <>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                )}
              </span>
              <span className="font-semibold text-slate-800">
                {activeModel.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 uppercase">
                {activeModel.provider}
              </span>
            </div>

            <span
              className={`font-semibold ${
                activeModel.online ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {activeModel.online ? "Online & Ready" : "Offline"}
            </span>
          </div>

          {!activeModel.online && activeModel.status_reason ? (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Reason: <span className="text-rose-700">{activeModel.status_reason}</span>
            </p>
          ) : null}

          {/* Live Ping Test Feedback */}
          {pingResult ? (
            <div
              className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium ${
                pingResult.online
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {pingResult.online ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    Verified live: responded in{" "}
                    <strong>{pingResult.latency_ms}ms</strong>
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span>
                    Ping check failed:{" "}
                    {pingResult.status_reason || "Unresponsive"}
                  </span>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
