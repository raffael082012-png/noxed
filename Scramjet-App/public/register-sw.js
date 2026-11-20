"use strict";

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
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
        reject(new Error("Service worker did not take control."));
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
