<template>
  <div>
    <AnalogModeSummary />
    <DeviceGrid :block="block" :route-name="routeName" :segment-grid="segmentGrid" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { Block } from "../../interface";
import DeviceGrid from "../../device/DeviceGrid.vue";
import AnalogModeSummary from "./AnalogModeSummary.vue";

export default defineComponent({
  name: "AnalogList",
  components: {
    DeviceGrid,
    AnalogModeSummary,
  },
  props: {
    block: {
      required: true,
      type: Number as () => Block,
    },
    routeName: {
      required: true,
      type: String,
    },
    segmentGrid: {
      type: Boolean,
      default: false,
    },
  },
});
</script>
