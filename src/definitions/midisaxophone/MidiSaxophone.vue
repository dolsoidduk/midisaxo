<template>
  <form class="relative flex flex-wrap flex-grow" novalidate @submit.prevent="">
    <div v-if="loading" class="absolute flex inset-0 opacity-75 bg-gray-900">
      <Spinner class="self-center" />
    </div>

    <Section title="MIDI Saxophone" class="w-full">
      <div class="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <p class="text-sm mb-6">
          야마하 YDS-150 키 시스템 지원 (크로매틱 순서로 키 레지스터 + 브레스 컨트롤러).
        </p>

        <p v-if="!isConnected" class="text-sm mb-6">
          디바이스가 연결되지 않았습니다. 설정을 변경하려면 먼저 연결하세요.
        </p>

        <p v-else-if="!hasSaxSections" class="text-sm mb-6">
          이 UI 빌드에는 색소폰 설정 항목이 포함되어 있지 않습니다.
        </p>

        <div
          class="form-grid"
          :class="{ 'pointer-events-none opacity-50': !isConnected }"
        >
          <template v-for="section in saxSections">
            <FormField
              v-if="showField(section)"
              :key="section.key"
              :value="formData[section.key]"
              :field-definition="section"
              @modified="onSaxSettingChange"
            />
          </template>
        </div>
      </div>
    </Section>
  </form>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { Block, SectionType, BlockMap } from "../index";
import { useDeviceForm } from "../../composables";
import { midiStoreMapped } from "../../store";

export default defineComponent({
  name: "MidiSaxophone",
  setup() {
    const { isConnected } = midiStoreMapped;

    const { formData, loading, onSettingChange, showField } =
      useDeviceForm(Block.Global, SectionType.Setting);

    const onSaxSettingChange = (params: any) => {
      if (!isConnected.value) {
        return;
      }
      return onSettingChange(params);
    };

    const saxKeys = new Set([
      "saxRegisterChromaticEnable",
      "saxRegisterChromaticBaseNote",
      "saxBreathControllerEnable",
      "saxBreathControllerAnalogIndex",
      "saxBreathControllerCC",
    ]);

    const saxSections = computed(() => {
      const globalSections = Object.values(BlockMap[Block.Global].sections);
      return globalSections.filter(
        (section) => section.type === SectionType.Setting && saxKeys.has(section.key),
      );
    });

    const hasSaxSections = computed(() => saxSections.value.length > 0);

    return {
      formData,
      loading,
      onSaxSettingChange,
      showField,
      saxSections,
      hasSaxSections,
      isConnected,
    };
  },
});
</script>
