/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Kristal — hands the saved options to the experiment. Thunderbird may start
 * this script late; the experiment already applies the last options on its
 * own at startup, so this only keeps the two in sync.
 */

"use strict";

/* global applyKristalOptions */

function sync() {
  applyKristalOptions().catch(console.error);
}

browser.runtime.onStartup.addListener(sync);
browser.runtime.onInstalled.addListener(sync);
browser.storage.onChanged.addListener((changes, area) => {
  if (area == "local") {
    sync();
  }
});

sync();
