<template>
  <MidiSaxophoneCanonical />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import MidiSaxophoneCanonical from "../../../definitions/midisaxophone/MidiSaxophone.vue";

export default defineComponent({
  name: "MidiSaxophone",
  components: {
    MidiSaxophoneCanonical,
  },
});
</script>
