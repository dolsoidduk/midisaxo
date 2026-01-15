<template>
  <DeviceSettings class="global flex flex-wrap flex-grow" :block="Block.Global">
    <template #default="{ form, showField, onSettingChange }">
      <Section :showContent="false" class="w-full">
        <template #title>
          <h3 class="section-heading">
            <div class="section-heading-inner flex items-center">
              <div class="flex-grow">MIDI Saxophone</div>
              <router-link
                :to="{ name: 'midisaxophone' }"
                class="flex items-center text-sm text-gray-400 hover:text-gray-200"
              >
                <GlobalIcon class="w-4 h-4 mr-2" />
                MIDI Saxophone 설정
              </router-link>
            </div>
          </h3>
        </template>
      </Section>

      <Section v-if="supportedPresetsCount > 1" title="Presets">
        <div class="form-grid">
        <FormField
            v-if="showField(sections.DisableForcedValueRefreshAfterPresetChange)"
            :value="form.disableForcedValueRefreshAfterPresetChange"
            :field-definition="sections.DisableForcedValueRefreshAfterPresetChange"
            @modified="onSettingChange"
          />
        <FormField
            v-if="showField(sections.EnablePresetChangeWithProgramChangeIn)"
            :value="form.enablePresetChangeWithProgramChangeIn"
            :field-definition="sections.EnablePresetChangeWithProgramChangeIn"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.PreservePresetState)"
            class="col-span-2"
            :value="form.preservePresetState"
            :field-definition="sections.PreservePresetState"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.ActivePreset)"
            :value="form.activePreset"
            :field-definition="sections.ActivePreset"
            @modified="onSettingChange"
          />
        </div>
      </Section>

      <Section title="MIDI">
        <div class="form-grid">
          <FormField
            v-if="showField(sections.UseGlobalChannel)"
            :value="form.useGlobalChannel"
            :field-definition="sections.UseGlobalChannel"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.GlobalChannel)"
            :value="form.globalChannel"
            :field-definition="sections.GlobalChannel"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.StandardNoteOff)"
            :value="form.standardNoteOff"
            :field-definition="sections.StandardNoteOff"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.DinMidiState)"
            :value="form.dinMidiState"
            :field-definition="sections.DinMidiState"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.BleMidiState)"
            :value="form.bleMidiState"
            :field-definition="sections.BleMidiState"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.RunningStatus)"
            :value="form.runningStatus"
            :field-definition="sections.RunningStatus"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.MIDIClock)"
            :value="form.midiClock"
            :field-definition="sections.MIDIClock"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.UsbToDinThru)"
            :value="form.usbToDinThru"
            :field-definition="sections.UsbToDinThru"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.UsbToUsbThru)"
            :value="form.usbToUsbThru"
            :field-definition="sections.UsbToUsbThru"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.UsbToBleThru)"
            :value="form.usbToBleThru"
            :field-definition="sections.UsbToBleThru"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.DinToDinThru)"
            :value="form.dinToDinThru"
            :field-definition="sections.DinToDinThru"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.DinToUsbThru)"
            :value="form.dinToUsbThru"
            :field-definition="sections.DinToUsbThru"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.DinToBleThru)"
            :value="form.dinToBleThru"
            :field-definition="sections.DinToBleThru"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.BleToDinThru)"
            :value="form.bleToDinThru"
            :field-definition="sections.BleToDinThru"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.BleToUsbThru)"
            :value="form.bleToUsbThru"
            :field-definition="sections.BleToUsbThru"
            @modified="onSettingChange"
          />
          <FormField
            v-if="showField(sections.BleToBleThru)"
            :value="form.bleToBleThru"
            :field-definition="sections.BleToBleThru"
            @modified="onSettingChange"
          />
        </div>
      </Section>
    </template>
  </DeviceSettings>

  <GlobalHardware />
</template>

<script lang="ts">
import { defineComponent, provide } from "vue";
import { Block } from "../../interface";
import { GlobalBlock } from "./global";
import { deviceStoreMapped } from "../../device/device-store";

import GlobalHardware from "./GlobalHardware.vue";
import GlobalIcon from "./GlobalIcon.vue";

export default defineComponent({
  name: "Global",
  components: {
    GlobalHardware,
    GlobalIcon,
  },
  setup() {
    // Global 페이지에서는 툴팁 말풍선이 입력을 가리는 경우가 많아
    // 라벨 위로 뜨도록 기본 위치를 되돌립니다.
    // (MIDI Saxophone 설정 탭/페이지는 별도 라우트이므로 여기서 제외됩니다.)
    provide("formFieldTooltipPlacement", "top");

    const { sections } = GlobalBlock;
    const { supportedPresetsCount } = deviceStoreMapped;

    return {
      Block,
      sections,
      supportedPresetsCount,
    };
  },
});
</script>
