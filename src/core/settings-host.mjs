/**
 * @file Adapts Sine's settings pane to Firefox preferences and Zen's settings win.
 * @license
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as domUtils from "../utils/dom.mjs";

const tabImage = "chrome://userscripts/content/assets/images/saturn.svg";
const sineHashes = new Set(["#zenMarketplace", "#sineMods"]);

/**
 * Adds Sine to Zen's native navigation without relying on Firefox's pane registry.
 *
 * @param {Window} win - Zen settings win.
 * @param {string} brand - Current Sine brand.
 * @returns {object} Container and attributes for the shared settings content.
 */
const initZenSettingsPane = (win, brand) => {
  const doc = win.document;
  const categories = doc.getElementById("zen-settings-categories");
  const generalCategory = categories.querySelector('[data-pane="general"]');

  domUtils.appendXUL(
    categories,
    `
      <button id="category-sine-mods" class="zen-settings-category" role="tab"
        data-pane="sineMods" aria-controls="zen-settings-pane-sineMods"
        aria-selected="false" tabindex="-1">
        <img src="${tabImage}" alt=""/>
        <span data-l10n-id="pane-${brand}-mods-title"></span>
      </button>
    `,
    generalCategory.nextElementSibling
  );

  // The built-in link opens Firefox preferences and closes this window instead.
  doc.querySelector('#zen-settings-links [data-action="open-mods"]')?.remove();

  const prefPane = domUtils.appendXUL(
    doc.getElementById("zen-settings-panes"),
    `
      <section id="zen-settings-pane-sineMods" class="zen-settings-pane" data-pane="sineMods"
        role="tabpanel" aria-labelledby="category-sine-mods" hidden=""></section>
    `
  );

  const settings = win.gZenSettingsWindow;
  const requestedPane = win.arguments?.[0];
  const sineIsActive =
    sineHashes.has(win.location.hash) ||
    requestedPane === "sineMods" ||
    settings.currentPane === "sineMods";

  // Zen queries categories and panes dynamically, so its click/keyboard handlers also handle Sine.
  settings.showPane(sineIsActive ? "sineMods" : settings.currentPane);

  return { prefPane, generalGroup: null, sineGroupData: "", isZenSettings: true };
};

/**
 * Registers the shared settings content with the host's navigation system.
 *
 * @param {Window} win - Settings window or tab.
 * @param {string} brand - Current Sine brand.
 * @param {Map | null} categoryInits - Firefox's pane registry, absent in native Zen settings.
 * @returns {object} Container and attributes for the shared settings content.
 */
export const initSettingsPane = (win, brand, categoryInits = null) => {
  const doc = win.document;
  if (doc.getElementById("zen-settings-categories")) {
    return initZenSettingsPane(win, brand);
  }

  const categories = doc.getElementById("categories");
  const generalCategory = categories.querySelector("#category-general");
  if (generalCategory.localName === "moz-page-nav-button") {
    domUtils.appendXUL(
      categories,
      `
        <html:moz-page-nav-button id="category-sine-mods" view="paneSineMods"
          iconsrc="${tabImage}" data-l10n-id="pane-${brand}-mods-title" role="none"/>
      `,
      generalCategory.nextElementSibling,
      win.MozXULElement
    );
  } else {
    domUtils.appendXUL(
      categories,
      `
        <richlistitem id="category-sine-mods" class="category" value="paneSineMods" helpTopic="prefs-main"
          data-l10n-id="category-${brand}-mods" data-l10n-attrs="tooltiptext" align="center">
          <image class="category-icon"/>
          <label class="category-name" flex="1" data-l10n-id="pane-${brand}-mods-title"/>
        </richlistitem>
      `,
      generalCategory.nextElementSibling,
      win.MozXULElement
    );
  }

  if (categoryInits) {
    categoryInits.set("paneSineMods", {
      _initted: true,
      // eslint-disable-next-line no-empty-function
      init: () => {},
    });
  }

  const sineIsActive = sineHashes.has(win.location.hash);
  if (sineIsActive) {
    categories.selectItem(doc.getElementById("category-sine-mods"));
    for (const el of doc.querySelectorAll('[data-category="paneGeneral"]')) {
      el.setAttribute("hidden", "true");
    }
  }

  return {
    prefPane: doc.getElementById("mainPrefPane") || doc.getElementById("paneDeck"),
    generalGroup: doc.querySelector('[data-category="paneGeneral"]'),
    sineGroupData: `data-category="paneSineMods" ${sineIsActive ? "" : 'hidden="true"'}`,
    isZenSettings: false,
  };
};
