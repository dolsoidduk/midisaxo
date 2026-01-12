import { createRouter, createWebHashHistory } from "vue-router";
import { deviceRoutes } from "./features/device/routes";
import { midiBankChangerRoutes } from "./features/midi-bank-changer/routes";
import { midisaxophoneRoutes } from "./features/midisaxophone/routes";

const history = createWebHashHistory();
export const router = createRouter({
  history,
  routes: [
    ...deviceRoutes,
    ...midisaxophoneRoutes,
    ...midiBankChangerRoutes,
    // Fallback: if the hash URL doesn't match any route, go to the device select.
    { path: "/:pathMatch(.*)*", redirect: { name: "home" } },
  ],
});

export default router;

