<template>
  <span class="info-tooltip relative inline-flex items-center align-middle">
    <span
      class="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] leading-none rounded border border-gray-600 bg-gray-800 text-gray-200 cursor-help select-none"
      tabindex="0"
      role="button"
      aria-label="설명"
    >
      ?
    </span>

    <span
      class="info-tooltip__bubble absolute left-1/2 top-full mt-1 z-50 w-72 max-w-[90vw] rounded border border-gray-700 bg-gray-900 text-gray-200 text-xs px-2 py-1 shadow-lg whitespace-pre-line"
    >
      {{ text }}
    </span>
  </span>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "InfoTooltip",
  props: {
    text: {
      type: String,
      required: true,
    },
  },
});
</script>

<style scoped>
.info-tooltip__bubble {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 120ms ease, visibility 0s linear 120ms;
}

.info-tooltip:hover .info-tooltip__bubble,
.info-tooltip:focus-within .info-tooltip__bubble {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition: opacity 120ms ease;
}
</style>
