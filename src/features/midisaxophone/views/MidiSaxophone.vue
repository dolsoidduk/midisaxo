<template>
  <div v-if="error" class="w-full px-4 sm:px-6 lg:px-8 pt-4">
    <div class="surface-neutral border border-red-700/60 rounded px-4 py-3 text-sm">
      <div class="text-red-300 font-semibold">MIDI 색소폰 화면 로딩 오류</div>
      <div class="mt-1 text-red-200/90 text-xs whitespace-pre-wrap">{{ error.message }}</div>
      <div v-if="error.info" class="mt-1 text-red-200/70 text-[11px] whitespace-pre-wrap">
        {{ error.info }}
      </div>
      <div class="mt-3 text-xs text-gray-300">
        임시로 캡처 패널만 보려면:
        <a class="underline" :href="captureOnlyHref">캡처 모드 열기</a>
      </div>
    </div>
  </div>

  <MidiSaxophoneCanonical v-else />
</template>

<script lang="ts">
import { defineComponent, onErrorCaptured, ref, computed } from "vue";
import MidiSaxophoneCanonical from "../../../definitions/midisaxophone/MidiSaxophone.vue";

export default defineComponent({
  name: "MidiSaxophone",
  components: {
    MidiSaxophoneCanonical,
  },
  setup() {
    const error = ref<{ message: string; info?: string } | null>(null);

    const captureOnlyHref = computed(() => {
      // Works with hash routing.
      return "/?capture=1#/midisaxophone";
    });

    onErrorCaptured((err, _instance, info) => {
      error.value = {
        message: err instanceof Error ? err.message : String(err),
        info,
      };
      // Let the global handler also log/surface it.
      return false;
    });

    return {
      error,
      captureOnlyHref,
    };
  },
});
</script>
