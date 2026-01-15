import type { RouteRecordRaw } from "vue-router";

import MidiBankChanger from "./views/MidiBankChanger.vue";

export const midiBankChangerRoutes: RouteRecordRaw[] = [
  {
    name: "midi-bank-changer",
    path: "/midi-bank-changer",
    component: MidiBankChanger,
  },
];
