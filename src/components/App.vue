<template>
  <div class="app">
    <nav class="app-header">
      <router-link :to="{ name: 'home' }" class="app-brand">
        OpenDeck Configurator
      </router-link>

      <div class="ml-4 flex items-center gap-4 text-sm">
        <router-link
          :to="{ name: 'midisaxophone' }"
          class="text-gray-400 hover:text-gray-200"
        >
          MIDI 색소폰
        </router-link>
        <router-link
          :to="{ name: 'midi-bank-changer' }"
          class="text-gray-400 hover:text-gray-200"
        >
          Bank Changer
        </router-link>
      </div>

      <span v-if="!isHomePage && boardName" class="app-board-info">
        <template v-if="isBootloaderMode">OpenDeck DFU mode</template>
        <template v-else>
          <small>Board</small>
          <strong>{{ boardName }}</strong>

          <template v-if="firmwareVersion !== null">
            <small>Firmware</small>
            <strong>{{ firmwareVersion }}</strong>
          </template>

          <template v-if="supportedPresetsCount > 1">
            <small>Preset</small>
            <strong>{{ activePreset + 1 }}</strong>
          </template>
        </template>
      </span>
    </nav>

    <div class="app-main">
      <div class="content">
        <div v-if="lastVueError" class="w-full px-4 sm:px-6 lg:px-8 pt-4">
          <div class="surface-neutral border border-red-700/60 rounded px-4 py-3 text-sm">
            <div class="text-red-300 font-semibold">UI 런타임 오류로 화면이 비었을 수 있어요</div>
            <div class="mt-1 text-red-200/90 text-xs whitespace-pre-wrap">{{ lastVueError.message }}</div>
            <div v-if="lastVueError.info" class="mt-1 text-red-200/70 text-[11px] whitespace-pre-wrap">
              {{ lastVueError.info }}
            </div>
          </div>
        </div>

        <div
          v-if="!isWebMidiSupported && isStandaloneFeaturePage && !forceUiWithoutWebMidi"
          class="w-full px-4 sm:px-6 lg:px-8 pt-4"
        >
          <div class="surface-neutral border border-yellow-700/60 rounded px-4 py-3 text-sm">
            <div class="text-yellow-200 font-semibold">WebMIDI 미지원: UI만 표시합니다</div>
            <div class="mt-1 text-yellow-100/90 text-xs">
              현재 브라우저에서는 WebMIDI가 동작하지 않아 일부 기능은 제한될 수 있습니다.
            </div>
          </div>
        </div>

        <Section v-if="!isWebMidiSupported && !forceUiWithoutWebMidi && !isStandaloneFeaturePage" class="h-screen">
          <div class="w-full px-4 pt-24 sm:px-6 lg:px-8">
            <p class="">
              This browser does not support WebMIDI.<br />Please use a Chrome
              based browser:
            </p>
            <p class="mt-4">
              <a href="https://www.google.com/chrome/index.html"
                >Google Chrome</a
              ><br />
              <a href="https://brave.com/">Brave</a><br />
              <a href="https://vivaldi.com/">Vivaldi</a><br />
              <a href="https://www.microsoft.com/en-us/edge">Microsoft Edge</a
              ><br />
            </p>
          </div>
        </Section>

        <div
          v-else-if="forceUiWithoutWebMidi && !isWebMidiSupported"
          class="w-full px-4 sm:px-6 lg:px-8 pt-4"
        >
          <div class="surface-neutral border border-yellow-700/60 rounded px-4 py-3 text-sm">
            <div class="text-yellow-200 font-semibold">WebMIDI 비활성 상태로 UI 미리보기</div>
            <div class="mt-1 text-yellow-100/90 text-xs">
              현재 브라우저에서는 WebMIDI가 동작하지 않지만, 화면 확인을 위해 강제로 UI를 표시했습니다.
              (URL에 <span class="font-mono">?forceUi=1</span> 사용)
            </div>
          </div>
          <router-view />
        </div>

        <router-view v-else-if="isStandaloneFeaturePage" />

        <Section
          v-else-if="isConnecting"
          class="h-screen"
          title="Establishing connection"
        >
          <div
            class="lg:text-center w-full px-4 sm:px-6 lg:px-8"
          >
            <p>WebMidi connecting</p>
          </div>
          <div class="absolute flex inset-0 opacity-75 bg-gray-900">
            <Spinner class="self-center" />
          </div>
        </Section>

        <Section
          v-else-if="!isConnected"
          class="h-screen"
          title="Problem connecting"
        >
          <div
            class="lg:text-center w-full px-4 pt-24 sm:px-6 lg:px-8"
          >
            <p class="text-lg text-gray-100">WebMIDI 연결에 실패했습니다.</p>
            <p class="mt-3 text-gray-300">
              브라우저는 보안/권한 정책 때문에 “사용자 클릭(gesture)” 없이 MIDI 접근을
              막는 경우가 많습니다.
            </p>
            <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
              <router-link
                :to="{ name: 'home' }"
                class="px-4 py-2 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
              >
                홈으로 이동
              </router-link>
              <span class="text-gray-400 text-sm">
                홈에서 <strong>Reload WebMidi</strong>를 눌러 권한 팝업(MIDI+SysEx)을
                허용해보세요.
              </span>
            </div>
          </div>
        </Section>

        <router-view v-else />
      </div>
    </div>

    <div class="app-footer">
      <div class="app-footer-wrap">
        <nav class="app-about">
          <h3 class="heading">About</h3>
          <p class="text-sm">
            OpenDeck Configurator는 OpenDeck 펌웨어를 실행하는 모든 MIDI 장치를 위한
            WebMIDI 기반 구성 도구입니다. OpenDeck은 프로토타입 제작 및 맞춤형 MIDI
            컨트롤러 개발에 적합한 플랫폼입니다.
          </p>
        </nav>
        <nav class="app-resources">
          <h3 class="heading">Resources</h3>
          <ul class="list">
            <li>
              <router-link :to="{ name: 'midisaxophone' }"
                >MIDI 색소폰</router-link
              >
            </li>
            <li>
              <router-link :to="{ name: 'midi-bank-changer' }"
                >MIDI Bank Changer</router-link
              >
            </li>
            <li>
              <a href="https://github.com/dolsoidduk/OpenDeck"
                >OpenDeck GitHub 저장소</a
              >
            </li>
            <li>
              <a href="https://shanteacontrols.com/"
                >Shantea Controls 공식 웹사이트</a
              >
            </li>
            <li v-if="buildShaShort || buildTime" class="text-xs text-gray-500">
              Build:
              <span v-if="buildShaShort" class="ml-1 font-mono">{{ buildShaShort }}</span>
              <span v-if="buildTime" class="ml-2">{{ buildTime }}</span>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, onMounted, onUnmounted } from "vue";
