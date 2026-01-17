import "./themes/dark/index.css";
import { createApp } from "vue";
import router from "./router";
import appComponents from "./components/app-components";
import deviceComponents from "./definitions/device/device-components";
import App from "./components/App.vue";

type IComponentMap = Record<string, any>;

const registerComponentMap = (componentMap: IComponentMap) =>
  Object.keys(componentMap).forEach((key) => {
    app.component(key, componentMap[key]);
  });

const app = createApp(App);

if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) {
  app.config.errorHandler = (err, instance, info) => {
    // Keep default console visibility, but also surface it in the UI for debugging.
    // eslint-disable-next-line no-console
    console.error("[Vue errorHandler]", err, info, instance);
    (window as any).__lastVueError = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      info,
    };
  };
}

registerComponentMap(appComponents);
registerComponentMap(deviceComponents);

app.use(router);
app.mount("#app");
