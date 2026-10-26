/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* global KRISTAL_DEFAULTS, applyKristalOptions */

for (const element of document.querySelectorAll("[data-i18n]")) {
  element.textContent = browser.i18n.getMessage(element.dataset.i18n);
}
document.documentElement.lang = browser.i18n.getUILanguage();

async function load() {
  const options = await browser.storage.local.get(KRISTAL_DEFAULTS);
  const form = document.querySelector("main");
  form.querySelector(`input[name="accent"][value="${options.accent}"]`).checked = true;
  form.querySelector(`input[name="deleteButton"][value="${options.deleteButton}"]`).checked = true;
  form.querySelector('input[name="glass"]').checked = options.glass;
  form.querySelector('input[name="spacing"]').checked = options.spacing == "comfortable";
}

async function save(change) {
  await browser.storage.local.set(change);
  // Apply right away; the background script may not be running.
  await applyKristalOptions();
}

document.addEventListener("change", event => {
  const input = event.target;
  switch (input.name) {
    case "accent":
    case "deleteButton":
      save({ [input.name]: input.value }).catch(console.error);
      break;
    case "glass":
      save({ glass: input.checked }).catch(console.error);
      break;
    case "spacing":
      save({ spacing: input.checked ? "comfortable" : "default" }).catch(console.error);
      break;
  }
});

load();
