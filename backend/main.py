import logging
import uuid
from copy import deepcopy

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from human_review import apply_human_review_rules
from llm_client import FALLBACK_ANALYSIS, analyze_with_llm, list_model_status, ping_model, resolve_model
from models import AnalyzeRequest, ModelsResponse, SalesAnalysis
from prompt_builder import build_system_prompt, build_user_message
from verified_data import VERIFIED_STOCK

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("saleseasy")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="SalesEasy", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Model-ID"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception:  # noqa: BLE001
        logger.exception("Unhandled error")
        response = JSONResponse(content=deepcopy(FALLBACK_ANALYSIS), status_code=200)
    response.headers["X-Request-ID"] = request_id
    return response


def _safe_analysis(payload: dict) -> dict:
    try:
        return SalesAnalysis.model_validate(payload).model_dump()
    except ValidationError:
        return deepcopy(FALLBACK_ANALYSIS)


@app.post("/analyze")
@limiter.limit("10/minute")
async def analyze(request: Request, body: AnalyzeRequest):
    try:
        selected = resolve_model(body.model)
        system_prompt = build_system_prompt(body.outlet_name, body.sku)
        user_message = build_user_message(body.field_update)
        llm_result = analyze_with_llm(system_prompt, user_message, selected["id"])
        reviewed = apply_human_review_rules(
            llm_result,
            body.field_update,
            body.outlet_name,
            body.sku,
        )
        response = JSONResponse(content=_safe_analysis(reviewed))
        response.headers["X-Model-ID"] = selected["id"]
        return response
    except Exception:  # noqa: BLE001
        logger.exception("Analyze pipeline failed")
        return JSONResponse(content=deepcopy(FALLBACK_ANALYSIS))


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/verified-data")
async def verified_data():
    return VERIFIED_STOCK


@app.get("/models", response_model=ModelsResponse)
async def models_status():
    return list_model_status()


@app.get("/ping-model/{model_id}")
async def ping_model_endpoint(model_id: str):
    return ping_model(model_id)

