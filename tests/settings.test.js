/**
 * @file Checks settings hosts without depending on a particular Firefox or Zen version.
 * @license
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const { initSettingsPane } = ChromeUtils.importESModule(
  "chrome://userscripts/content/core/settings-host.mjs"
);
const domUtils = ChromeUtils.importESModule("chrome://userscripts/content/utils/dom.mjs");
const settingsUtils = ChromeUtils.importESModule(
  "chrome://userscripts/content/core/utils.sys.mjs"
).default;

const htmlNamespace = "http://www.w3.org/1999/xhtml";

const assertSettings = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

/**
 * Builds a native Zen settings fixture in a container.
 *
 * @param {HTMLElement} root - Container element for the fixture.
 * @param {HTMLDocument} _document - Unused; kept for a uniform builder signature.
 */
const buildNativeFixture = ({ root }) => {
  const append = (markup, isXUL = false) => domUtils.appendXUL(root, markup, null, isXUL);
  const categories = append('<div id="zen-settings-categories"/>');
  domUtils.appendXUL(categories, '<button class="zen-settings-category" data-pane="general"/>');
  domUtils.appendXUL(categories, '<button class="zen-settings-category" data-pane="appearance"/>');
  const links = append('<div id="zen-settings-links"/>');
  domUtils.appendXUL(links, '<button data-action="open-mods"/>');
  append('<div id="zen-settings-panes"/>');
  append("<linkset/>", true);
};

/**
 * Builds a Firefox-style settings fixture with configurable navigation markup.
 *
 * @param {HTMLElement} root - Container element for the fixture.
 * @param {HTMLDocument} _document - Unused; kept for a uniform builder signature.
 * @param {string} generalTag - Markup for the General category element.
 */
const buildFirefoxFixture = ({ root }, generalTag) => {
  const categories = domUtils.appendXUL(root, '<div id="categories"/>');
  domUtils.appendXUL(categories, generalTag, null, true);
  domUtils.appendXUL(root, '<groupbox id="mainPrefPane" data-category="paneGeneral"/>', null, true);
};

/**
 * Builds an older Firefox settings fixture using a richlist navigation.
 *
 * @param {HTMLElement} root - Container element for the fixture.
 * @param {HTMLDocument} _document - Unused; kept for a uniform builder signature.
 */
const buildLegacyFixture = ({ root }) => {
  domUtils.appendXUL(
    root,
    '<richlistbox id="categories"><richlistitem id="category-general"/></richlistbox>',
    null,
    true
  );
  domUtils.appendXUL(root, '<vbox id="paneDeck"/>', null, true);
  domUtils.appendXUL(root, '<groupbox data-category="paneGeneral"/>', null, true);
};

/**
 * Gives each test a fixture window and removes its DOM afterward.
 *
 * @param {Function} buildFixture - Fixture builder receiving a root and document.
 * @param {Function} callback - Test to run with the fixture window.
 */
const withSettingsWindow = async (buildFixture, callback) => {
  const host = Services.appShell.hiddenDOMWindow;
  const root = host.document.createElementNS(htmlNamespace, "div");
  host.document.documentElement.append(root);

  const win = {
    document: host.document,
    location: { hash: "" },
    arguments: [],
    MozXULElement: host.MozXULElement,
    DOMParser: host.DOMParser,
    Event: host.Event,
    gZenSettingsWindow: null,
  };

  try {
    buildFixture({ root, document: host.document, win });
    await callback(win);
  } finally {
    root.remove();
    host.dispatchEvent(new host.Event("beforeunload"));
  }
};

/**
 * Records calls to Zen's existing navigation controller.
 *
 * @param {object} win - Fixture window.
 * @param {string} currentPane - Pane already selected by Zen.
 * @returns {string[]} Requested panes.
 */
const recordZenNavigation = (win, currentPane = "general") => {
  const panes = [];
  win.gZenSettingsWindow = { currentPane, showPane: (pane) => panes.push(pane) };
  return panes;
};

