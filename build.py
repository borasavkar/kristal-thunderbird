# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""Kristal eklenti paketini (XPI) oluşturur.

Kullanım:  python build.py
Çıktı:     dist/kristal-<sürüm>.xpi

XPI bir ZIP dosyasıdır; Thunderbird içindeki yolların "/" ile yazılmasını
ister. Bu yüzden PowerShell'in Compress-Archive komutu yerine bu betik
kullanılır.
"""

import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = ROOT / "src"
DIST = ROOT / "dist"


def main():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    DIST.mkdir(exist_ok=True)
    target = DIST / f"kristal-{manifest['version']}.xpi"
    try:
        xpi = zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED)
    except OSError:
        # Thunderbird keeps an XPI it installed from this folder open, so the
        # same file cannot be overwritten. A new version number gives a new file.
        raise SystemExit(
            f"{target.name} kullanımda (Thunderbird bu dosyayı açık tutuyor olabilir). "
            "src/manifest.json içindeki sürümü yükseltip yeniden deneyin."
        )
    with xpi:
        for path in sorted(SOURCE.rglob("*")):
            if path.is_file():
                xpi.write(path, path.relative_to(SOURCE).as_posix())
    print(target)


if __name__ == "__main__":
    main()
