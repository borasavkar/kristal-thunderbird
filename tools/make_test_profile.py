# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""Builds a throwaway Thunderbird profile for trying Kristal.

Kullanım:  python tools/make_test_profile.py <profil-klasörü> <kristal.xpi> [--light]

The profile has only Local Folders with an Inbox of made-up sample mail, and
the XPI is placed in its extensions folder. Start it with:

    thunderbird.exe -no-remote -purgecaches -profile <profil-klasörü>

Never point this at a real profile: the folder is deleted first.
"""

import base64
import datetime
import email.utils
import pathlib
import shutil
import sys


def main():
    profile = pathlib.Path(sys.argv[1])
    xpi = pathlib.Path(sys.argv[2])
    light = "--light" in sys.argv
    if (profile / "prefs.js").exists() and "tbtest" not in str(profile).lower():
        raise SystemExit("Refusing to wipe a folder that looks like a real profile.")
    if profile.exists():
        shutil.rmtree(profile)
    (profile / "extensions").mkdir(parents=True)
    shutil.copy(xpi, profile / "extensions" / "kristal@borasavkar.github.io.xpi")

    prefs = {
        "extensions.autoDisableScopes": 0,
        "extensions.enabledScopes": 15,
        "extensions.startupScanScopes": 1,
        "xpinstall.signatures.required": False,
        "mail.shell.checkDefaultClient": False,
        "mail.rights.version": 1,
        "mailnews.start_page.enabled": False,
        "mail.provider.suppress_dialog_on_startup": True,
        "datareporting.policy.dataSubmissionEnabled": False,
        "datareporting.healthreport.uploadEnabled": False,
        "toolkit.telemetry.reportingpolicy.firstRun": False,
        "app.update.auto": False,
        "mail.winsearch.firstRunDone": True,
        "mail.accountmanager.accounts": "account1",
        "mail.accountmanager.localfoldersserver": "server1",
        "mail.account.account1.server": "server1",
        "mail.server.server1.type": "none",
        "mail.server.server1.hostname": "Local Folders",
        "mail.server.server1.name": "Local Folders",
        "mail.server.server1.userName": "nobody",
        "mail.server.server1.directory-rel": "[ProfD]Mail/Local Folders",
        "devtools.console.stdout.chrome": True,
        "browser.dom.window.dump.enabled": True,
        "mail.inappnotifications.enabled": False,
        "mail.uifontsize": 14,
        "ui.systemUsesDarkTheme": 0 if light else 1,
    }

    def js(value):
        if value is True:
            return "true"
        if value is False:
            return "false"
        return str(value) if isinstance(value, int) else f'"{value}"'

    (profile / "user.js").write_text(
        "".join(f'user_pref("{k}", {js(v)});\n' for k, v in prefs.items()), encoding="utf-8"
    )

    folder = profile / "Mail" / "Local Folders"
    folder.mkdir(parents=True)
    now = datetime.datetime(2026, 10, 26, 21, 30, tzinfo=datetime.timezone(datetime.timedelta(hours=3)))
    samples = [
        ("Ayşe Demir", "ayse@example.com", "Cuma toplantısı için gündem", 0, "0000", False),
        ("Kargo Bildirimi", "bildirim@example.net", "Siparişiniz yola çıktı", 35, "0000", True),
        ("Mehmet Kaya", "mehmet@example.org", "Re: Fiyat teklifi hakkında", 140, "0001", False),
        ("Muhasebe", "muhasebe@example.com", "Ekim ayı fatura dökümü", 300, "0005", True),
        ("Zeynep Arslan", "zeynep@example.com", "Yeni vitrin fotoğrafları", 600, "0001", True),
        ("Bülten", "bulten@example.net", "Haftalık sektör özeti", 1500, "0001", False),
        ("Can Yıldız", "can@example.org", "Yarın öğle yemeği?", 1600, "0000", False),
        ("Destek Ekibi", "destek@example.com", "Talebiniz yanıtlandı #4821", 2900, "0003", False),
        ("Elif Şahin", "elif@example.org", "Sunum dosyası (son hali)", 3100, "0001", True),
        ("Takvim", "takvim@example.net", "Hatırlatma: Salı 10:00 tedarikçi görüşmesi", 4300, "0001", False),
        ("Ali Öztürk", "ali@example.com", "Depo sayım sonuçları", 5800, "0001", False),
        ("Selin Koç", "selin@example.org", "Teşekkürler!", 7200, "0001", False),
    ]
    out = []
    for i, (name, addr, subject, minutes, status, attach) in enumerate(samples):
        date = now - datetime.timedelta(minutes=minutes)
        headers = [
            f"From - {date.strftime('%a %b %d %H:%M:%S %Y')}",
            f"X-Mozilla-Status: {status}",
            "X-Mozilla-Status2: 00000000",
            f"From: {email.utils.formataddr((name, addr))}",
            "To: deneme@example.com",
            f"Subject: =?UTF-8?B?{base64.b64encode(subject.encode()).decode()}?=",
            f"Date: {email.utils.format_datetime(date)}",
            f"Message-ID: <kristal-test-{i}@example.com>",
            "MIME-Version: 1.0",
        ]
        body = f"Merhaba,\n\nBu, Kristal görünümünü denemek için uydurulmuş örnek bir iletidir ({i + 1}).\n\nİyi çalışmalar.\n"
        if attach:
            headers.append('Content-Type: multipart/mixed; boundary="b1"')
            payload = (
                "\n--b1\nContent-Type: text/plain; charset=UTF-8\nContent-Transfer-Encoding: 8bit\n\n"
                + body
                + '\n--b1\nContent-Type: application/pdf; name="ornek.pdf"\n'
                'Content-Disposition: attachment; filename="ornek.pdf"\n'
                "Content-Transfer-Encoding: base64\n\nJVBERi0xLjQKJcfsj6IK\n--b1--\n"
            )
        else:
            headers += ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit"]
            payload = "\n" + body
        out.append("\n".join(headers) + "\n" + payload + "\n")
    (folder / "Inbox").write_bytes("".join(out).encode("utf-8"))
    print(profile)


if __name__ == "__main__":
    main()
