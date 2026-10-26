/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Kristal — shared by the background script and the options page: the
 * default options and the function that hands the saved options to the
 * experiment.
 */

"use strict";

/* exported KRISTAL_DEFAULTS, applyKristalOptions */

const KRISTAL_DEFAULTS = {
  accent: "indigo",
  deleteButton: "hover",
  glass: true,
  spacing: "comfortable",
};

async function applyKristalOptions() {
  const options = await browser.storage.local.get(KRISTAL_DEFAULTS);
  await browser.kristal.configure({
    ...options,
    strings: {
      delete: browser.i18n.getMessage("deleteMessage"),
      restore: browser.i18n.getMessage("restoreMessage"),
    },
  });
}
