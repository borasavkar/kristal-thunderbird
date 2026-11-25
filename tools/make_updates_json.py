# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""Writes updates.json for Thunderbird's automatic add-on updates.

Kullanım:  python tools/make_updates_json.py

Run after `python build.py`. Every XPI in dist/ that has a matching GitHub
release (tag v<version>) is listed, with its SHA-256 hash, so Thunderbird
can update installed copies of Kristal from GitHub on its own.
"""

import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ADDON_ID = "kristal@borasavkar.github.io"
REPO = "borasavkar/kristal-thunderbird"
FIRST_SELF_HOSTED = (1, 0, 8)


def main():
    manifest = json.loads((ROOT / "src" / "manifest.json").read_text(encoding="utf-8"))
    gecko = manifest["browser_specific_settings"]["gecko"]
    # Since 1.0.11 there is no strict_max_version: Kristal keeps running after
    # Thunderbird updates instead of being disabled as incompatible.
    app_versions = {k: gecko[k] for k in ("strict_min_version", "strict_max_version") if k in gecko}
    updates = []
    for xpi in sorted((ROOT / "dist").glob("kristal-*.xpi")):
        # Only the add-on (kristal-1.2.3.xpi), not the theme (kristal-renkleri-…).
        match = re.match(r"kristal-(\d+(?:\.\d+)*)\.xpi$", xpi.name)
        if not match:
            continue
        version = match.group(1)
        if tuple(int(p) for p in version.split(".")) < FIRST_SELF_HOSTED:
            continue
        updates.append({
            "version": version,
            "update_link": f"https://github.com/{REPO}/releases/download/v{version}/{xpi.name}",
            "update_hash": "sha256:" + hashlib.sha256(xpi.read_bytes()).hexdigest(),
            "applications": {"gecko": app_versions},
        })
    data = {"addons": {ADDON_ID: {"updates": updates}}}
    (ROOT / "updates.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("\n".join(u["version"] for u in updates))


if __name__ == "__main__":
    main()
