"""Bot privado de Media Maratón.

La idea es hablarle normal, sin comandos. El bot separa dos cosas:

- Datos estructurados (peso, medidas, comidas explícitas): parser determinista.
- Conversación y comidas escritas de forma libre: Qwen2.5-3B local.
- Notas de voz: Whisper local -> mismo camino que el texto.
- Fotos: bucket privado del Supabase self-hosted.

Todo se guarda en el servidor de casa.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"].strip()
ALLOWED_USER_ID = int(os.environ["ALLOWED_USER_ID"])
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()
SUPABASE_USER_ID = os.environ["SUPABASE_USER_ID"].strip()
WHISPER_URL = os.environ.get("WHISPER_URL", "http://127.0.0.1:8001").rstrip("/")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "Systran/faster-whisper-small")
LLM_URL = os.environ.get("LLM_URL", "http://127.0.0.1:8081").rstrip("/")
LLM_MODEL = os.environ.get(
    "LLM_MODEL", "bartowski/Qwen2.5-3B-Instruct-GGUF:Q4_K_M"
)
TTS_URL = os.environ.get("TTS_URL", "http://127.0.0.1:8881").rstrip("/")
TTS_MODEL = os.environ.get("TTS_MODEL", "piper")
TTS_VOICE = os.environ.get("TTS_VOICE", "es_ES-davefx-medium")
TTS_MAX_CHARS = int(os.environ.get("TTS_MAX_CHARS", "2500"))
OFFSET_FILE = os.environ.get("OFFSET_FILE", "/data/offset")
MESSAGE_LOG = os.environ.get("MESSAGE_LOG", "/data/messages.jsonl")
LLM_REPLIES = os.environ.get("LLM_REPLIES", "1").strip().lower() not in {
    "0",
    "false",
    "no",
    "off",
}

PERSONA = (
    "Eres FitGod, el coach personal de Bogdan. Hablas español de España, directo, "
    "cercano, con humor seco y sin rodeos. No eres un asistente genérico: eres su "
    "entrenador y nutricionista de cabecera. Eres crítico cuando hace falta, pero no "
    "condescendiente. No repitas frases hechas ni empieces siempre igual. No inventes "
    "datos ni planes. Si falta información, pide una sola cosa concreta. Tutea siempre; "
    "nunca uses usted. No parafrasees nombres de comidas ni datos: repítelos tal cual. "
    "No inventes comidas, pesos, anécdotas, promesas ni conversaciones pasadas. "
    "No preguntes por comidas si el dato no es una comida. Haz como máximo una pregunta. "
    "Responde en 1-3 frases."
)

TIME_ZONE = ZoneInfo("Europe/Madrid")
TG_API = f"https://api.telegram.org/bot{TOKEN}"
TG_FILE = f"https://api.telegram.org/file/bot{TOKEN}"

session = requests.Session()
session.headers.update({"User-Agent": "media-maraton-bot/3.0"})
history: dict[int, list[dict[str, str]]] = {}


def log(*args: object) -> None:
    print(datetime.now(TIME_ZONE).isoformat(), *args, flush=True)


def tg(method: str, **params: object) -> dict:
    response = session.post(f"{TG_API}/{method}", data=params, timeout=60)
    try:
        return response.json()
    except ValueError:
        return {"ok": False, "description": response.text}


def clean_for_tts(text: str) -> str:
    value = re.sub(r"```.*?```", " ", text, flags=re.S)
    value = re.sub(r"https?://\S+", " ", value)
    value = value.replace("•", ". ").replace("×", " por ")
    value = value.replace("«", "").replace("»", "")
    value = re.sub(r"[*_#>`]", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value[:TTS_MAX_CHARS]


def tts_audio(text: str) -> bytes | None:
    clean = clean_for_tts(text)
    if not clean:
        return None
    try:
        response = session.post(
            f"{TTS_URL}/v1/audio/speech",
            json={
                "model": TTS_MODEL,
                "input": clean,
                "voice": TTS_VOICE,
                "response_format": "mp3",
            },
            timeout=120,
        )
        if response.status_code >= 300:
            log("tts status", response.status_code, response.text[:200])
            return None
        return response.content or None
    except Exception as exc:  # noqa: BLE001
        log("tts error", type(exc).__name__, exc)
        return None


def send_audio(chat_id: int, audio: bytes) -> None:
    try:
        response = session.post(
            f"{TG_API}/sendAudio",
            data={
                "chat_id": str(chat_id),
                "title": "Coach",
                "performer": "Media Maratón",
            },
            files={"audio": ("coach.mp3", audio, "audio/mpeg")},
            timeout=120,
        )
        data = response.json()
        if not data.get("ok"):
            log("sendAudio", data)
    except Exception as exc:  # noqa: BLE001
        log("sendAudio error", type(exc).__name__, exc)


def log_message(chat_id: int, direction: str, text: str) -> None:
    try:
        os.makedirs(os.path.dirname(MESSAGE_LOG), exist_ok=True)
        with open(MESSAGE_LOG, "a", encoding="utf-8") as fh:
            fh.write(
                json.dumps(
                    {
                        "ts": now_iso(),
                        "chat_id": chat_id,
                        "direction": direction,
                        "text": text[:4000],
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    except OSError as exc:
        log("message log error", exc)


def append_history(chat_id: int, role: str, text: str) -> None:
    history.setdefault(chat_id, []).append({"role": role, "content": text[:4000]})
    history[chat_id] = history[chat_id][-12:]


def reply(chat_id: int, text: str) -> None:
    tg("sendMessage", chat_id=chat_id, text=text[:4096], disable_web_page_preview=True)
    log_message(chat_id, "out", text)
    append_history(chat_id, "assistant", text)
    audio = tts_audio(text)
    if audio:
        send_audio(chat_id, audio)


def typing(chat_id: int) -> None:
    tg("sendChatAction", chat_id=chat_id, action="typing")


def now_iso() -> str:
    return datetime.now(TIME_ZONE).isoformat()


def today_iso() -> str:
    return datetime.now(TIME_ZONE).date().isoformat()


def sb_headers(prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def rest_post(
    table: str,
    payload: dict,
    on_conflict: str | None = None,
    prefer: str = "return=representation",
) -> dict:
    params = {"on_conflict": on_conflict} if on_conflict else None
    response = session.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        params=params,
        headers=sb_headers(prefer),
        json=payload,
        timeout=30,
    )
    if response.status_code >= 300:
        raise RuntimeError(f"{table}: {response.status_code} {response.text[:300]}")
    return {"status": response.status_code, "body": response.text}


def rest_get(table: str, params: dict) -> list:
    response = session.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        params=params,
        headers=sb_headers(),
        timeout=20,
    )
    if response.status_code >= 300:
        return []
    try:
        data = response.json()
        return data if isinstance(data, list) else []
    except ValueError:
        return []


def save_metric(values: dict[str, float], measured_on: str | None = None) -> None:
    if "bmr_kcal" in values:
        values["bmr_kcal"] = int(round(values["bmr_kcal"]))
    payload = {
        "user_id": SUPABASE_USER_ID,
        "measured_on": measured_on or today_iso(),
        **values,
    }
    rest_post(
        "body_metrics",
        payload,
        on_conflict="user_id,measured_on",
        prefer="resolution=merge-duplicates,return=representation",
    )


def save_meal(
    description: str,
    calories: int | None = None,
    protein_g: float | None = None,
    carbs_g: float | None = None,
    fat_g: float | None = None,
    eaten_at: str | None = None,
) -> None:
    payload: dict[str, object] = {
        "user_id": SUPABASE_USER_ID,
        "eaten_at": eaten_at or now_iso(),
        "description": description[:500],
        "source": "telegram",
    }
    if calories is not None:
        payload["calories"] = int(round(calories))
    if protein_g is not None:
        payload["protein_g"] = float(protein_g)
    if carbs_g is not None:
        payload["carbs_g"] = float(carbs_g)
    if fat_g is not None:
        payload["fat_g"] = float(fat_g)
    rest_post("meals", payload)


def save_activity(
    steps: int | None = None,
    sleep_hours: float | None = None,
    notes: str | None = None,
    log_date: str | None = None,
) -> None:
    payload: dict[str, object] = {
        "user_id": SUPABASE_USER_ID,
        "log_date": log_date or today_iso(),
    }
    if steps is not None:
        payload["steps"] = int(steps)
    if sleep_hours is not None:
        payload["sleep_hours"] = float(sleep_hours)
    if notes:
        payload["notes"] = notes[:300]
    rest_post(
        "daily_activity",
        payload,
        on_conflict="user_id,log_date",
        prefer="resolution=merge-duplicates,return=representation",
    )


def save_training_session(
    kind: str,
    notes: str,
    duration_min: int | None = None,
    rpe: float | None = None,
    session_date: str | None = None,
) -> None:
    if kind not in {"push", "pull", "legs", "run", "other"}:
        kind = "other"
    payload: dict[str, object] = {
        "user_id": SUPABASE_USER_ID,
        "session_date": session_date or today_iso(),
        "kind": kind,
        "notes": notes[:2000],
        "source": "telegram",
    }
    if duration_min is not None:
        payload["duration_min"] = int(duration_min)
    if rpe is not None:
        payload["rpe"] = float(rpe)
    rest_post("training_sessions", payload)


def upload_photo(file_id: str, view: str, notes: str | None) -> str:
    info = tg("getFile", file_id=file_id)
    if not info.get("ok"):
        raise RuntimeError(f"getFile: {info}")
    file_path = info["result"]["file_path"]
    data = session.get(f"{TG_FILE}/{file_path}", timeout=60)
    data.raise_for_status()

    stamp = datetime.now(TIME_ZONE).strftime("%Y%m%dT%H%M%S")
    storage_path = f"{SUPABASE_USER_ID}/{today_iso()}-{view}-{stamp}.jpg"
    upload = session.post(
        f"{SUPABASE_URL}/storage/v1/object/progress/{storage_path}",
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
        },
        data=data.content,
        timeout=60,
    )
    if upload.status_code >= 300:
        raise RuntimeError(f"storage: {upload.status_code} {upload.text[:300]}")

    rest_post(
        "progress_photos",
        {
            "user_id": SUPABASE_USER_ID,
            "taken_on": today_iso(),
            "view": view,
            "storage_path": storage_path,
            "notes": notes,
        },
    )
    return storage_path


def transcribe(file_id: str) -> str:
    info = tg("getFile", file_id=file_id)
    if not info.get("ok"):
        raise RuntimeError(f"getFile: {info}")
    file_path = info["result"]["file_path"]
    audio = session.get(f"{TG_FILE}/{file_path}", timeout=60)
    audio.raise_for_status()

    response = session.post(
        f"{WHISPER_URL}/v1/audio/transcriptions",
        files={"file": ("audio.oga", audio.content, "audio/ogg")},
        data={"model": WHISPER_MODEL, "language": "es", "response_format": "json"},
        timeout=180,
    )
    if response.status_code >= 300:
        raise RuntimeError(f"whisper: {response.status_code} {response.text[:300]}")
    return (response.json().get("text") or "").strip()


def progress_context() -> str:
    """Resumen compacto para que el LLM responda preguntas de progreso."""
    try:
        metrics = rest_get(
            "body_metrics",
            {
                "select": "measured_on,weight_kg,body_fat_pct,waist_cm",
                "order": "measured_on.desc",
                "limit": "1",
            },
        )
        meals = rest_get(
            "meals",
            {
                "select": "description,calories,eaten_at",
                "order": "eaten_at.desc",
                "limit": "20",
            },
        )
        activity = rest_get(
            "daily_activity",
            {
                "select": "steps,sleep_hours",
                "log_date": "eq." + today_iso(),
                "limit": "1",
            },
        )
        training = rest_get(
            "training_sessions",
            {
                "select": "session_date,kind,notes",
                "order": "session_date.desc",
                "limit": "1",
            },
        )
    except Exception as exc:  # noqa: BLE001
        log("context error", type(exc).__name__, exc)
        return ""

    parts: list[str] = []
    if metrics:
        m = metrics[0]
        bits = []
        if m.get("weight_kg") is not None:
            bits.append(f"peso {m['weight_kg']} kg")
        if m.get("body_fat_pct") is not None:
            bits.append(f"grasa {m['body_fat_pct']} %")
        if m.get("waist_cm") is not None:
            bits.append(f"cintura {m['waist_cm']} cm")
        if bits:
            parts.append(f"Último pesaje ({m.get('measured_on')}): " + ", ".join(bits))
    else:
        parts.append("Sin pesajes todavía")

    today = today_iso()
    todays = [m for m in meals if str(m.get("eaten_at", ""))[:10] == today]
    if todays:
        kcal = sum(int(m.get("calories") or 0) for m in todays)
        parts.append(f"Comidas de hoy: {len(todays)} ({kcal} kcal registradas)")
    else:
        parts.append("Comidas de hoy: ninguna registrada")

    if activity:
        a = activity[0]
        if a.get("steps") is not None:
            parts.append(f"Pasos hoy: {a['steps']}")
        if a.get("sleep_hours") is not None:
            parts.append(f"Sueño: {a['sleep_hours']} h")
    if training:
        t = training[0]
        parts.append(f"Último entreno: {t.get('kind')} ({t.get('session_date')})")

    return " · ".join(parts)


# ---------------------------------------------------------------------------
# Parser determinista de métricas
# ---------------------------------------------------------------------------

METRIC_LABELS = {
    "weight_kg": ("peso", "kg", 1),
    "body_fat_pct": ("grasa", "%", 1),
    "muscle_mass_kg": ("músculo", "kg", 1),
    "water_pct": ("agua", "%", 1),
    "visceral_fat": ("visceral", "", 1),
    "bone_mass_kg": ("masa ósea", "kg", 1),
    "bmr_kcal": ("metabolismo", "kcal", 0),
    "waist_cm": ("cintura", "cm", 1),
    "hip_cm": ("cadera", "cm", 1),
    "chest_cm": ("pecho", "cm", 1),
    "thigh_cm": ("muslo", "cm", 1),
    "arm_cm": ("brazo", "cm", 1),
    "calf_cm": ("gemelo", "cm", 1),
}

METRIC_ALIASES: dict[str, list[str]] = {
    "weight_kg": ["peso", "pesado", "pesé", "pese"],
    "body_fat_pct": ["grasa corporal", "grasa"],
    "muscle_mass_kg": ["masa muscular", "músculo", "musculo"],
    "water_pct": ["agua"],
    "visceral_fat": ["grasa visceral", "visceral"],
    "bone_mass_kg": ["masa ósea", "masa osea", "hueso"],
    "bmr_kcal": ["metabolismo basal", "metabolismo", "bmr"],
    "waist_cm": ["cintura"],
    "hip_cm": ["cadera"],
    "chest_cm": ["pecho"],
    "thigh_cm": ["muslo"],
    "arm_cm": ["brazo"],
    "calf_cm": ["gemelo"],
}

METRIC_RANGES = {
    "weight_kg": (30, 250),
    "body_fat_pct": (3, 60),
    "muscle_mass_kg": (10, 120),
    "water_pct": (20, 75),
    "visceral_fat": (1, 30),
    "bone_mass_kg": (1, 10),
    "bmr_kcal": (800, 5000),
    "waist_cm": (30, 200),
    "hip_cm": (30, 200),
    "chest_cm": (30, 200),
    "thigh_cm": (20, 120),
    "arm_cm": (15, 80),
    "calf_cm": (20, 80),
}

NUMBER = r"([0-9]+(?:[.,][0-9]+)?)"


def parse_number(raw: str) -> float:
    return float(raw.replace(",", "."))


def format_metric(values: dict[str, float]) -> str:
    bits: list[str] = []
    for key, val in values.items():
        label = METRIC_LABELS.get(key)
        if not label:
            continue
        name, unit, digits = label
        text = f"{val:.{digits}f}".replace(".", ",")
        bits.append(f"{name} {text}{(' ' + unit) if unit else ''}")
    return " · ".join(bits)


def parse_metrics(text: str) -> dict[str, float]:
    low = " ".join(text.lower().split())
    values: dict[str, float] = {}

    # Formato "medidas cintura=88 cadera=95".
    if "medidas" in low:
        for name, raw in re.findall(r"([a-záéíóúñ]+)\s*[=:]\s*" + NUMBER, low):
            for column, aliases in METRIC_ALIASES.items():
                if name in aliases:
                    values[column] = parse_number(raw)
                    break

    for column, aliases in METRIC_ALIASES.items():
        if column in values:
            continue
        for alias in sorted(aliases, key=len, reverse=True):
            if column == "body_fat_pct" and alias == "grasa":
                pattern = rf"\bgrasa\b(?!\s+visceral)[^0-9]{{0,20}}{NUMBER}"
            else:
                pattern = rf"\b{re.escape(alias)}\b[^0-9]{{0,20}}{NUMBER}"
            match = re.search(pattern, low)
            if not match:
                continue
            value = parse_number(match.group(1))
            low_bound, high_bound = METRIC_RANGES[column]
            if low_bound <= value <= high_bound:
                values[column] = value
                break

    # "estoy en 82,5 kg" sin la palabra peso.
    if "weight_kg" not in values:
        match = re.search(rf"\b{NUMBER}\s*kg\b", low)
        if match:
            value = parse_number(match.group(1))
            if 30 <= value <= 250:
                values["weight_kg"] = value

    return values


def parse_steps(text: str) -> int | None:
    low = text.lower()
    if "paso" not in low and "step" not in low:
        return None
    match = re.search(r"(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:pasos|paso|steps?)", low)
    if not match:
        return None
    raw = match.group(1)
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", raw):
        raw = re.sub(r"[.,]", "", raw)
    else:
        raw = raw.replace(",", ".")
    try:
        value = int(float(raw))
    except ValueError:
        return None
    return value if 0 <= value <= 100000 else None


# ---------------------------------------------------------------------------
# LLM local: conversación y extracción de comidas libres
# ---------------------------------------------------------------------------

def context_messages(chat_id: int, text: str | None = None) -> list[dict[str, str]]:
    messages = list(history.get(chat_id, [])[-8:])
    if text and (
        not messages
        or messages[-1].get("role") != "user"
        or messages[-1].get("content") != text
    ):
        messages.append({"role": "user", "content": text})
    return messages


def llm_complete(
    system: str,
    chat_id: int,
    text: str | None = None,
    temperature: float = 0.5,
    max_tokens: int = 180,
) -> str | None:
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    messages.extend(context_messages(chat_id, text))
    try:
        response = session.post(
            f"{LLM_URL}/v1/chat/completions",
            json={
                "model": LLM_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=180,
        )
        if response.status_code >= 300:
            log("llm status", response.status_code, response.text[:200])
            return None
        content = response.json()["choices"][0]["message"]["content"] or ""
        return content.strip() or None
    except Exception as exc:  # noqa: BLE001
        log("llm error", type(exc).__name__, exc)
        return None


def llm_chat(chat_id: int, text: str) -> str | None:
    context = progress_context() or "sin datos todavía"
    system = (
        PERSONA
        + " Contexto real: "
        + context
        + ". No inventes cifras ni planes ni des consejos médicos. "
        "Si el usuario dice que se pesará o que entrenará, responde a eso; no digas "
        "que no hay pesajes. Usa 'me enviarás', no 'te enviarás'. No uses la palabra "
        "'dieta' salvo que el usuario la use. Tutea. No supongas que no ha comido; si no "
        "hay comidas registradas, dilo sin inventar. Si el mensaje va de la voz del bot o "
        "de elegir una voz, confirma la elección y no hables de pesajes ni comidas."
    )
    return llm_complete(system, chat_id, text=text, temperature=0.45, max_tokens=220)


def natural_reply(chat_id: int, facts: str, hint: str = "") -> None:
    """Confirmación con voz propia del coach, no una plantilla fija."""
    if not LLM_REPLIES:
        reply(chat_id, facts)
        return
    typing(chat_id)
    context = progress_context() or "sin datos todavía"
    system = (
        PERSONA
        + " Contexto real: "
        + context
        + ". "
        + hint
        + " Acaba de pasar esto: "
        + facts
        + " Responde al usuario confirmando o comentando, en 1-3 frases, con naturalidad, "
        "sin repetir fórmulas ni sonar a plantilla. No inventes datos. No añadas datos "
        "que no estén en 'Acaba de pasar' ni supongas que no ha comido. No inventes "
        "anécdotas ni conversaciones pasadas. Repite los nombres de comida tal cual. "
        "Si falta un dato, pide una sola cosa concreta."
    )
    answer = llm_complete(system, chat_id, temperature=0.35, max_tokens=140)
    if answer:
        reply(chat_id, answer)
    else:
        reply(chat_id, facts)


def progress_reply(chat_id: int) -> None:
    """Datos exactos + un comentario breve del coach."""
    context = progress_context()
    summary = ("Esto es lo que tengo: " + context + ".") if context else "Todavía no tengo datos."
    if not LLM_REPLIES:
        reply(chat_id, summary)
        return
    typing(chat_id)
    system = (
        PERSONA
        + " Basándote solo en este resumen exacto, haz una sola pregunta breve y útil al "
        "usuario. No valores, no inventes tendencias ni cifras y no preguntes por comidas. "
        "Resumen: "
        + summary
    )
    comment = llm_complete(system, chat_id, temperature=0.35, max_tokens=60)
    if comment:
        reply(chat_id, summary + "\n\n" + comment)
    else:
        reply(chat_id, summary)


MEAL_SYSTEM = """Devuelve SOLO un JSON válido, sin markdown ni texto fuera del JSON.
Si el mensaje describe comida o bebida, devuelve:
{"type":"meal","description":"resumen limpio y breve, separando los alimentos con comas; sin 'he desayunado', 'hoy', horas, muletillas ni repeticiones; conserva las marcas si las dice","calories":null,"protein_g":null,"carbs_g":null,"fat_g":null}
Si no describe comida, devuelve:
{"type":"none"}
No inventes calorías ni macros: usa null si el usuario no los dice."""


def clean_meal_description(description: str) -> str:
    text = " ".join(description.strip(" .:-").split())
    text = re.sub(
        r"^(hoy|esta mañana|esta tarde|anoche|ayer)\s*[,:-]?\s*",
        "",
        text,
        flags=re.I,
    )
    text = re.sub(
        r"^(he\s+)?(desayunado|comido|almorzado|cenado|merendado)\s*[,:-]?\s*",
        "",
        text,
        flags=re.I,
    )
    text = re.sub(r"\bun me he tomado\b", "me he tomado", text, flags=re.I)
    text = re.sub(r"\botro me he tomado\b", "me he tomado", text, flags=re.I)
    text = re.sub(r"\bme he tomado\b", "", text, flags=re.I)
    text = re.sub(r"\bhe tomado\b", "", text, flags=re.I)
    text = re.sub(r"\bcon la creatina\b", "con creatina", text, flags=re.I)
    text = re.sub(r"\bleches natada\b", "leche y nata", text, flags=re.I)
    text = re.sub(r"\bmercadona\b", "Mercadona", text, flags=re.I)

    items: list[str] = []
    counts: dict[str, int] = {}
    for part in re.split(r"[,;]+", text):
        item = " ".join(part.strip(" .:-").split())
        item = re.sub(r"^(un|una|unos|unas|otro|otra)\s+", "", item, flags=re.I)
        item = re.sub(r"^(me he tomado|he tomado)\s+", "", item, flags=re.I)
        item = re.sub(r"^(un|una|unos|unas)\s+", "", item, flags=re.I)
        item = item.strip(" .:-")
        if not item:
            continue
        item = item[0].upper() + item[1:]
        key = item.lower()
        if key in counts:
            counts[key] += 1
        else:
            counts[key] = 1
            items.append(item)

    out: list[str] = []
    for item in items:
        times = counts[item.lower()]
        out.append(f"{item} (x{times})" if times > 1 else item)
    return "; ".join(out)


def llm_meal(text: str) -> dict | None:
    try:
        response = session.post(
            f"{LLM_URL}/v1/chat/completions",
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": MEAL_SYSTEM},
                    {"role": "user", "content": text},
                ],
                "temperature": 0,
                "max_tokens": 160,
            },
            timeout=180,
        )
        if response.status_code >= 300:
            log("llm meal status", response.status_code, response.text[:200])
            return None
        content = response.json()["choices"][0]["message"]["content"] or ""
    except Exception as exc:  # noqa: BLE001
        log("llm meal error", type(exc).__name__, exc)
        return None

    content = content.strip()
    content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.I)
    content = re.sub(r"\s*```$", "", content)
    start = content.find("{")
    end = content.rfind("}")
    if start < 0 or end <= start:
        log("llm meal non-json", content[:200])
        return None
    try:
        data = json.loads(content[start : end + 1])
    except ValueError as exc:
        log("llm meal json error", exc, content[:200])
        return None
    if str(data.get("type", "")).lower() != "meal":
        return None

    description = clean_meal_description(str(data.get("description", "")))
    if not description:
        return None

    def num(key: str) -> float | None:
        value = data.get(key)
        if value is None or isinstance(value, bool):
            return None
        try:
            return float(str(value).replace(",", "."))
        except ValueError:
            return None

    return {
        "description": description,
        "calories": num("calories"),
        "protein_g": num("protein_g"),
        "carbs_g": num("carbs_g"),
        "fat_g": num("fat_g"),
    }


# ---------------------------------------------------------------------------
# Enrutado del texto
# ---------------------------------------------------------------------------

GREETINGS = {
    "hola",
    "buenas",
    "hey",
    "buenos dias",
    "buenos días",
    "buenas tardes",
    "buenas noches",
    "que tal",
    "qué tal",
    "hola bot",
}

# El usuario puede contestar a las muestras de voz con "la quinta", "la actual",
# etc. Eso no es una medición ni una comida: se confirma y ya está.
VOICE_CHOICE_HINTS = (
    "la quinta",
    "la ultima",
    "la última",
    "la actual",
    "voz actual",
    "prefiero la actual",
    "prefiero el actual",
    "prefiero al actual",
    "me quedo con la actual",
    "davefx",
)

MEAL_PREFIX = (
    r"(?:(?:hoy|esta mañana|esta tarde|anoche|ayer)\s*[,:-]?\s*)?"
    r"(?:/?(?:comida|he comido|he desayunado|he almorzado|he cenado|he merendado|"
    r"he tomado|desayuno|desayuné|desayune|almuerzo|almorcé|almorce|cena|cené|cene|"
    r"merienda|merendé|merende|snack|comí|comi|tomé|tome))"
)

HELP = """Soy tu bot privado de Media Maratón. No necesitas comandos.

