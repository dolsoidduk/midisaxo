import type { RouteRecordRaw } from "vue-router";
import MidiSaxophone from "./views/MidiSaxophone.vue";

export const midisaxophoneRoutes: RouteRecordRaw[] = [
  {
    name: "midisaxophone",
    path: "/midisaxophone",
    component: MidiSaxophone,
  },
];
