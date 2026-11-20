import { InAppBrowser, InvisibilityMode, ToolBarType } from "@capgo/inappbrowser";
import type { WebviewDriver } from "@/lib/registry/session";

/** Adattatore sul plugin nativo (webview WKWebView/WebView gestita dall'app). */
export const inAppBrowserDriver: WebviewDriver = {
  async open({ url, hidden }) {
    const { id } = await InAppBrowser.openWebView({
      url,
      hidden,
      toolbarType: ToolBarType.NAVIGATION,
      title: "Registro",
      // Nascosta ma con dimensioni vere: così le pagine del registro si disegnano e si leggono.
      invisibilityMode: InvisibilityMode.FAKE_VISIBLE,
      // I cookie restano nell'archivio della webview: dalla seconda volta non serve rifare il login.
      showReloadButton: true,
    });
    return id;
  },
  show: (id) => InAppBrowser.show({ id }),
  close: (id) => InAppBrowser.close({ id }),
  run: (id, code) => InAppBrowser.executeScript({ id, code }),
  navigate: async (id, url) => void (await InAppBrowser.setUrl({ id, url })),
  onPageLoaded: (id, fn) => listen(InAppBrowser.addListener("browserPageLoaded", (e) => e.id === id && fn())),
  onMessage: (id, fn) => listen(InAppBrowser.addListener("messageFromWebview", (e) => e.id === id && fn(e.detail))),
  onUrl: (id, fn) => listen(InAppBrowser.addListener("urlChangeEvent", (e) => e.id === id && fn(e.url))),
  onClosed: (id, fn) => listen(InAppBrowser.addListener("closeEvent", (e) => e.id === id && fn())),
};

function listen(handle: Promise<{ remove: () => Promise<void> }>): () => void {
  return () => void handle.then((h) => h.remove()).catch(() => {});
}

/** Dimentica la sessione del registro (cookie) su questo telefono. */
export async function forgetRegistrySession(): Promise<void> {
  await InAppBrowser.clearAllCookies();
  await InAppBrowser.clearCache();
}
