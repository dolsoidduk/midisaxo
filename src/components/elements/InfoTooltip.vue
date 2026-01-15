<template>
  <span class="relative inline-flex items-center group align-middle">
    <span
      class="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] leading-none rounded border border-gray-600 bg-gray-800 text-gray-200 cursor-help select-none"
      tabindex="0"
      role="button"
      aria-label="설명"
    >
      ?
    </span>

    <span
      class="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-72 max-w-[90vw] rounded border border-gray-700 bg-gray-900 text-gray-200 text-xs px-2 py-1 shadow-lg opacity-0 pointer-events-none whitespace-pre-line group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
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
