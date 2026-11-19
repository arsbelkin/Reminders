/// <reference lib="webworker" />

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';

import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
};

// Кеширование файлов приложения.
precacheAndRoute(self.__WB_MANIFEST);

// Удаление устаревших кешей предзагрузки.
cleanupOutdatedCaches();

// Возвращаем index.html для маршрутов Angular.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api(?:\/|$)/, /^\/_\//],
  }),
);

// После активации начинаем управлять открытыми страницами.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
