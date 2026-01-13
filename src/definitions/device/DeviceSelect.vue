<template>
  <Hero
    v-if="!outputs.length"
    custom="py-24"
    title="OpenDeck 보드를 찾을 수 없습니다. 사용하려면 보드를 연결해주세요."
  >
    <div class="surface-neutral border px-8 pt-6 rounded">
      <div class="mb-4 flex flex-wrap gap-3">
        <Button class="btn-primary" :disabled="isReloading" @click="rescan">
          {{ isReloading ? "스캔 중…" : "MIDI 다시 스캔" }}
        </Button>
      </div>

      <div class="mt-4 text-sm surface-elevated border rounded px-4 py-3">
        <div class="faded"><strong>상태</strong></div>
        <div class="mt-1">
          outputs={{ outputs.length }} / rawOutputs={{ rawOutputs.length }} / rawInputs={{ rawInputs.length }}
        </div>
        <div v-if="lastRescanAt" class="faded mt-1">
          lastRescan={{ new Date(lastRescanAt).toLocaleString() }}
        </div>
      </div>

      <div v-if="lastEnableError" class="mt-4 text-sm surface-elevated border rounded px-4 py-3">
        <div class="faded"><strong>WebMIDI enable 오류</strong></div>
        <div class="mt-1 break-words">{{ lastEnableError }}</div>
      </div>

      <div v-if="lastConnectionError" class="mt-4 text-sm surface-elevated border rounded px-4 py-3">
        <div class="faded"><strong>장치 연결 오류</strong></div>
        <div class="mt-1 break-words whitespace-pre-line">{{ lastConnectionError }}</div>
      </div>

      <div class="mt-6 text-sm">
        <strong>WebMIDI raw outputs (진단)</strong>
        <div class="mt-2">
          <div
            v-for="o in rawOutputs"
            :key="o.id"
            class="surface-elevated border rounded px-4 py-2 mb-2"
          >
            <div class="faded">{{ o.manufacturer }} • {{ o.state }}</div>
            <div><strong>{{ o.name }}</strong></div>
            <div class="faded">id={{ o.id }}</div>
          </div>
        </div>
      </div>

      <div class="mt-6 text-sm">
        <strong>WebMIDI raw inputs (진단)</strong>
        <div class="mt-2">
          <div
            v-for="i in rawInputs"
            :key="i.id"
            class="surface-elevated border rounded px-4 py-2 mb-2"
          >
            <div class="faded">{{ i.manufacturer }} • {{ i.state }}</div>
            <div><strong>{{ i.name }}</strong></div>
            <div class="faded">id={{ i.id }}</div>
          </div>
        </div>
      </div>
    </div>
  </Hero>
  <Hero
    v-else-if="isOnlyMidiThrough"
    custom="py-24"
    title="'MIDI Through' 포트만 감지됨"
  >
    <div class="surface-neutral border px-8 pt-6 rounded">
      <p>
        OpenDeck UI에는 별도의 ‘MIDI 설정(입력/출력 선택)’ 메뉴가 없고, 이 화면의
        목록에서 장치를 선택하는 방식입니다.
      </p>
      <p class="mt-4">
        지금은 리눅스의 가상 포트인 <strong>MIDI Through</strong>만 보입니다.
        보통 이 경우 USB-MIDI(OpenDeck)가 브라우저/Electron(WebMIDI) 쪽에 노출되지
        않은 상태입니다.
      </p>
      <p class="mt-4">
        확인: 다른 MIDI 프로그램(DAW/모니터)이 장치를 점유 중이면 종료하고,
        OpenDeck USB를 뺐다가 다시 연결한 뒤 이 화면을 새로고침/재실행해보세요.
      </p>

      <p class="mt-4">
        그래도 <strong>MIDI Through</strong>만 나온다면, 일부 리눅스 환경에서는
        Electron 샌드박스 때문에 MIDI 포트 열거가 막힐 수 있습니다. 터미널에서
        아래처럼 실행해보세요:
        <br />
        <code>NO_SANDBOX=1 ./OpenDeckConfigurator</code>
        <br />
        <span class="faded">(또는 <code>./OpenDeckConfigurator --no-sandbox</code>)</span>
      </p>

      <div class="mt-6 flex flex-wrap gap-3">
        <Button class="btn-primary" :disabled="isReloading" @click="rescan">
          {{ isReloading ? "스캔 중…" : "MIDI 다시 스캔" }}
        </Button>
      </div>

      <div class="mt-4 text-sm surface-elevated border rounded px-4 py-3">
        <div class="faded"><strong>상태</strong></div>
        <div class="mt-1">
          outputs={{ outputs.length }} / rawOutputs={{ rawOutputs.length }} / rawInputs={{ rawInputs.length }}
        </div>
        <div v-if="lastRescanAt" class="faded mt-1">
          lastRescan={{ new Date(lastRescanAt).toLocaleString() }}
        </div>
      </div>

      <div v-if="lastEnableError" class="mt-4 text-sm surface-elevated border rounded px-4 py-3">
        <div class="faded"><strong>WebMIDI enable 오류</strong></div>
        <div class="mt-1 break-words">{{ lastEnableError }}</div>
      </div>

      <div v-if="lastConnectionError" class="mt-4 text-sm surface-elevated border rounded px-4 py-3">
        <div class="faded"><strong>장치 연결 오류</strong></div>
        <div class="mt-1 break-words whitespace-pre-line">{{ lastConnectionError }}</div>
      </div>

      <div class="mt-6 text-sm">
        <strong>WebMIDI raw outputs (진단)</strong>
        <div class="mt-2">
          <div
            v-for="o in rawOutputs"
            :key="o.id"
            class="surface-elevated border rounded px-4 py-2 mb-2"
          >
            <div class="faded">{{ o.manufacturer }} • {{ o.state }}</div>
            <div><strong>{{ o.name }}</strong></div>
            <div class="faded">id={{ o.id }}</div>
          </div>
        </div>
      </div>

      <div class="mt-6 text-sm">
        <strong>WebMIDI raw inputs (진단)</strong>
        <div class="mt-2">
          <div
            v-for="i in rawInputs"
            :key="i.id"
            class="surface-elevated border rounded px-4 py-2 mb-2"
          >
            <div class="faded">{{ i.manufacturer }} • {{ i.state }}</div>
            <div><strong>{{ i.name }}</strong></div>
            <div class="faded">id={{ i.id }}</div>
          </div>
        </div>
      </div>
      <div class="mt-6">
        <strong>감지된 포트</strong>
        <div class="mt-2">
          <router-link
            v-for="(output, idx) in outputs"
            :key="output.id"
            :to="{ name: 'device', params: { outputId: output.id } }"
            class="block mb-6 cursor-pointer text-promoted"
            :class="{
              'rounded-t': idx === 0,
              'rounded-b': idx === outputs.length - 1,
              'border-gray-400 border-b': idx < outputs.length - 1,
            }"
          >
            <span class="faded">{{ output.manufacturer || "unknown manufacturer" }}</span>
            <br />
            <strong>{{ output.name || output.id || "(unnamed device)" }}</strong>
          </router-link>
        </div>
      </div>
    </div>
  </Hero>
  <Hero
    v-else-if="outputs.length > 1"
    custom="h-64"
    title="여러 OpenDeck 보드가 감지되었습니다. 한 번에 하나의 보드만 연결해주세요."
  >
    <div v-if="lastConnectionError" class="surface-neutral border px-8 pt-6 rounded">
      <div class="text-sm surface-elevated border rounded px-4 py-3">
        <div class="faded"><strong>장치 연결 오류</strong></div>
        <div class="mt-1 break-words whitespace-pre-line">{{ lastConnectionError }}</div>
      </div>
    </div>
  </Hero>
  <Hero v-else custom="py-24">
    <div class="surface-neutral border px-8 pt-6 rounded">
      <div class="mb-4 flex flex-wrap gap-3">
        <Button class="btn-primary" @click="rescan">MIDI 다시 스캔</Button>
      </div>

      <div v-if="lastConnectionError" class="mb-4 text-sm surface-elevated border rounded px-4 py-3">
        <div class="faded"><strong>장치 연결 오류</strong></div>
        <div class="mt-1 break-words whitespace-pre-line">{{ lastConnectionError }}</div>
      </div>

      <router-link
        v-for="(output, idx) in outputs"
        :key="output.id"
        :to="{ name: 'device', params: { outputId: output.id } }"
        class="block mb-6 cursor-pointer text-promoted"
        :class="{
          'rounded-t': idx === 0,
          'rounded-b': idx === outputs.length - 1,
          'border-gray-400 border-b': idx < outputs.length - 1,
        }"
      >
        <span class="faded">{{ output.manufacturer || "unknown manufacturer" }}</span>
        <br />
        <strong>{{ output.name || output.id || "(unnamed device)" }}</strong>
      </router-link>
    </div>
  </Hero>
