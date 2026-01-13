<template>
  <div class="app">
    <nav class="app-header">
      <router-link
        :to="{ name: 'home', query: { select: '1' } }"
        class="app-brand"
      >
        OpenDeck Configurator
      </router-link>

      <span class="app-board-info">
        <router-link
          :to="{ name: 'home', query: { select: '1' } }"
          class="btn btn-xs"
        >
          장치 선택
        </router-link>

        <template v-if="!isHomePage && boardName">
          <template v-if="isBootloaderMode">OpenDeck DFU mode</template>
          <template v-else>
            <small>보드</small>
            <strong>{{ boardName }}</strong>

            <template v-if="firmwareVersion !== null">
              <small>펌웨어</small>
              <strong>{{ firmwareVersion }}</strong>
            </template>

            <template v-if="supportedPresetsCount > 1">
              <small>프리셋</small>
              <strong>{{ activePreset + 1 }}</strong>
            </template>
          </template>
        </template>
      </span>
    </nav>

    <div class="app-main">
      <div class="content">
        <Section v-if="!isWebMidiSupported" class="h-screen">
          <div class="max-w-screen-sm mx-auto px-4 pt-24 sm:px-6 lg:px-8">
            <p class="">
              이 브라우저는 WebMIDI를 지원하지 않습니다.<br />Chrome 기반 브라우저를
              사용해주세요:
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

        <router-view v-else-if="isMidiSaxophonePage" />

        <div v-else>
          <Hero v-if="isConnecting" custom="py-10" title="WebMIDI 연결 중">
            <div class="surface-neutral border px-8 pt-6 rounded">
              <p>잠시만 기다려주세요. 포트 목록을 계속 표시합니다.</p>
              <div class="mt-4">
                <Spinner />
              </div>
            </div>
          </Hero>

          <Hero
            v-else-if="!isConnected"
            custom="py-16"
            title="WebMIDI 연결 실패"
          >
            <div class="surface-neutral border px-8 pt-6 rounded">
              <p>
                미디 장치 선택(출력 선택)은 별도 메뉴가 아니라 홈 화면에서
                합니다. 상단의 <strong>장치 선택</strong> 버튼으로 돌아갈 수
                있습니다.
              </p>
              <p class="mt-4">
                이 메시지는 WebMIDI 초기화가 실패했을 때 표시됩니다.
              </p>
              <div class="mt-6 flex flex-wrap gap-3">
                <Button class="btn-primary" @click="retryMidi">다시 시도</Button>
              </div>
            </div>
          </Hero>

          <router-view />
        </div>
      </div>
    </div>

    <div class="app-footer">
      <div class="app-footer-wrap">
        <nav class="app-about">
          <h3 class="heading">소개</h3>
          <p class="text-sm">
            OpenDeck Configurator는 OpenDeck 펌웨어를 실행하는 모든 MIDI 장치를 위한
            WebMIDI 기반 구성 도구입니다. OpenDeck은 프로토타입 제작 및 맞춤형 MIDI
            컨트롤러 개발에 적합한 플랫폼입니다.
          </p>
        </nav>
        <nav class="app-resources">
          <h3 class="heading">리소스</h3>
          <ul class="list">
            <li>
              <router-link :to="{ name: 'midisaxophone' }"
                >MIDI 색소폰</router-link
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

          <p v-if="buildId" class="text-xs mt-4 faded">
            Build: <strong class="text-promoted">{{ buildId }}</strong>
          </p>
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
    const buildId =
      (window as any)?.__OPENDECK_BUILD_ID__ ||
      (import.meta as any)?.env?.VITE_BUILD_ID ||
      "";
    const {
      outputId,
      boardName,
      firmwareVersion,
      activePreset,
    } = deviceStoreMapped;
    const isHomePage = computed(
      () => router.currentRoute.value.name === "home",
    );

    const isMidiSaxophonePage = computed(
      () => router.currentRoute.value.name === "midisaxophone",
    );

    const { isConnected, isConnecting, isWebMidiSupported } = midiStoreMapped;
    const { supportedPresetsCount, isBootloaderMode } = deviceStoreMapped;


    onMounted(() => {
      // Let the first frame paint before starting WebMIDI initialization.
      // This reduces the chance of an initially blank/invisible UI until user clicks.
      requestAnimationFrame(() => {
        midiStoreMapped.loadMidi();
      });
    });

    onUnmounted(() => {
      midiStoreMapped.stopMidiConnectionWatcher();
    });


    const retryMidi = async (): Promise<void> => {
      try {
        await midiStoreMapped.loadMidi();
      } catch (_) {
        // keep UI responsive; Hero message already explains the state
      } finally {
        await midiStoreMapped.assignInputs();
        midiStoreMapped.startMidiConnectionWatcher();
      }
    };

    return {
      isHomePage,
      isMidiSaxophonePage,
      outputId,
      isWebMidiSupported,
      isConnected,
      isConnecting,
      boardName,
      firmwareVersion,
      activePreset,
      supportedPresetsCount,
      isBootloaderMode,
      retryMidi,
      buildId,
    };
  },
});
</script>