it("Native Zen settings use a native tab and pane without Firefox globals", async () => {
  await withSettingsWindow(buildNativeFixture, (win) => {
    const { document } = win;
    const panes = recordZenNavigation(win);
    const result = initSettingsPane(win, "sine");
    const tab = document.getElementById("category-sine-mods");

    assertSettings(!document.getElementById("categories"), "No Firefox navigation is available");
    assertSettings(tab.namespaceURI === htmlNamespace, "Zen's category must be HTML");
    assertSettings(
      tab.classList.contains("zen-settings-category"),
      "Use Zen's delegated navigation"
    );
    assertSettings(tab.dataset.pane === "sineMods", "Use the native pane identifier");
    assertSettings(tab.getAttribute("role") === "tab", "Expose a native accessible tab");
    assertSettings(tab.getAttribute("tabindex") === "-1", "Do not add a second tab stop");
    assertSettings(
      tab.querySelector("span").dataset.l10nId === "pane-sine-mods-title",
      "Zen's controller needs a localized child label for its title"
    );
    assertSettings(
      result.prefPane.id === tab.getAttribute("aria-controls") &&
        result.prefPane.getAttribute("aria-labelledby") === tab.id,
      "Associate the tab and panel"
    );
    assertSettings(
      result.prefPane.parentElement.id === "zen-settings-panes",
      "Use Zen's content area"
    );
    assertSettings(result.prefPane.hidden, "Do not display Sine alongside the initial pane");
    assertSettings(result.sineGroupData === "", "Only the native parent panel controls visibility");
    assertSettings(result.isZenSettings && result.generalGroup === null, "Use the native host");
    assertSettings(panes.join() === "general", "Preserve the selected native pane");
    assertSettings(
      !document.querySelector('[data-action="open-mods"]'),
      "Remove the obsolete link"
    );
  });
});

it("Native Zen settings preserve another selected pane and Cosine branding", async () => {
  await withSettingsWindow(buildNativeFixture, (win) => {
    const panes = recordZenNavigation(win, "appearance");
    initSettingsPane(win, "cosine");
    assertSettings(panes.join() === "appearance", "Keep the pane Zen opened");
    assertSettings(
      win.document.querySelector("#category-sine-mods span").dataset.l10nId ===
        "pane-cosine-mods-title",
      "Keep Cosine's localized branding"
    );
  });
});

for (const hash of ["#sineMods", "#zenMarketplace"]) {
  it(`Native Zen settings honor the ${hash} entry point`, async () => {
    await withSettingsWindow(buildNativeFixture, (win) => {
      const panes = recordZenNavigation(win);
      win.location.hash = hash;
      initSettingsPane(win, "sine");
      assertSettings(
        panes.join() === "sineMods",
        "Open Sine instead of the removed Zen marketplace"
      );
    });
  });
}

it("Native Zen settings honor a Sine pane passed to ZenSettings.open", async () => {
  await withSettingsWindow(buildNativeFixture, (win) => {
    const panes = recordZenNavigation(win);
    win.arguments = ["sineMods"];
    initSettingsPane(win, "sine");
    assertSettings(
      panes.join() === "sineMods",
      "Restore a pane not registered during Zen's constructor"
    );
  });
});

for (const generalTag of [
  `<moz-page-nav-button xmlns="${htmlNamespace}" id="category-general"/>`,
  `<moz-page-nav-button id="category-general"/>`,
]) {
  it(`Firefox preferences support ${generalTag} navigation`, async () => {
    await withSettingsWindow(
      (context) => buildFirefoxFixture(context, generalTag),
      (win) => {
        const registry = new Map();
        const result = initSettingsPane(win, "sine", registry);
        const tab = win.document.getElementById("category-sine-mods");
        assertSettings(tab.localName === "moz-page-nav-button", "Detect navigation by localName");
        assertSettings(
          tab.getAttribute("view") === "paneSineMods",
          "Keep Firefox's pane identifier"
        );
        assertSettings(
          registry.get("paneSineMods")._initted,
          "Register with Firefox's pane controller"
        );
        assertSettings(result.prefPane.id === "mainPrefPane", "Keep Firefox's content container");
        assertSettings(result.sineGroupData.includes('hidden="true"'), "Start hidden on General");
        assertSettings(!result.isZenSettings, "Do not use native Zen navigation");
      }
    );
  });
}

