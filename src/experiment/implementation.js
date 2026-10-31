/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Kristal — Thunderbird görünüm eklentisi.
 *
 * Bu deneysel API (Experiment) üç şey yapar:
 *  1. Ana pencereye, posta sekmesine (about:3pane) ve ileti başlığına
 *     (about:message) Kristal stil dosyalarını yükler.
 *  2. Kart görünümündeki her ileti kartına "Spam" ve "Sil" düğmeleri ekler,
 *     yıldızı kartın başına (okunmamış noktasının altına) taşır. Düğmeler
 *     Thunderbird'ün kendi "tree-button-spam" ve "tree-button-request-delete"
 *     yollarını kullanır; yani işlem Thunderbird'ün liste görünümündeki spam
 *     ve sil sütunlarıyla birebir aynıdır.
 *  3. Kartlar arasına biraz nefes payı bırakmak için kart yüksekliğine
 *     birkaç piksel ekler. Thunderbird'ün kodu değiştirilmez; yalnızca
 *     Thunderbird yüksekliği hesapladıktan sonra üzerine eklenir.
 *
 * Eklenti kapatıldığında ya da kaldırıldığında her şey geri alınır.
 */

"use strict";

/* global ExtensionCommon, Services */

// Thunderbird may load several Experiments into one scope. Everything except
// the API class itself stays inside this closure to avoid name collisions.
var kristal = (() => {
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
      spam: "Mark as junk (J key)",
      notSpam: "Mark as not junk (Shift+J)",
      deleteDone: "Message deleted",
      restoreDone: "Message restored",
      spamDone: "Marked as junk",
      notSpamDone: "Junk mark removed",
    }),
  });

  // Extra height added to every card row. three-pane.css adds the same amount
  // as padding (half above, half below) through the [kristal-roomy] attribute.
  const EXTRA_ROW_HEIGHT = 6;

  const XHTML_NS = "http://www.w3.org/1999/xhtml";

  // How long each card effect plays before the action runs (ms); matches
  // the animations in three-pane.css. After that, further Spam/Delete clicks
  // are ignored for COOLDOWN_MS so a second message is not hit by accident.
  const EFFECT_MS = { delete: 320, restore: 320, spam: 420, notSpam: 420 };
  const COOLDOWN_MS = 400;
  const TOAST_MS = 2600;
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
      strings: Object.fromEntries(
        Object.keys(DEFAULTS.strings).map(key => [
          key,
          options.strings?.[key] || DEFAULTS.strings[key],
        ])
      ),
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
      /** @type {WeakMap<Document, number>} Time until Spam/Delete clicks are ignored. */
      this.busyUntil = new WeakMap();
      /** @type {WeakMap<Document, {kind: string, count: number, timer: number}>} */
      this.toastState = new WeakMap();
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
        case "click":
          this.onActionClick(event);
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

    /**
     * Calls `callback` for the card template (so cards created from now on are
     * covered) and for every card that already exists.
     */
    forEachCard(doc, callback) {
      const template = doc.getElementById("threadPaneCardTemplate");
      if (template) {
        callback(template.content);
      }
      for (const row of doc.querySelectorAll("#threadTree tr.card-layout")) {
        callback(row);
      }
    }

    setUpThreePane(doc) {
      const win = doc.defaultView;

      this.forEachCard(doc, card => {
        // The star moves to the start of the card, under the unread dot.
        const star = card.querySelector(".thread-card-icon-info .button-star");
        const column = card.querySelector(".read-status-column");
        if (star && column) {
          column.append(star);
        }
        // Spam and Delete go to the end of the card, side by side.
        const info = card.querySelector(".thread-card-icon-info");
        if (info && !info.querySelector(".kristal-action")) {
          info.append(this.createActionButtons(doc));
        }
      });

      win.addEventListener("uidensitychange", this);
      win.addEventListener("uifontsizechange", this);
      // Capture phase: runs before Thunderbird's own click handler on the tree.
      doc.getElementById("threadTree")?.addEventListener("click", this, true);
      this.applyRowSpacing(win, true);
    }

    tearDownThreePane(doc) {
      const win = doc.defaultView;
      win.removeEventListener("uidensitychange", this);
      win.removeEventListener("uifontsizechange", this);
      doc.getElementById("threadTree")?.removeEventListener("click", this, true);
      doc.getElementById("kristalToast")?.remove();
      for (const card of doc.querySelectorAll("[kristal-effect]")) {
        card.removeAttribute("kristal-effect");
      }

      this.forEachCard(doc, card => {
        for (const button of card.querySelectorAll(".kristal-action")) {
          button.remove();
        }
        // Thunderbird's own order: ..., spam, star.
        const star = card.querySelector(".read-status-column .button-star");
        const info = card.querySelector(".thread-card-icon-info");
        if (star && info) {
          info.append(star);
        }
      });

      const cardClass = win.customElements?.get("thread-card");
      const state = this.rowHeights.get(win);
      if (cardClass && state && cardClass.ROW_HEIGHT === state.applied) {
        cardClass.ROW_HEIGHT = state.base;
        this.resetTree(doc);
      }
      this.rowHeights.delete(win);
    }

    /**
     * A click on a Kristal Spam/Delete button first plays an effect on the
     * card, then hands the action to Thunderbird. Until the effect and a short
     * pause are over, further clicks on these buttons are ignored: otherwise
     * the next card slides under the pointer and a second click would act on
     * a message the user never meant.
     */
    onActionClick(event) {
      const button = event.target.closest?.(".kristal-action");
      if (!button || event.button !== 0) {
        return;
      }
      // Kristal replays the action itself once the effect has played.
      event.stopPropagation();
      event.preventDefault();

      const doc = button.ownerDocument;
      const win = doc.defaultView;
      const now = win.performance.now();
      if (now < (this.busyUntil.get(doc) ?? 0)) {
        return;
      }
      const row = button.closest("tr.card-layout");
      const view = win.gDBView;
      if (!row || !view || !Number.isInteger(row.index)) {
        return;
      }
      let header;
      try {
        header = view.getMsgHdrAt(row.index);
      } catch {
        return;
      }

      const kind = button.classList.contains("tree-button-restore")
        ? "restore"
        : button.classList.contains("kristal-delete")
          ? "delete"
          : button.classList.contains("kristal-spam-unmark")
            ? "notSpam"
            : "spam";
      const duration = EFFECT_MS[kind];
      this.busyUntil.set(doc, now + duration + COOLDOWN_MS);

      const card = row.querySelector(".card-container");
      card?.setAttribute("kristal-effect", kind);

      win.setTimeout(() => {
        // Find the message again; the list may have changed meanwhile.
        let index = -1;
        try {
          index = view.findIndexOfMsgHdr(header, true);
        } catch {}
        const tree = doc.getElementById("threadTree");
        const body = tree?.table?.body;
        // When the card is the one open in the message pane, use
        // Thunderbird's own commands: they also move on to the next message,
        // so the deleted (or junked) one does not stay on screen.
        const selection = view.selection;
        const isOpenMessage =
          index >= 0 && selection?.count == 1 && selection.isSelected(index);
        const commands = {
          delete: "cmd_deleteMessage",
          spam: "cmd_markAsJunk",
          notSpam: "cmd_markAsNotJunk",
        };
        if (isOpenMessage && commands[kind] && win.commandController) {
          win.commandController.doCommand(commands[kind]);
          this.showToast(doc, kind);
        } else if (body && index >= 0 && index < view.rowCount) {
          if (kind == "delete" || kind == "restore") {
            body.dispatchEvent(
              new win.CustomEvent("request-delete", { bubbles: true, detail: { index } })
            );
          } else {
            body.dispatchEvent(
              new win.CustomEvent("toggle-spam", {
                bubbles: true,
                detail: { isJunk: kind == "notSpam", index },
              })
            );
          }
          this.showToast(doc, kind);
        }
        // Rows are reused for other messages; clear the effect after the
        // list has redrawn.
        win.requestAnimationFrame(() =>
          win.requestAnimationFrame(() => card?.removeAttribute("kristal-effect"))
        );
      }, duration);
    }

    /** Short status line at the bottom of the message list (aria-live). */
    showToast(doc, kind) {
      const win = doc.defaultView;
      let toast = doc.getElementById("kristalToast");
      if (!toast) {
        toast = doc.createElementNS(XHTML_NS, "div");
        toast.id = "kristalToast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        doc.getElementById("threadPane")?.append(toast);
      }
      // Repeated actions of the same kind while the note is visible are
      // counted, so "Message deleted (2)" shows that two went.
      const last = this.toastState.get(doc);
      const count =
        last && last.kind == kind && toast.hasAttribute("kristal-visible") ? last.count + 1 : 1;
      this.toastState.set(doc, { kind, count });
      const text = this.options.strings[`${kind}Done`];
      toast.textContent = count > 1 ? `${text} (${count})` : text;
      toast.setAttribute("kristal-kind", kind);
      toast.setAttribute("kristal-visible", "");
      win.clearTimeout(last?.timer);
      this.toastState.get(doc).timer = win.setTimeout(
        () => toast.removeAttribute("kristal-visible"),
        TOAST_MS
      );
    }

    createActionButtons(doc) {
      const fragment = doc.createDocumentFragment();
      // The tree-button-* classes are the ones Thunderbird's tree view listens
      // for: "tree-button-spam" toggles junk and "tree-button-request-delete"
      // deletes (or restores) exactly this row's message. Each action has two
      // buttons; the stylesheet shows the one that fits the message's state.
      for (const [className, key] of [
        ["tree-button-spam kristal-spam kristal-spam-mark", "spam"],
        ["tree-button-spam kristal-spam kristal-spam-unmark", "notSpam"],
        ["tree-button-delete tree-button-request-delete kristal-delete", "delete"],
        ["tree-button-restore tree-button-request-delete kristal-delete", "restore"],
      ]) {
        const button = doc.createElementNS(XHTML_NS, "button");
        button.setAttribute("type", "button");
        button.className = `button-flat ${className} kristal-action`;
        button.setAttribute("tabindex", "-1");
        // Keyboard and screen reader users use the J / Shift+J and Delete keys,
        // exactly like Thunderbird's own row buttons, which are hidden too.
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
      this.forEachCard(doc, card => {
        for (const button of card.querySelectorAll(".kristal-action")) {
          button.title = this.options.strings[button.dataset.kristalString] ?? "";
        }
      });
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

  return class extends ExtensionCommon.ExtensionAPI {
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
})();
