/**
 * Preferenze di interfaccia salvate sul dispositivo (localStorage) e applicate
 * a <html> da uno script inline prima del primo paint: niente flash di tema
 * sbagliato o di sidebar che si richiude al caricamento.
 */

export type ThemePreference = "light" | "dark" | "system";

export const THEME_KEY = "schoolos-theme";
export const SIDEBAR_KEY = "schoolos-sidebar";
export const PREFERENCES_EVENT = "schoolos:preferences";

/** Script inline per <head>. Deve restare piccolo e senza dipendenze. */
export const PREFERENCES_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("${THEME_KEY}")||"system",k=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);d.classList.toggle("dark",k);if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")d.setAttribute("data-sidebar","collapsed")}catch(e){}})()`;
