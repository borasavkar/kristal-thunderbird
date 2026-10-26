/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Kristal — Thunderbird görünüm eklentisi.
 *
 * Bu deneysel API (Experiment) üç şey yapar:
 *  1. Ana pencereye, posta sekmesine (about:3pane) ve ileti başlığına
 *     (about:message) Kristal stil dosyalarını yükler.
 *  2. Kart görünümündeki her ileti kartına bir "Sil" düğmesi ekler. Düğme
 *     Thunderbird'ün kendi "tree-button-request-delete" yolunu kullanır;
 *     yani silme işlemi Thunderbird'ün liste görünümündeki sil sütunuyla
 *     birebir aynıdır (ileti Çöp kutusuna taşınır, Ctrl+Z ile geri alınır).
 *  3. Kartlar arasına biraz nefes payı bırakmak için kart yüksekliğine
 *     birkaç piksel ekler. Thunderbird'ün kodu değiştirilmez; yalnızca
 *     Thunderbird yüksekliği hesapladıktan sonra üzerine eklenir.
 *
 * Eklenti kapatıldığında ya da kaldırıldığında her şey geri alınır.
 */

"use strict";

/* global ExtensionCommon, Services */

const STYLESHEETS = new Map([
  [
    "chrome://messenger/content/messenger.xhtml",
    ["skin/tokens.css", "skin/main-window.css"],
  ],
  [
    "chrome://messenger/content/messageWindow.xhtml",
    ["skin/tokens.css", "skin/main-window.css"],
  ],
  ["about:3pane", ["skin/tokens.css", "skin/three-pane.css"]],
  ["about:message", ["skin/tokens.css", "skin/message.css"]],
]);

const ACCENTS = ["indigo", "teal", "rose", "amber", "graphite"];

const DEFAULTS = Object.freeze({
  accent: "indigo",
  deleteButton: "hover",
  glass: true,
  spacing: "comfortable",
  strings: Object.freeze({
    delete: "Delete this message (Delete key)",
    restore: "Restore this message",
  }),
});

// Extra height added to every card row. three-pane.css adds the same amount
// as padding (half above, half below) through the [kristal-roomy] attribute.
const EXTRA_ROW_HEIGHT = 6;

const XHTML_NS = "http://www.w3.org/1999/xhtml";
// Thunderbird starts the background script lazily, often after the windows
// are already open. The last options are kept here so the saved look is
// applied right away at startup, without waiting for the background script.
const OPTIONS_PREF = "extensions.kristal.options";
const ROW_COUNT_PREF = "mail.threadpane.cardsview.rowcount";
const LIST_VIEW_PREF = "mail.threadpane.listview";
const ROOT_ATTRIBUTES = [
  "kristal",
  "kristal-accent",
  "kristal-delete",
  "kristal-glass",
  "kristal-roomy",
];

function normalize(options = {}) {
  return {
    accent: ACCENTS.includes(options.accent) ? options.accent : DEFAULTS.accent,
    deleteButton: options.deleteButton == "always" ? "always" : "hover",
    glass: options.glass ?? DEFAULTS.glass,
    spacing: options.spacing == "default" ? "default" : "comfortable",
    strings: {
      delete: options.strings?.delete || DEFAULTS.strings.delete,
      restore: options.strings?.restore || DEFAULTS.strings.restore,
    },
  };
}

function loadSavedOptions() {
  try {
    return normalize(JSON.parse(Services.prefs.getStringPref(OPTIONS_PREF, "{}")));
  } catch {
    return normalize();
  }
}

class KristalController {
  constructor(extension) {
    this.extension = extension;
    this.options = loadSavedOptions();
    /** @type {Set<Document>} Documents that currently carry Kristal. */
    this.documents = new Set();
    /** @type {WeakMap<Window, {base: number, applied: number}>} */
    this.rowHeights = new WeakMap();
    this.running = false;
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    Services.obs.addObserver(this, "document-element-inserted");
    Services.prefs.addObserver(ROW_COUNT_PREF, this);
    Services.prefs.addObserver(LIST_VIEW_PREF, this);

    // Documents that were already open before Kristal started.
    for (const win of Services.wm.getEnumerator(null)) {
      let contexts = [];
      try {
        contexts = win.browsingContext.getAllBrowsingContextsInSubtree();
      } catch (error) {
        console.error("Kristal:", error);
      }
      for (const context of contexts) {
        let doc = null;
        try {
          doc = context.window?.document;
        } catch {
          // Remote (message body) contexts are not reachable and not needed.
        }
        if (doc && STYLESHEETS.has(doc.documentURI)) {
          this.attach(doc);
        }
      }
    }
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    Services.obs.removeObserver(this, "document-element-inserted");
    Services.prefs.removeObserver(ROW_COUNT_PREF, this);
    Services.prefs.removeObserver(LIST_VIEW_PREF, this);
    for (const doc of [...this.documents]) {
      this.detach(doc);
    }
    this.documents.clear();
  }

