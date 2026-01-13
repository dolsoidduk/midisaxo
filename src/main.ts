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

registerComponentMap(appComponents);
registerComponentMap(deviceComponents);

app.use(router);
app.mount("#app");

// Workaround: On some Linux/Electron setups, the first paint can miss text
// until the first user interaction (click/resize). Trigger a tiny reflow and
// a resize event after the initial render to force the compositor to repaint.
try {
  const forceRepaint = () => {
    const el = document.body as HTMLElement | null;
    if (!el) {
      return;
    }

    const prevTransform = el.style.transform;
    el.style.transform = "translateZ(0)";
    // Force synchronous layout
    void el.offsetHeight;
    el.style.transform = prevTransform;

    window.dispatchEvent(new Event("resize"));
  };

  const scheduleForceRepaint = () => {
    requestAnimationFrame(() => requestAnimationFrame(forceRepaint));
  };

  // Run once on boot
  scheduleForceRepaint();

  // Run after navigation (the issue can reappear when re-entering a view)
  router.afterEach(() => {
    scheduleForceRepaint();
  });

  // Also run when the window gains focus
  window.addEventListener("focus", scheduleForceRepaint);
} catch (_) {
  // ignore
}
