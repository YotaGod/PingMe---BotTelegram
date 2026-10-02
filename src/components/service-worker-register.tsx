"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) =>
                [
                  registration.active,
                  registration.waiting,
                  registration.installing,
                ].some(
                  (worker) =>
                    worker && new URL(worker.scriptURL).pathname === "/sw.js",
                ),
              )
              .map((registration) => registration.unregister()),
          ),
        );
      void caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("smart-reminder-"))
              .map((key) => caches.delete(key)),
          ),
        );
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  return null;
}