  configure(options) {
    this.options = normalize({ ...this.options, ...options });
    Services.prefs.setStringPref(OPTIONS_PREF, JSON.stringify(this.options));
    for (const doc of this.documents) {
      this.applyAttributes(doc);
      if (doc.documentURI == "about:3pane") {
        this.updateButtonStrings(doc);
        this.applyRowSpacing(doc.defaultView);
      }
    }
  }

  // nsIObserver
  observe(subject, topic, data) {
    if (topic == "document-element-inserted") {
      const doc = subject;
      if (
        doc?.defaultView &&
        STYLESHEETS.has(doc.documentURI) &&
        doc.nodePrincipal?.isSystemPrincipal
      ) {
        this.attach(doc);
      }
      return;
    }
    if (topic == "nsPref:changed" && [ROW_COUNT_PREF, LIST_VIEW_PREF].includes(data)) {
      // Thunderbird recalculates the card height on these changes. Wait for
      // it to finish, then add the extra spacing on top of the new height.
      for (const doc of this.documents) {
        if (doc.documentURI == "about:3pane") {
          const win = doc.defaultView;
          win.setTimeout(() => this.applyRowSpacing(win, true), 0);
        }
      }
    }
  }

  // DOM events registered on about:3pane and the other windows.
  handleEvent(event) {
    const win = event.currentTarget;
    switch (event.type) {
      case "unload":
        this.forget(event.target);
        break;
      case "uidensitychange":
      case "uifontsizechange":
        // Thunderbird's own listener already set the new base height.
        this.applyRowSpacing(win, true);
        break;
    }
  }

  attach(doc) {
    if (this.documents.has(doc)) {
      return;
    }
    const win = doc.defaultView;
    this.documents.add(doc);
    win.addEventListener("unload", this, { once: true });

    const utils = win.windowUtils;
    for (const path of STYLESHEETS.get(doc.documentURI)) {
      try {
        utils.loadSheetUsingURIString(
          this.extension.rootURI.resolve(path),
          utils.AUTHOR_SHEET
        );
      } catch (error) {
        console.error(`Kristal: could not load ${path}`, error);
      }
    }
    this.applyAttributes(doc);

    if (doc.documentURI == "about:3pane") {
      const whenReady = () => {
        if (this.running && this.documents.has(doc)) {
          this.setUpThreePane(doc);
        }
      };
      if (win.hasDOMContentLoaded?.promise) {
        win.hasDOMContentLoaded.promise.then(whenReady, console.error);
      } else {
        win.addEventListener("load", whenReady, { once: true });
      }
    }
  }

  forget(doc) {
    this.documents.delete(doc);
  }

  detach(doc) {
    const win = doc.defaultView;
    if (!win) {
      return;
    }
    try {
      win.removeEventListener("unload", this);
      const utils = win.windowUtils;
      for (const path of STYLESHEETS.get(doc.documentURI) ?? []) {
        try {
          utils.removeSheetUsingURIString(
            this.extension.rootURI.resolve(path),
            utils.AUTHOR_SHEET
          );
        } catch {
          // The sheet was never loaded in this document.
        }
      }
      for (const name of ROOT_ATTRIBUTES) {
        doc.documentElement?.removeAttribute(name);
      }
      if (doc.documentURI == "about:3pane") {
        this.tearDownThreePane(doc);
      }
    } catch (error) {
      console.error("Kristal:", error);
    }
  }

  applyAttributes(doc) {
    const root = doc.documentElement;
    if (!root) {
      return;
    }
    root.setAttribute("kristal", "");
    root.setAttribute("kristal-accent", this.options.accent);
    root.setAttribute("kristal-delete", this.options.deleteButton);
    root.toggleAttribute("kristal-glass", this.options.glass);
  }

  // --- about:3pane -------------------------------------------------------

  setUpThreePane(doc) {
    const win = doc.defaultView;

    // Cards created from now on get the buttons from the template...
    const template = doc.getElementById("threadPaneCardTemplate");
    const templateInfo = template?.content.querySelector(".thread-card-icon-info");
    if (templateInfo && !templateInfo.querySelector(".kristal-delete")) {
      templateInfo.append(this.createDeleteButtons(doc));
    }
    // ...and cards that already exist get them here.
    for (const info of doc.querySelectorAll(
      "#threadTree tr.card-layout .thread-card-icon-info"
    )) {
      if (!info.querySelector(".kristal-delete")) {
        info.append(this.createDeleteButtons(doc));
      }
    }

    win.addEventListener("uidensitychange", this);
    win.addEventListener("uifontsizechange", this);
    this.applyRowSpacing(win, true);
  }

