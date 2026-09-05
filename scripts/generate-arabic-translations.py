import json
import sys
from pathlib import Path

from argostranslate import package, translate


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: generate-arabic-translations.py AUDIT_FILE OUTPUT_JSON")

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    strings = sorted({
        line.strip()
        for line in source_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("# ") and any(character.isalpha() for character in line)
    })

    package.update_package_index()
    installed = translate.get_installed_languages()
    english = next((language for language in installed if language.code == "en"), None)
    arabic = next((language for language in installed if language.code == "ar"), None)
    if not english or not arabic:
        available = package.get_available_packages()
        model = next(item for item in available if item.from_code == "en" and item.to_code == "ar")
        package.install_from_path(model.download())

    existing = json.loads(output_path.read_text(encoding="utf-8")) if output_path.exists() else {}
    translations = {source: existing[source] for source in strings if source in existing}
    pending = [source for source in strings if source not in translations]
    for index, source in enumerate(pending, start=1):
        translations[source] = translate.translate(source, "en", "ar")
        if index % 100 == 0:
            print(f"translated {index}/{len(pending)}", flush=True)

    output_path.write_text(json.dumps(translations, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {len(translations)} translations to {output_path} ({len(pending)} new)")


if __name__ == "__main__":
    main()