Háblame normal:
• «me he pesado en 82,5»
• «cintura 88, cadera 95 y pecho 100»
• «hoy he desayunado café con leche y dos tostadas»
• «¿cómo voy?»
• Una nota de voz con cualquiera de esas cosas.
• Una foto con el pie de foto: frente, lado o espalda.

Todo va a tu Supabase del servidor de casa. Solo tú puedes usarme."""

QUESTION_STARTS = (
    "que ",
    "qué ",
    "como ",
    "cómo ",
    "cuanto ",
    "cuánto ",
    "cuanta ",
    "cuándo ",
    "cuando ",
    "donde ",
    "dónde ",
    "por que",
    "por qué",
    "puedes ",
    "podrías ",
    "me recomiendas",
    "dime ",
    "qué tal",
    "que tal",
)


def is_question(text: str) -> bool:
    low = text.lower().strip()
    return low.endswith("?") or any(low.startswith(prefix) for prefix in QUESTION_STARTS)


def handle_text_fallback(chat_id: int, text: str, source: str = "text") -> None:
    clean = " ".join(text.strip().split())
    if not clean:
        reply(chat_id, "No he entendido nada. Prueba con /ayuda.")
        return

    normalized = clean.lower().strip(" !¡?¿.")
    if normalized in {"/start", "start", "/ayuda", "ayuda", "help", "/help"}:
        reply(chat_id, HELP)
        return
    if normalized in GREETINGS:
        reply(chat_id, HELP)
        return

    meal_match = re.match(MEAL_PREFIX + r"\s*[:\-]?\s*(.*)$", clean, re.I)
    if meal_match:
        description = clean_meal_description(meal_match.group(1))
        if description:
            try:
                save_meal(description)
                reply(chat_id, f"Comida registrada: «{description[:300]}».")
            except Exception as exc:  # noqa: BLE001
                log("fallback meal", type(exc).__name__, exc)
                reply(chat_id, "No he podido guardar la comida.")
            return

    values = parse_metrics(clean)
    if values:
        try:
            save_metric(values)
            reply(chat_id, "Guardado: " + format_metric(values) + ".")
        except Exception as exc:  # noqa: BLE001
            log("fallback metric", type(exc).__name__, exc)
            reply(chat_id, "No he podido guardar la medición.")
        return

    prefix = "Transcripción: «%s».\n" % clean if source == "voice" else ""
    reply(chat_id, prefix + "No he guardado nada. Dime qué quieres registrar o pregúntame.")


def handle_completed_training(chat_id: int, text: str) -> bool:
    """Sesión ya hecha: guarda el relato tal cual para no perderlo."""
    low = text.lower()
    markers = (
        "he entrenado",
        "he hecho push",
        "he hecho pull",
        "he hecho legs",
        "he hecho piernas",
        "acabo de entrenar",
        "vuelvo del gym",
        "vuelvo del gimnasio",
        "he terminado el entreno",
        "he terminado de entrenar",
        "he corrido",
        "acabo de correr",
        "he salido a correr",
        "sesión de push",
        "sesion de push",
        "sesión de pull",
        "sesion de pull",
        "sesión de legs",
        "sesion de legs",
    )
    if not any(marker in low for marker in markers):
        return False

    if "push" in low:
        kind = "push"
    elif "pull" in low:
        kind = "pull"
    elif "legs" in low or "pierna" in low:
        kind = "legs"
    elif "corrido" in low or "correr" in low or "cinta" in low:
        kind = "run"
    else:
        kind = "other"

    labels = {"push": "push", "pull": "pull", "legs": "legs", "run": "carrera", "other": "entreno"}
    try:
        save_training_session(kind, text)
        detail = (
            "distancia, tiempo, ritmo, pulso y RPE"
            if kind == "run"
            else "ejercicios, series, peso y RPE"
        )
        natural_reply(
            chat_id,
            f"Ha registrado una sesión de {labels[kind]}. Texto: {text[:500]}",
            hint=f"Confirma que lo has guardado. Si encaja, pide un dato que falte: {detail}.",
        )
    except Exception as exc:  # noqa: BLE001
        log("training save error", type(exc).__name__, exc)
        reply(chat_id, "No he podido guardar la sesión. Revisa el log del servidor.")
    return True


def handle_plan_talk(chat_id: int, text: str) -> bool:
    """Charla de planificación: entreno de esta tarde, pesaje de mañana, etc."""
    low = text.lower()

    negative = any(
        key in low
        for key in (
            "no se si entrenar",
            "no sé si entrenar",
            "no voy a entrenar",
            "no entrenar",
            "dudo si entrenar",
            "estoy cansado",
            "estoy reventado",
            "me duele",
            "no me apetece entrenar",
        )
    )
    if negative:
        return False

    training = any(
        key in low
        for key in (
            "voy a entrenar",
            "vaya a entrenar",
            "voy al gym",
            "voy al gimnasio",
            "esta tarde entreno",
            "hoy entreno",
            "voy a hacer push",
            "voy a hacer pull",
            "voy a hacer legs",
            "voy a hacer piernas",
            "haré push",
            "haré pull",
            "haré legs",
            "haré piernas",
            "entrenaré",
        )
    )
    weigh = any(
        key in low
        for key in (
            "mañana me peso",
            "mañana me pesare",
            "mañana me pesaré",
            "mañana por la mañana",
            "mañana en ayunas",
            "después del pesaje",
            "despues del pesaje",
            "mañana te mando las fotos",
            "mañana las fotos",
            "mañana mandaré las fotos",
            "mañana mandare las fotos",
        )
    )

    if training and weigh:
        natural_reply(
            chat_id,
            "Ha dicho que esta tarde probablemente entrenará push o pull y que mañana en "
            "ayunas se pesará y mandará BodyTrax, medidas, fotos y cinta.",
            hint="Confirma el plan y recuérdale que te cuente la sesión al terminar. No le "
            "des instrucciones nuevas.",
        )
        return True

    if training:
        if "push" in low and "pull" in low:
            session = "push o pull"
        elif "push" in low:
            session = "push"
        elif "pull" in low:
            session = "pull"
        elif "legs" in low or "pierna" in low:
            session = "legs"
        else:
            session = "la sesión"
        natural_reply(
            chat_id,
            f"Ha dicho que va a entrenar {session}.",
            hint="Confirma y pídele que al terminar te cuente ejercicios, series, peso y RPE. "
            "No preguntes por comidas.",
        )
        return True

    if weigh:
        natural_reply(
            chat_id,
            "Ha dicho que mañana se pesará en ayunas y te mandará fotos.",
            hint="Confirma y recuérdale BodyTrax, medidas, fotos y cinta. No preguntes por comidas.",
        )
        return True

    return False


def handle_text(chat_id: int, text: str, source: str = "text") -> None:
    clean = " ".join(text.strip().split())
    if not clean:
        reply(chat_id, "No he entendido nada. Prueba con /ayuda.")
        return

    normalized = clean.lower().strip(" !¡?¿.")
    if normalized in {"/start", "start", "/ayuda", "ayuda", "help", "/help"}:
        reply(chat_id, HELP)
        return
    if normalized in GREETINGS:
        reply(chat_id, "Hola. Cuéntame qué has comido, cómo te has pesado o qué quieres saber.")
        return

    voice_text = clean.lower()
    if any(hint in voice_text for hint in VOICE_CHOICE_HINTS):
        reply(chat_id, "Perfecto, me quedo con la voz actual (davefx). No cambio nada.")
        return

    # Comida explícita: "comida ...", "he comido ...", "desayuno ...".
    meal_match = re.match(MEAL_PREFIX + r"\s*[:\-]?\s*(.*)$", clean, re.I)
    if meal_match:
        description = clean_meal_description(meal_match.group(1))
        if not description:
            reply(chat_id, "¿Qué has comido? Dímelo detrás: comida pollo con arroz.")
            return
        try:
            save_meal(description)
            natural_reply(
                chat_id,
                f"Ha registrado la comida: «{description[:300]}».",
                hint="Confirma la comida. No repitas la cantidad si ya está en el texto; "
                "puedes preguntar por los macros o no preguntar nada.",
            )
        except Exception as exc:  # noqa: BLE001
            log("meal save error", type(exc).__name__, exc)
            reply(chat_id, "No he podido guardar la comida.")
        return

    # Métricas: peso, medidas, etc. Esto es determinista y no depende del LLM.
    values = parse_metrics(clean)
    if values:
        try:
            save_metric(values)
            natural_reply(
                chat_id,
                "Ha registrado: " + format_metric(values) + ".",
                hint="Confirma el dato. No preguntes por comidas; puedes preguntar por otro "
                "dato corporal o no preguntar nada.",
            )
        except Exception as exc:  # noqa: BLE001
            log("metric save error", type(exc).__name__, exc)
            reply(chat_id, "No he podido guardar la medición.")
        return

    steps = parse_steps(clean)
    if steps is not None:
        try:
            save_activity(steps=steps)
            natural_reply(
                chat_id,
                f"Ha registrado {steps} pasos hoy.",
                hint="Confirma y comenta algo breve solo si encaja.",
            )
        except Exception as exc:  # noqa: BLE001
            log("steps save error", type(exc).__name__, exc)
            reply(chat_id, "No he podido guardar los pasos.")
        return

    if handle_completed_training(chat_id, clean):
        return

    # Preguntas de progreso: respuesta determinista con los datos reales.
    low = clean.lower()
    progress_phrases = (
        "como voy",
        "cómo voy",
        "como estoy",
        "cómo estoy",
        "mi progreso",
        "mi evolucion",
        "mi evolución",
        "que tal voy",
        "qué tal voy",
        "como va",
        "cómo va",
    )
    if any(phrase in low for phrase in progress_phrases):
        progress_reply(chat_id)
        return

    if handle_plan_talk(chat_id, clean):
        return

    typing(chat_id)

    # Preguntas y conversación: respuesta natural con contexto real.
    if is_question(clean):
        answer = llm_chat(chat_id, clean)
        if answer:
            reply(chat_id, answer)
            return
        handle_text_fallback(chat_id, clean, source)
        return

    # Texto libre: ¿es una comida? El LLM solo extrae; la escritura la hacemos aquí.
    meal = llm_meal(clean)
    if meal:
        try:
            save_meal(
                meal["description"],
                int(round(meal["calories"])) if meal["calories"] is not None else None,
                meal["protein_g"],
                meal["carbs_g"],
                meal["fat_g"],
            )
            extra = (
                f" ({int(round(meal['calories']))} kcal)"
                if meal["calories"] is not None
                else ""
            )
            natural_reply(
                chat_id,
                f"Ha registrado la comida: «{meal['description'][:300]}»{extra}.",
                hint="Confirma la comida. No repitas la cantidad si ya está en el texto; "
                "puedes preguntar por los macros o no preguntar nada.",
            )
            return
        except Exception as exc:  # noqa: BLE001
            log("free meal save error", type(exc).__name__, exc)
            reply(chat_id, "No he podido guardar la comida.")
            return

    # No es comida: respuesta conversacional.
    answer = llm_chat(chat_id, clean)
    if answer:
        reply(chat_id, answer)
        return

    handle_text_fallback(chat_id, clean, source)


def photo_view(caption: str) -> tuple[str, str | None]:
    low = (caption or "").lower()
    if any(word in low for word in ("frente", "frontal", "front")):
        return "front", None
    if any(word in low for word in ("lado", "lateral", "perfil", "side")):
        return "side", None
    if any(word in low for word in ("espalda", "trasera", "back")):
        return "back", None
    return "other", (caption.strip() or None)


def handle_update(update: dict) -> None:
    message = update.get("message") or update.get("edited_message")
    if not message:
        return
    user = message.get("from") or {}
    if user.get("id") != ALLOWED_USER_ID:
        log("ignored user", user.get("id"))
        return

    chat_id = message["chat"]["id"]

    try:
        if "photo" in message:
            photos = sorted(message["photo"], key=lambda p: p.get("file_size", 0))
            file_id = photos[-1]["file_id"]
            caption = message.get("caption", "")
            log_message(chat_id, "in", "[foto] " + (caption or ""))
            append_history(chat_id, "user", "[foto] " + (caption or ""))
            view, notes = photo_view(caption)
            path = upload_photo(file_id, view, notes)
            reply(chat_id, f"Foto guardada: vista {view}. Ruta privada: {path}")
            return

        if "voice" in message or "audio" in message:
            file_id = (message.get("voice") or message.get("audio"))["file_id"]
            text = transcribe(file_id)
            if not text:
                reply(chat_id, "No he podido transcribir el audio.")
                return
            log_message(chat_id, "in", "[voz] " + text)
            append_history(chat_id, "user", "[voz] " + text)
            handle_text(chat_id, text, source="voice")
            return

        if "text" in message:
            log_message(chat_id, "in", message["text"])
            append_history(chat_id, "user", message["text"])
            handle_text(chat_id, message["text"])
    except Exception as exc:  # noqa: BLE001 - el bot no debe morirse por un mensaje
        log("ERROR", type(exc).__name__, exc)
        reply(chat_id, "No he podido guardarlo. Revisa el log del servidor.")


def read_offset() -> int | None:
    try:
        with open(OFFSET_FILE, encoding="utf-8") as fh:
            return int(fh.read().strip())
    except (FileNotFoundError, ValueError):
        return None


def write_offset(offset: int) -> None:
    try:
        os.makedirs(os.path.dirname(OFFSET_FILE), exist_ok=True)
        with open(OFFSET_FILE, "w", encoding="utf-8") as fh:
            fh.write(str(offset))
    except OSError as exc:
        log("offset write failed", exc)


def main() -> None:
    log("bot starting")
    offset = read_offset()
    while True:
        try:
            params: dict[str, object] = {
                "timeout": 30,
                "allowed_updates": json.dumps(["message", "edited_message"]),
            }
            if offset is not None:
                params["offset"] = offset
            response = session.get(f"{TG_API}/getUpdates", params=params, timeout=45)
            data = response.json()
            if not data.get("ok"):
                log("getUpdates", data)
                time.sleep(5)
                continue
            for update in data.get("result", []):
                handle_update(update)
                offset = int(update["update_id"]) + 1
                write_offset(offset)
        except KeyboardInterrupt:
            log("bye")
            return
        except Exception as exc:  # noqa: BLE001
            log("loop error", type(exc).__name__, exc)
            time.sleep(5)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        log("fatal", type(exc).__name__, exc)
        sys.exit(1)

