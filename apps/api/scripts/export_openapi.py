from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
APP_DIR = ROOT / "apps" / "api"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from app.main import app

OUTPUT = ROOT / "packages" / "api-client" / "openapi.json"


def _strip_generic_object_noise(value):
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if key == "additionalProperties" and item is True and not value.get("properties"):
                continue
            cleaned[key] = _strip_generic_object_noise(item)
        return cleaned
    if isinstance(value, list):
        return [_strip_generic_object_noise(item) for item in value]
    return value


def main() -> None:
    schema = _strip_generic_object_noise(app.openapi())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"OpenAPI exported to {OUTPUT}")


if __name__ == "__main__":
    main()
