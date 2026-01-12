<template>
  <div class="app">
    <nav class="app-header">
      <router-link :to="{ name: 'home' }" class="app-brand">
        OpenDeck Configurator
      </router-link>

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
        <Section v-if="!isWebMidiSupported" class="h-screen">
          <div class="max-w-screen-sm mx-auto px-4 pt-24 sm:px-6 lg:px-8">
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

        <router-view v-else-if="isStandaloneFeaturePage" />

        <Section
          v-else-if="isConnecting"
          class="h-screen"
          title="Establishing connection"
        >
          <div
            class="lg:text-center max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8"
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
            class="lg:text-center max-w-screen-xl mx-auto px-4 pt-24 sm:px-6 lg:px-8"
          >
            <p>WebMidi failed to conect</p>
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
              <a href="https://github.com/paradajz/OpenDeck"
                >OpenDeck GitHub 저장소</a
              >
            </li>
            <li>
              <a href="https://shanteacontrols.com/"
                >Shantea Controls 공식 웹사이트</a
              >
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

    onMounted(() => {
      midiStoreMapped.startMidiConnectionWatcher();
    });

    onUnmounted(() => {
      midiStoreMapped.stopMidiConnectionWatcher();
    });

    return {
      isHomePage,
      isStandaloneFeaturePage,
      outputId,
      isWebMidiSupported,
      isConnected,
      isConnecting,
      boardName,
      firmwareVersion,
      activePreset,
      supportedPresetsCount,
      isBootloaderMode,
    };
  },
});
</script>
