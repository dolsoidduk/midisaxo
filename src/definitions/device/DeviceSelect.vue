<template>
  <Hero
    v-if="!outputs.length"
    custom="h-64"
    title="No OpenDeck board found. Please connect the board in order to use the
      interface."
  />
  <Hero
    v-else-if="outputs.length > 1"
    custom="h-64"
    title="Multiple OpenDeck boards detected. Please connect one board at the time in
      order to use configurator."
  />
  <Hero v-else custom="py-24">
    <div class="surface-neutral border px-8 pt-6 rounded">
      <router-link
        v-for="(output, idx) in outputs"
        :key="output.id"
        :to="{ name: 'device', params: { outputId: output.id } }"
        class="block mb-6 cursor-pointer"
        :class="{
          'rounded-t': idx === 0,
          'rounded-b': idx === outputs.length - 1,
          'border-gray-400 border-b': idx < outputs.length - 1,
        }"
      >
        <span>{{ output.manufacturer || "unknown manufacturer" }}</span>
        <br />
        <strong>{{ output.name }}</strong>
      </router-link>
    </div>

    <div class="mt-6 surface-neutral border px-6 py-4 rounded text-sm">
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="px-2 py-1 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
          :disabled="isReloadingWebMidi"
          @click="reloadWebMidi"
        >
          Reload WebMidi
        </button>
        <button
          type="button"
          class="px-2 py-1 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
          :disabled="isReloadingWebMidi || !nativeSupported"
          @click="requestSysexAndReload"
          title="브라우저에서 SysEx 권한(sysex=true)을 먼저 요청한 뒤 WebMIDI를 다시 로드합니다."
        >
          SysEx 권한 요청 + Reload
        </button>
        <button
          type="button"
          class="px-2 py-1 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
          @click="showMidiDebug = !showMidiDebug"
        >
          {{ showMidiDebug ? "Hide MIDI debug" : "Show MIDI debug" }}
        </button>
      </div>

      <div v-if="showMidiDebug" class="mt-4">
        <div class="flex flex-wrap items-center gap-3">
          <strong class="text-gray-200">MIDI debug</strong>
          <span class="text-gray-400">tag: {{ midiDebug.tag }}</span>
          <span class="text-gray-400">supported: {{ midiDebug.supported }}</span>
          <span class="text-gray-400">enabled: {{ midiDebug.enabled }}</span>
          <span class="text-gray-400">secure: {{ isSecureContext }}</span>
          <button
            type="button"
            class="px-2 py-1 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
            @click="copyMidiDiagnostic"
          >
            Copy diagnostic
          </button>
        </div>

        <p v-if="midiDebug.hasOnlyGenericThrough" class="mt-2 text-yellow-300">
          현재 WebMIDI(webmidi.js)가 "MIDI Through" 포트만 보고 있는 상태입니다.
        </p>

        <p v-if="nativeHasOnlyGenericThrough" class="mt-2 text-yellow-300">
          또한 네이티브 WebMIDI(MIDIAccess)도 "MIDI Through"만 보입니다. 이 경우는 UI 필터링 문제가 아니라
          브라우저가 실행되는 OS에서 실제 MIDI 장치를 못 보고 있는 상태일 가능성이 큽니다.
          (VS Code Dev Container/원격 환경이라면, 컨테이너에서 보이는 장치와 브라우저가 보는 장치가 다를 수 있습니다.)
        </p>

        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <div class="font-semibold text-gray-200 mb-2">
              inputs (raw)
            </div>
            <div v-if="!midiDebug.inputs.length" class="text-gray-400">
              (none)
            </div>
            <div v-for="p in midiDebug.inputs" :key="p.id" class="mb-2">
              <div class="text-gray-400">{{ p.manufacturer }}</div>
              <div class="text-gray-200">{{ p.name }}</div>
              <div class="text-gray-500">id={{ p.id }} state={{ p.state }}</div>
            </div>
          </div>

          <div>
            <div class="font-semibold text-gray-200 mb-2">
              outputs (raw)
            </div>
            <div v-if="!midiDebug.outputs.length" class="text-gray-400">
              (none)
            </div>
            <div v-for="p in midiDebug.outputs" :key="p.id" class="mb-2">
              <div class="text-gray-400">{{ p.manufacturer }}</div>
              <div class="text-gray-200">{{ p.name }}</div>
              <div class="text-gray-500">id={{ p.id }} state={{ p.state }}</div>
            </div>
          </div>
        </div>

        <div class="mt-6 border-t border-gray-700 pt-4">
          <div class="flex flex-wrap items-center gap-3">
            <strong class="text-gray-200">Native WebMIDI debug</strong>
            <span class="text-gray-400">supported: {{ nativeSupported }}</span>
            <span class="text-gray-400">sysex: {{ nativeSysex ? "true" : "false" }}</span>
            <span v-if="nativeError" class="text-red-300">error: {{ nativeError }}</span>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-3 text-gray-400">
            <span>origin: {{ origin }}</span>
            <span v-if="midiPermission">perm(midi): {{ midiPermission }}</span>
            <span v-if="midiSysexPermission">perm(midi+sysex): {{ midiSysexPermission }}</span>
            <span v-if="midiPermissionError" class="text-red-300">perm error: {{ midiPermissionError }}</span>
          </div>

          <div v-if="nativeSupported" class="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              class="px-2 py-1 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
              @click="requestNativeMidiAccess(false)"
            >
              Refresh (sysex=false)
            </button>
            <button
              type="button"
              class="px-2 py-1 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
              @click="requestNativeMidiAccess(true)"
            >
              Request sysex=true
            </button>
          </div>

          <div class="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <div class="font-semibold text-gray-200 mb-2">inputs (MIDIAccess)</div>
              <div v-if="!nativeInputs.length" class="text-gray-400">(none)</div>
              <div v-for="p in nativeInputs" :key="p.id" class="mb-2">
                <div class="text-gray-400">{{ p.manufacturer }}</div>
                <div class="text-gray-200">{{ p.name }}</div>
                <div class="text-gray-500">
                  id={{ p.id }} state={{ p.state }} conn={{ p.connection }}
                </div>
              </div>
            </div>

            <div>
              <div class="font-semibold text-gray-200 mb-2">outputs (MIDIAccess)</div>
              <div v-if="!nativeOutputs.length" class="text-gray-400">(none)</div>
              <div v-for="p in nativeOutputs" :key="p.id" class="mb-2">
                <div class="text-gray-400">{{ p.manufacturer }}</div>
                <div class="text-gray-200">{{ p.name }}</div>
                <div class="text-gray-500">
                  id={{ p.id }} state={{ p.state }} conn={{ p.connection }}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4">
            <div class="font-semibold text-gray-200 mb-2">statechange log (MIDIAccess)</div>
            <div v-if="!nativeStateChanges.length" class="text-gray-400">(no events yet)</div>
            <div v-for="(e, idx) in nativeStateChanges" :key="idx" class="mb-2">
              <div class="text-gray-500">{{ e.ts }}</div>
              <div class="text-gray-200">{{ e.type }}: {{ e.name }}</div>
              <div class="text-gray-500">
                id={{ e.id }} state={{ e.state }} conn={{ e.connection }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Hero>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, unref, computed } from "vue";
