"use strict";

async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  await navigator.serviceWorker.ready;

  if (!navigator.serviceWorker.controller) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        reject(new Error("Service worker did not take control."));
      }, 10000);
      function onControllerChange() {
        clearTimeout(timeout);
        resolve();
      }
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
      if (navigator.serviceWorker.controller) onControllerChange();
    });
  }

  return registration;
}