it("Older Firefox settings retain richlist navigation, paneDeck and marketplace links", async () => {
  await withSettingsWindow(buildLegacyFixture, (win) => {
    const { document } = win;
    let selected = null;
    document.getElementById("categories").selectItem = (item) => {
      selected = item;
    };
    win.location.hash = "#zenMarketplace";
    const result = initSettingsPane(win, "sine", new Map());
    assertSettings(
      selected?.id === "category-sine-mods",
      "Select Sine for the old marketplace link"
    );
    assertSettings(selected.localName === "richlistitem", "Keep the legacy category element");
    assertSettings(result.prefPane.id === "paneDeck", "Keep the older content container");
    assertSettings(!result.sineGroupData.includes("hidden"), "Show Sine immediately");
    assertSettings(result.generalGroup.hasAttribute("hidden"), "Hide General when opening Sine");
  });
});

it("Sine locales and README styles work in a standalone XUL window with a linkset", async () => {
  await withSettingsWindow(buildNativeFixture, (win) => {
    const { document } = win;
    // Zen's XUL window has no HTML head; its linkset is the fallback target.
    document.documentElement.removeChild(document.head);
    domUtils.injectLocale("sine-preferences", document);
    const link = document.querySelector('linkset > link[rel="localization"]');
    assertSettings(link?.namespaceURI === htmlNamespace, "Use a functional HTML localization link");
    assertSettings(
      link.getAttribute("href").endsWith("/sine-preferences.ftl"),
      "Load Sine's messages"
    );

    const readme = document.createElementNS(htmlNamespace, "div");
    document.documentElement.append(readme);
    domUtils.parseMD(readme, "# Sine README", "https://example.com/");
    domUtils.parseMD(readme, "# Updated README", "https://example.com/");
    assertSettings(
      readme.querySelector("h1")?.textContent === "Updated README",
      "Render README content"
    );
    assertSettings(
      document.querySelectorAll("linkset > .marked-styles").length === 1,
      "Add styles once"
    );
  });
});

it("Settings refreshes include native Zen windows and ignore uninitialized documents", () => {
  const originalGetProcesses = settingsUtils.getProcesses;
  const ready = { document: { getElementById: () => ({}) } };
  const loading = { document: { getElementById: () => null } };
  const closed = { ...ready, closed: true };

  try {
    settingsUtils.getProcesses = (window, paths) => {
      assertSettings(
        paths.includes("settings") && paths.includes("preferences"),
        "Keep existing hosts"
      );
      assertSettings(
        paths.includes("/content/zen-components/windows/zen-settings-window.xhtml"),
        "Include the standalone Zen window"
      );
      return window ? [window] : [ready, loading, closed];
    };
    const windows = settingsUtils.getSettingsWindows();
    assertSettings(
      windows.length === 1 && windows[0] === ready,
      "Refresh only initialized settings"
    );
    assertSettings(
      settingsUtils.getSettingsWindows(ready)[0] === ready,
      "Support targeted refreshes"
    );
    assertSettings(settingsUtils.getSettingsWindows(loading).length === 0, "Wait for Sine's UI");
    assertSettings(
      settingsUtils.getSettingsWindows(null, "sineInstallationList").length === 1,
      "Marketplace refreshes by its own initialized container"
    );
  } finally {
    settingsUtils.getProcesses = originalGetProcesses;
  }
});
