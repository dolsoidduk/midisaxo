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

        <div
          v-if="isConnected && formData.saxRegisterChromaticEnable"
          class="mb-8"
        >
          <h4 class="heading mb-2">레지스터 키 맵(미리보기)</h4>
          <p class="text-sm mb-4">
            레지스터 키 인덱스(디지털 입력)와 실제 전송되는 노트 번호를 보여줍니다.
          </p>

          <Hero
            v-if="!registerKeyCount"
            custom="h-32"
            title="레지스터 키 수를 확인할 수 없습니다. (버튼 컴포넌트 수가 0이거나 아직 로드되지 않았습니다.)"
          />

          <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
            <div
              v-for="key in registerKeys"
              :key="key.index"
              class="surface-neutral border rounded px-4 py-3"
            >
              <div class="text-sm">
                <strong>키 {{ key.index }}</strong>
              </div>
              <div class="text-sm mt-1">
                노트: <strong>{{ key.note }}</strong>
                <span v-if="key.noteName">({{ key.noteName }})</span>
              </div>
            </div>
          </div>
        </div>

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
import { midiStoreMapped, deviceStoreMapped } from "../../store";

export default defineComponent({
  name: "MidiSaxophone",
  setup() {
    const { isConnected } = midiStoreMapped;
    const { numberOfComponents } = deviceStoreMapped;

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

    const clampMidiNote = (value: number): number =>
      Math.max(0, Math.min(127, value));

    const midiNoteName = (note: number): string => {
      const names = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
      ];
      const n = clampMidiNote(note);
      const octave = Math.floor(n / 12) - 1;
      return `${names[n % 12]}${octave}`;
    };

    const registerKeyCount = computed(() => {
      const count = (numberOfComponents.value && numberOfComponents.value[Block.Button]) || 0;
      return Number(count) || 0;
    });

    const registerKeys = computed(() => {
      const count = registerKeyCount.value;
      const base = clampMidiNote(Number(formData.saxRegisterChromaticBaseNote) || 0);
      return Array.from({ length: count }, (_, index) => {
        const note = clampMidiNote(base + index);
        return {
          index,
          note,
          noteName: midiNoteName(note),
        };
      });
    });

    return {
      formData,
      loading,
      onSaxSettingChange,
      showField,
      saxSections,
      hasSaxSections,
      isConnected,
      registerKeyCount,
      registerKeys,
    };
  },
});
</script>
