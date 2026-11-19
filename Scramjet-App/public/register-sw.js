"use strict";

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
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

  if (
    !navigator.serviceWorker.controller ||
    (registration.active && navigator.serviceWorker.controller !== registration.active)
  ) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        reject(new Error("Service worker did not take control."));
      }, 10000);
      function onControllerChange() {
        if (!registration.active || navigator.serviceWorker.controller === registration.active) {
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
          resolve();
        }
      }
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      onControllerChange();
    });
  }

  return registration;
}