</template>

<script lang="ts">
import { defineComponent, onMounted, computed } from "vue";
import { midiStoreMapped, deviceStoreMapped } from "../../store";
import router from "../../router";

export default defineComponent({
  name: "DeviceSelect",
  setup() {
    const isGenericThroughPort = (name: string): boolean =>
      /\bmidi\s*(thru|through)\b/i.test(name);

    const rescan = async (): Promise<void> => {
      try {
        deviceStoreMapped.clearLastConnectionError();

        // User explicitly requested device selection/rescan.
        // Force "device select" mode so midi connection watcher won't auto-redirect
        // to a single detected device page mid-refresh.
        const current = router.currentRoute.value;
        if (current.name === "home" && current.query?.select !== "1") {
          await router.replace({
            name: "home",
            query: { ...current.query, select: "1" },
          });
        }

        await midiStoreMapped.reloadMidi();
      } catch (_) {
        // ignore; App.vue will show connection state
      }
    };

    onMounted(() => {
      midiStoreMapped
        .loadMidi()
        .catch(() => {
          // UI will show "Problem connecting" in App.vue
        })
        .finally(() => {
          midiStoreMapped.assignInputs();
          midiStoreMapped.startMidiConnectionWatcher();
        });

      // Note: this should be in Device.vue onUnmounted, but it is unreliable for some reason
      deviceStoreMapped.closeConnection();
    });

    return {
      outputs: midiStoreMapped.outputs,
      rawInputs: midiStoreMapped.rawInputs,
      rawOutputs: midiStoreMapped.rawOutputs,
      lastEnableError: midiStoreMapped.lastEnableError,
      lastRescanAt: midiStoreMapped.lastRescanAt,
      lastConnectionError: deviceStoreMapped.lastConnectionError,
      isReloading: midiStoreMapped.isReloading,
      rescan,
      isOnlyMidiThrough: computed(
        () =>
          midiStoreMapped.outputs.length > 0 &&
          midiStoreMapped.outputs.every((o) => isGenericThroughPort(o.name)),
      ),
    };
  },
});
</script>
