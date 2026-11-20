"use strict";

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  // Change the script URL when shipping a worker fix so browsers with a stale
  // active worker install this build instead of continuing to control with it.
  const registration = await navigator.serviceWorker.register(
        "/sw.js?v=noxveil-route-20261119-3",
    {
    scope: "/",
    updateViaCache: "none",
    },
  );
  await registration.update().catch(() => {});
  await navigator.serviceWorker.ready;

  const installing = registration.installing || registration.waiting;
  if (installing) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        installing.removeEventListener("statechange", onStateChange);
        reject(new Error("Service worker update timed out."));
      }, 10000);
      function onStateChange() {
        if (installing.state === "activated" || installing.state === "redundant") {
          clearTimeout(timeout);
          installing.removeEventListener("statechange", onStateChange);
          resolve();
        }
      }
      installing.addEventListener("statechange", onStateChange);
      onStateChange();
    });
  }

  // A page may still be controlled by the previous active worker while an
  // update activates. Any controller for this root scope can serve Scramjet;
  // requiring object identity with registration.active can time out in Chrome.
  if (!navigator.serviceWorker.controller) {
    // On a first visit, activation can finish before this document is claimed.
    // Ask the active worker to claim again instead of only waiting for an event
    // that may already have fired.
    registration.active?.postMessage({ type: "noxveil:claim-client" });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(poll);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        // First-load control can be missed on some browser profiles. Reload once
        // so the now-active worker controls the next document navigation.
        try {
          const key = "noxveil:sw-control-reload";
          if (sessionStorage.getItem(key) !== "1") {
            sessionStorage.setItem(key, "1");
            sessionStorage.setItem("noxveil:sw-did-reload", "1");
            location.reload();
            return;
          }
        } catch {}
        reject(new Error("Service worker did not take control after recovery reload."));
      }, 10000);
      let poll;
      function onControllerChange() {
        if (navigator.serviceWorker.controller) {
          clearTimeout(timeout);
          clearInterval(poll);
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
          resolve();
        }
      }
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      poll = setInterval(onControllerChange, 100);
      onControllerChange();
    });
  }

  return registration;
}
