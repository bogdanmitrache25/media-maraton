"""Bot privado de Media Maratón.

Recibe texto, notas de voz y fotos por Telegram y escribe en el Supabase
self-hosted del servidor de casa. Solo atiende al usuario autorizado.
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
OFFSET_FILE = os.environ.get("OFFSET_FILE", "/data/offset")

TIME_ZONE = ZoneInfo("Europe/Madrid")
TG_API = f"https://api.telegram.org/bot{TOKEN}"
TG_FILE = f"https://api.telegram.org/file/bot{TOKEN}"

session = requests.Session()
session.headers.update({"User-Agent": "media-maraton-bot/1.0"})


def log(*args: object) -> None:
    print(datetime.now(TIME_ZONE).isoformat(), *args, flush=True)


def tg(method: str, **params: object) -> dict:
    response = session.post(f"{TG_API}/{method}", data=params, timeout=60)
    try:
        return response.json()
    except ValueError:
        return {"ok": False, "description": response.text}


def reply(chat_id: int, text: str) -> None:
    tg("sendMessage", chat_id=chat_id, text=text, disable_web_page_preview=True)


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


def save_metric(values: dict[str, float]) -> None:
    if "bmr_kcal" in values:
        values["bmr_kcal"] = int(round(values["bmr_kcal"]))
    payload = {
        "user_id": SUPABASE_USER_ID,
        "measured_on": today_iso(),
        **values,
    }
    rest_post(
        "body_metrics",
        payload,
        on_conflict="user_id,measured_on",
        prefer="resolution=merge-duplicates,return=representation",
    )


def save_meal(description: str) -> None:
    payload = {
        "user_id": SUPABASE_USER_ID,
        "eaten_at": datetime.now(TIME_ZONE).isoformat(),
        "description": description[:500],
        "source": "telegram",
    }
    rest_post("meals", payload)


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


NUMBER = r"([0-9]+(?:[.,][0-9]+)?)"
METRICS: dict[str, str] = {
    "peso": "weight_kg",
    "grasa": "body_fat_pct",
    "musculo": "muscle_mass_kg",
    "músculo": "muscle_mass_kg",
    "agua": "water_pct",
    "visceral": "visceral_fat",
    "hueso": "bone_mass_kg",
    "metabolismo": "bmr_kcal",
    "cintura": "waist_cm",
    "cadera": "hip_cm",
    "pecho": "chest_cm",
    "muslo": "thigh_cm",
    "brazo": "arm_cm",
    "gemelo": "calf_cm",
}

HELP = """Soy tu bot privado de Media Maratón.

Puedes escribirme:
• peso 82,5
• grasa 18,4
• medidas cintura=88 cadera=95 pecho=100
• comida pollo con arroz y ensalada
• Una nota de voz con cualquiera de esas cosas.
• Una foto con el pie de foto: frente, lado o espalda.

Los datos van a tu Supabase del servidor de casa. Solo tú puedes usarme."""


def parse_number(raw: str) -> float:
    return float(raw.replace(",", "."))


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

MEAL_PREFIX = (
    r"(?:/?(?:comida|he comido|desayuno|desayuné|desayune|almuerzo|almorcé|almorce|"
    r"cena|cené|cene|merienda|merendé|merende|snack|comí|comi))"
)


def handle_text(chat_id: int, text: str, source: str = "text") -> None:
    clean = " ".join(text.strip().split())
    low = clean.lower()

    if not clean:
        reply(chat_id, "No he entendido nada. Prueba con /ayuda.")
        return

    normalized = low.strip(" !¡?¿.")

    if normalized in {"/start", "start", "/ayuda", "ayuda", "help", "/help"}:
        reply(chat_id, HELP)
        return

    if normalized in GREETINGS:
        reply(
            chat_id,
            "Hola. Estoy listo. Para registrar:\n"
            "• peso 82,5\n"
            "• comida pollo con arroz\n"
            "• medidas cintura=88 cadera=95\n"
            "• /ayuda",
        )
        return

    # Medidas en bloque: "medidas cintura=88 cadera=95 ..."
    if low.startswith(("medidas", "/medidas")):
        pairs = re.findall(r"([a-záéíóúñ]+)\s*[=:]\s*" + NUMBER, low)
        values: dict[str, float] = {}
        labels: list[str] = []
        for name, raw in pairs:
            column = METRICS.get(name)
            if column:
                values[column] = parse_number(raw)
                labels.append(f"{name} {raw.replace('.', ',')}")
        if not values:
            reply(chat_id, "No he encontrado medidas. Ejemplo: medidas cintura=88 cadera=95")
            return
        save_metric(values)
        reply(chat_id, "Medidas guardadas: " + " · ".join(labels))
        return

    # Comida explícita: "comida ...", "he comido ...", "desayuno ...", etc.
    meal_match = re.match(MEAL_PREFIX + r"\s*[:\-]?\s*(.*)$", clean, re.I)
    if meal_match:
        description = meal_match.group(1).strip(" .:-")
        if not description:
            reply(chat_id, "¿Qué has comido? Escríbelo detrás: comida pollo con arroz.")
            return
        save_meal(description)
        reply(chat_id, f"Comida registrada: «{description[:300]}».")
        return

    # Métrica simple: "peso 82,5", "/grasa 18", etc.
    for name, column in METRICS.items():
        match = re.search(rf"\b{re.escape(name)}\b[^0-9]{{0,6}}{NUMBER}", low)
        if match:
            value = parse_number(match.group(1))
            save_metric({column: value})
            reply(chat_id, f"Guardado: {name} {match.group(1).replace('.', ',')} (hoy).")
            return

    # Si no es nada claro, no inventamos: pedimos la intención explícita.
    prefix = "Transcripción: «%s».\n" % clean if source == "voice" else ""
    reply(
        chat_id,
        prefix + "No he guardado nada. Para comida: «comida pollo con arroz». "
        "Para medidas: «peso 82,5». /ayuda",
    )


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
            view, notes = photo_view(message.get("caption", ""))
            path = upload_photo(file_id, view, notes)
            reply(chat_id, f"Foto guardada: vista {view}. Ruta privada: {path}")
            return

        if "voice" in message or "audio" in message:
            file_id = (message.get("voice") or message.get("audio"))["file_id"]
            text = transcribe(file_id)
            if not text:
                reply(chat_id, "No he podido transcribir el audio.")
                return
            handle_text(chat_id, text, source="voice")
            return

        if "text" in message:
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
            params: dict[str, object] = {"timeout": 30, "allowed_updates": json.dumps(["message", "edited_message"])}
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