  tearDownThreePane(doc) {
    const win = doc.defaultView;
    win.removeEventListener("uidensitychange", this);
    win.removeEventListener("uifontsizechange", this);

    const template = doc.getElementById("threadPaneCardTemplate");
    for (const button of [
      ...(template?.content.querySelectorAll(".kristal-delete") ?? []),
      ...doc.querySelectorAll(".kristal-delete"),
    ]) {
      button.remove();
    }

    const cardClass = win.customElements?.get("thread-card");
    const state = this.rowHeights.get(win);
    if (cardClass && state && cardClass.ROW_HEIGHT === state.applied) {
      cardClass.ROW_HEIGHT = state.base;
      this.resetTree(doc);
    }
    this.rowHeights.delete(win);
  }

  createDeleteButtons(doc) {
    const fragment = doc.createDocumentFragment();
    for (const [className, key] of [
      ["tree-button-delete", "delete"],
      ["tree-button-restore", "restore"],
    ]) {
      const button = doc.createElementNS(XHTML_NS, "button");
      button.setAttribute("type", "button");
      // "tree-button-request-delete" is the class Thunderbird's tree view
      // listens for; it deletes (or restores) exactly this row's message.
      button.className = `button-flat ${className} tree-button-request-delete kristal-delete`;
      button.setAttribute("tabindex", "-1");
      // Keyboard and screen reader users use the Delete key, exactly like
      // Thunderbird's own row buttons (star, spam) which are hidden too.
      button.setAttribute("aria-hidden", "true");
      button.dataset.kristalString = key;
      button.title = this.options.strings[key];
      const icon = doc.createElementNS(XHTML_NS, "img");
      icon.setAttribute("src", "");
      icon.setAttribute("alt", "");
      button.append(icon);
      fragment.append(button);
    }
    return fragment;
  }

  updateButtonStrings(doc) {
    const template = doc.getElementById("threadPaneCardTemplate");
    for (const button of [
      ...(template?.content.querySelectorAll(".kristal-delete") ?? []),
      ...doc.querySelectorAll(".kristal-delete"),
    ]) {
      button.title = this.options.strings[button.dataset.kristalString] ?? "";
    }
  }

  /**
   * Adds EXTRA_ROW_HEIGHT to the card height Thunderbird calculated.
   *
   * @param {Window} win - An about:3pane window.
   * @param {boolean} [fresh] - True when Thunderbird has just recalculated
   *   the height, so the current value is the plain base height.
   */
  applyRowSpacing(win, fresh = false) {
    const doc = win?.document;
    const cardClass = win?.customElements?.get("thread-card");
    if (!doc || !cardClass || !Number.isFinite(cardClass.ROW_HEIGHT)) {
      return;
    }
    const state = this.rowHeights.get(win);
    let base = cardClass.ROW_HEIGHT;
    if (!fresh && state && base === state.applied) {
      base = state.base;
    }
    const roomy = this.options.spacing == "comfortable";
    const wanted = base + (roomy ? EXTRA_ROW_HEIGHT : 0);
    this.rowHeights.set(win, { base, applied: wanted });
    doc.documentElement.toggleAttribute("kristal-roomy", roomy);
    if (cardClass.ROW_HEIGHT !== wanted) {
      cardClass.ROW_HEIGHT = wanted;
    }
    this.resetTree(doc);
  }

  resetTree(doc) {
    const tree = doc.getElementById("threadTree");
    if (tree?.getAttribute("rows") == "thread-card" && typeof tree.reset == "function") {
      tree.reset();
    }
  }
}

// One controller per extension. The background script may call configure()
// before or after onStartup(); both must reach the same controller, otherwise
// a second controller with default options would overwrite the saved ones.
const controllers = new WeakMap();

function controllerFor(extension) {
  let controller = controllers.get(extension);
  if (!controller) {
    controller = new KristalController(extension);
    controllers.set(extension, controller);
    controller.start();
  }
  return controller;
}

var kristal = class extends ExtensionCommon.ExtensionAPI {
  onStartup() {
    controllerFor(this.extension);
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown) {
      return;
    }
    controllers.get(this.extension)?.stop();
    controllers.delete(this.extension);
    // Make sure an updated version of the add-on loads fresh files.
    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }

  getAPI() {
    return {
      kristal: {
        configure: async options => {
          controllerFor(this.extension).configure(options);
        },
      },
    };
  }
};
