<template>
  <form class="relative section" novalidate @submit.prevent="">
    <h1 class="w-full section-heading">
      <div class="section-heading-inner flex">
        <router-link class="mr-6" :to="{ name: blockDefinition.routeName }">
          <h2>{{ blockDefinition.title }}s</h2>
        </router-link>
        <span class="mr-6">&rsaquo;</span>
        <div class="mr-6 text-gray-400">
          {{ blockDefinition.title }}
          <strong>
            {{ index }}
          </strong>
        </div>
        <div class="hidden md:block md:flex-grow text-right">
          <Siblinks
            param-key="index"
            :current="index"
            :total="numberOfComponents[block]"
            :params="{ outputId }"
          />
        </div>
      </div>
    </h1>

    <SpinnerOverlay v-if="loading" />

    <div class="section-content">
      <AnalogModeSummary />
      <div class="form-grid" :class="`lg:grid-cols-${gridCols}`">
        <template v-for="section in sections">
          <FormField
            v-if="showField(section)"
            :key="section.key"
            :class="`col-span-${section.colspan || 1}`"
            :value="
              section.key === 'type' ? uiAnalogType : formData[section.key]
            "
            :field-definition="section"
            @modified="
              section.key === 'type' ? onAnalogTypeChange : onValueChange
            "
          />
        </template>
      </div>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { SectionType, Block, AnalogType } from "../../interface";
import { deviceStoreMapped, deviceStore } from "../../../store";
import router from "../../../router";
import { useDeviceForm } from "../../../composables";
import AnalogModeSummary from "./AnalogModeSummary.vue";

const UI_PRESET_BREATH_CC2 = 1002;
const UI_PRESET_MODWHEEL_CC1 = 1001;
const UI_PRESET_EXPRESSION_CC11 = 1011;

export default defineComponent({
  name: "AnalogForm",
  components: {
    AnalogModeSummary,
  },
  props: {
    block: {
      required: true,
      type: Number as () => Block,
    },
    gridCols: {
      default: 3,
      type: Number,
    },
  },
  setup(props) {
    const { numberOfComponents, outputId } = deviceStoreMapped;
    const index = computed(() =>
      Number(router.currentRoute.value.params.index),
    );

    const {
      formData,
      loading,
      onValueChange,
      showField,
      sections,
      blockDefinition,
    } = useDeviceForm(props.block, SectionType.Value, index);

    const uiAnalogType = computed((): number => {
      const type = Number((formData as any).type);
      const midiIdLSB = Number((formData as any).midiIdLSB);
      const midiIdMSB = Number((formData as any).midiIdMSB);

      if (
        type === AnalogType.ControlChange7Bit &&
        midiIdMSB === 0 &&
        midiIdLSB === 1
      ) {
        return UI_PRESET_MODWHEEL_CC1;
      }

      if (
        type === AnalogType.ControlChange7Bit &&
        midiIdMSB === 0 &&
        midiIdLSB === 2
      ) {
        return UI_PRESET_BREATH_CC2;
      }

      if (
        type === AnalogType.ControlChange7Bit &&
        midiIdMSB === 0 &&
        midiIdLSB === 11
      ) {
        return UI_PRESET_EXPRESSION_CC11;
      }

      return type;
    });

    const setValue = async (
      key: string,
      section: number,
      value: number,
    ): Promise<void> => {
      // DeviceForm/useDeviceForm uses indexRef for value blocks.
      await onValueChange({ key, section, value });
    };

    const onAnalogTypeChange = async (params: any): Promise<void> => {
      const requested = Number(params?.value);

      if (!Number.isFinite(requested)) {
        return;
      }

      // UI-only presets: never write these numbers to the device.
      if (
        requested === UI_PRESET_MODWHEEL_CC1 ||
        requested === UI_PRESET_BREATH_CC2 ||
        requested === UI_PRESET_EXPRESSION_CC11
      ) {
        // Ensure MIDI CC sender is enabled. (Type field is only visible when enabled,
        // but keep it safe.)
        await setValue("enabled", 0, 1);

        // Set actual type to CC7.
        await setValue("type", 2, AnalogType.ControlChange7Bit);

        // Set CC number.
        let cc = 11;

        if (requested === UI_PRESET_MODWHEEL_CC1) {
          cc = 1;
        } else if (requested === UI_PRESET_BREATH_CC2) {
          cc = 2;
        }

        await setValue("midiIdLSB", 3, cc);
        await setValue("midiIdMSB", 4, 0);

        // Keep sax-specific breath sender OFF if user is using analog CC.
        // (This avoids accidental double CC2/CC11 if they had it enabled.)
        try {
          await deviceStore.actions.setComponentSectionValue(
            { block: Block.Global, section: 2, index: 6, value: 0 },
            () => undefined,
          );
        } catch {
          // ignore
        }

        return;
      }

      // Normal path: forward to the default handler.
      return onValueChange(params);
    };

    return {
      outputId,
      numberOfComponents,
      index,
      formData,
      loading,
      onValueChange,
      showField,
      sections,
      blockDefinition,
      uiAnalogType,
      onAnalogTypeChange,
    };
  },
});
</script>
