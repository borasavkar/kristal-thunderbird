# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""Builds the Kristal Colors theme package (colors only, no code).

Kullanım:  python theme/build.py
Çıktı:     dist/kristal-renkleri-<sürüm>.xpi
"""

import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = ROOT / "src"
DIST = ROOT.parent / "dist"


def main():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    DIST.mkdir(exist_ok=True)
    target = DIST / f"kristal-renkleri-{manifest['version']}.xpi"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as xpi:
        for path in sorted(SOURCE.rglob("*")):
            if path.is_file():
                xpi.write(path, path.relative_to(SOURCE).as_posix())
    print(target)


if __name__ == "__main__":
    main()
