import { createRouter, createWebHashHistory } from "vue-router";
import { DeviceRoutes } from "./definitions/device";
import MidiSaxophone from "./definitions/midisaxophone/MidiSaxophone.vue";

const history = createWebHashHistory();
export const router = createRouter({
  history,
  routes: [
    ...DeviceRoutes,
    {
      name: "midisaxophone",
      path: "/midisaxophone",
      component: MidiSaxophone,
    },
  ],
});

export default router;