import { midiStoreMapped, deviceStoreMapped } from "../../store";

export default defineComponent({
  name: "DeviceSelect",
  setup() {
    const nativeError = ref<string | null>(null);
    const nativeInputs = ref<any[]>([]);
    const nativeOutputs = ref<any[]>([]);
    const nativeSysex = ref<boolean>(false);
    const nativeAccess = ref<any | null>(null);
    const nativeStateChanges = ref<any[]>([]);
    const origin = ref<string>(typeof window !== "undefined" ? window.location.origin : "");
    const midiPermission = ref<string>("");
    const midiSysexPermission = ref<string>("");
    const midiPermissionError = ref<string>("");
    const isReloadingWebMidi = ref<boolean>(false);
    const showMidiDebug = ref<boolean>(false);
    const nativeSupported = ref<boolean>(
      typeof navigator !== "undefined" && typeof (navigator as any).requestMIDIAccess === "function",
    );

    const refreshMidiPermissions = () => {
      midiPermission.value = "";
      midiSysexPermission.value = "";
      midiPermissionError.value = "";

      const permissions = (navigator as any)?.permissions;
      if (!permissions?.query) {
        return;
      }

      Promise.all([
        permissions.query({ name: "midi", sysex: false }),
        permissions.query({ name: "midi", sysex: true }),
      ])
        .then(([midi, midiSysex]: any[]) => {
          midiPermission.value = String(midi?.state || "");
          midiSysexPermission.value = String(midiSysex?.state || "");
        })
        .catch((err: any) => {
          midiPermissionError.value = String(err?.message || err || "unknown error");
        });
    };

    const copyMidiDiagnostic = async () => {
      const webmidiDebug = unref(midiStoreMapped.debug);
      const payload = {
        ts: new Date().toISOString(),
        origin: origin.value,
        secureContext: typeof window !== "undefined" ? window.isSecureContext : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        platform: typeof navigator !== "undefined" ? (navigator as any).platform || "" : "",
        midiPermission: midiPermission.value,
        midiSysexPermission: midiSysexPermission.value,
        midiPermissionError: midiPermissionError.value,
        webmidiJs: webmidiDebug,
        nativeWebmidi: {
          supported: nativeSupported.value,
          sysex: nativeSysex.value,
          error: nativeError.value,
          inputs: nativeInputs.value,
          outputs: nativeOutputs.value,
          stateChanges: nativeStateChanges.value,
        },
      };

      const text = JSON.stringify(payload, null, 2);

      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return;
        }
      } catch {
        // fall through
      }

      // Fallback: prompt so the user can copy manually.
      // eslint-disable-next-line no-alert
      window.prompt("Copy MIDI diagnostic:", text);
    };

    const requestNativeMidiAccess = async (sysex: boolean) => {
      nativeError.value = null;
      nativeSysex.value = sysex;
      nativeAccess.value = null;

      if (typeof (navigator as any)?.requestMIDIAccess !== "function") {
        nativeError.value = "requestMIDIAccess is not available";
        nativeInputs.value = [];
        nativeOutputs.value = [];
        return;
      }

      const updateSnapshot = (access: any) => {
        const toSummary = (port: any) => ({
          id: port.id,
          name: port.name,
          manufacturer: port.manufacturer || "(unknown manufacturer)",
          state: port.state || "(unknown state)",
          connection: port.connection || "(unknown connection)",
          type: port.type,
        });

        nativeInputs.value = Array.from(access.inputs?.values?.() || []).map(toSummary);
        nativeOutputs.value = Array.from(access.outputs?.values?.() || []).map(toSummary);
      };

      try {
        const access = await (navigator as any).requestMIDIAccess({ sysex });
        nativeAccess.value = access;
        updateSnapshot(access);
        refreshMidiPermissions();

        access.onstatechange = (evt: any) => {
          const port = evt?.port;
          nativeStateChanges.value = [
            {
              ts: new Date().toISOString(),
              id: port?.id || "",
              name: port?.name || "",
              state: port?.state || "",
              connection: port?.connection || "",
              type: port?.type || "",
              manufacturer: port?.manufacturer || "",
            },
            ...nativeStateChanges.value,
          ].slice(0, 20);

          // Keep the live port list in sync with hotplug events.
          try {
            updateSnapshot(access);
          } catch {
            // ignore
          }
        };
      } catch (err) {
        nativeError.value = String((err as any)?.message || err || "unknown error");
        nativeInputs.value = [];
        nativeOutputs.value = [];
      }
    };

    const nativeHasOnlyGenericThrough = computed(() => {
      const names = [
        ...nativeInputs.value.map((p) => String(p?.name || "")),
        ...nativeOutputs.value.map((p) => String(p?.name || "")),
      ].filter(Boolean);

      return (
        names.length > 0 &&
        names.every((name) => /\bmidi\s*(thru|through)\b/i.test(name))
      );
    });

    const reloadWebMidi = async () => {
      if (isReloadingWebMidi.value) {
        return;
      }

      isReloadingWebMidi.value = true;
      try {
        await midiStoreMapped.reloadMidi();
      } finally {
        isReloadingWebMidi.value = false;
      }
    };

    const requestSysexAndReload = async () => {
      if (isReloadingWebMidi.value) {
        return;
      }

      isReloadingWebMidi.value = true;
      try {
        // Must be called from a user gesture (button click), so keep it here.
        await requestNativeMidiAccess(true);
        await midiStoreMapped.reloadMidi();
      } finally {
        isReloadingWebMidi.value = false;
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

      // Native WebMIDI debug (Chrome's MIDIAccess)
      // webmidi.js wraps this, but showing raw MIDIAccess helps diagnose platform/permission issues.
      requestNativeMidiAccess(false);

      // Permissions API (optional): helps distinguish granted vs prompt/denied.
      // Some browsers may not implement this for MIDI.
      refreshMidiPermissions();
    });


    return {
      outputs: midiStoreMapped.outputs,
      midiDebug: midiStoreMapped.debug,
      isSecureContext: window.isSecureContext,
      isReloadingWebMidi,
      reloadWebMidi,
      requestSysexAndReload,
      showMidiDebug,
      nativeSupported,
      nativeHasOnlyGenericThrough,
      nativeSysex,
      nativeError,
      nativeInputs,
      nativeOutputs,
      nativeStateChanges,
      requestNativeMidiAccess,
      origin,
      midiPermission,
      midiSysexPermission,
      midiPermissionError,
      copyMidiDiagnostic,
    };
  },
});
</script>