import { midiStoreMapped, deviceStoreMapped } from "../store";
import router from "../router";

export default defineComponent({
  name: "App",
  setup() {
    const {
      outputId,
      boardName,
      firmwareVersion,
      activePreset,
    } = deviceStoreMapped;
    const isHomePage = computed(
      () => router.currentRoute.value.name === "home",
    );

    const isStandaloneFeaturePage = computed(() => {
      const name = router.currentRoute.value.name;
      return (
        name === "midisaxophone" ||
        name === "midi-bank-changer"
      );
    });

    const { isConnected, isConnecting, isWebMidiSupported } = midiStoreMapped;
    const { supportedPresetsCount, isBootloaderMode } = deviceStoreMapped;

    const forceUiWithoutWebMidi = computed(() => {
      try {
        // Works with hash routing: /index.html?forceUi=1#/midisaxophone
        const params = new URLSearchParams(window.location.search || "");
        return (
          params.has("forceUi") ||
          params.has("forceUI") ||
          params.has("noWebMidi") ||
          // Convenience: allow opening capture UI without WebMIDI in constrained browsers.
          params.has("capture") ||
          params.has("captureOnly")
        );
      } catch {
        return false;
      }
    });

    const lastVueError = computed(() => {
      const w = window as any;
      return w && w.__lastVueError ? w.__lastVueError : null;
    });

    const buildSha = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BUILD_SHA) || "";
    const buildTime = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BUILD_TIME) || "";
    const buildShaShort = computed(() => (buildSha ? String(buildSha).slice(0, 8) : ""));

    onMounted(() => {
      midiStoreMapped.startMidiConnectionWatcher();

      // Convenience deep-link: /?capture=1 => go straight to sax page.
      try {
        const params = new URLSearchParams(window.location.search || "");
        const wantsCapture = params.has("capture") || params.has("captureOnly");
        if (wantsCapture && router.currentRoute.value.name !== "midisaxophone") {
          router.replace({ name: "midisaxophone" }).catch(() => void 0);
        }
      } catch {
        // ignore
      }
    });

    onUnmounted(() => {
      midiStoreMapped.stopMidiConnectionWatcher();
    });

    return {
      isHomePage,
      isStandaloneFeaturePage,
      outputId,
      isWebMidiSupported,
      forceUiWithoutWebMidi,
      lastVueError,
      isConnected,
      isConnecting,
      boardName,
      firmwareVersion,
      activePreset,
      supportedPresetsCount,
      isBootloaderMode,
      buildShaShort,
      buildTime,
    };
  },
});
</script>
