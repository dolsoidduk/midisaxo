<template>
  <div
    v-if="isConnected"
    class="surface-neutral border border-gray-700/60 rounded px-4 py-3 mb-4 text-sm"
  >
    <div class="text-gray-200 font-semibold">현재 모드</div>

    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span class="px-2 py-0.5 rounded border" :class="currentMode.badgeClass">
        {{ currentMode.badgeText }}
      </span>

      <span class="text-gray-400">Sax Breath CC 자동 전송:</span>
      <span
        class="font-mono"
        :class="breathSenderEnabled ? 'text-yellow-300' : 'text-gray-300'"
      >
        {{ breathSenderEnabled ? "ON" : "OFF" }}
      </span>

      <span class="text-gray-500">|</span>

      <span class="text-gray-400">Analog 1~3:</span>
      <span class="font-mono text-gray-300">{{ analogSummaryText }}</span>
    </div>

    <div
      v-if="currentMode.detailsText"
      class="mt-2 text-xs text-gray-300 whitespace-pre-line"
    >
      {{ currentMode.detailsText }}
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button
        class="px-2 py-1 border border-gray-700 rounded text-xs text-gray-200 hover:border-gray-500"
        :disabled="modeStatusLoading"
        @click.prevent="refreshModeStatus"
      >
        {{ modeStatusLoading ? "..." : "상태 새로고침" }}
      </button>
      <span v-if="modeStatusError" class="text-xs text-red-300">
        {{ modeStatusError }}
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch } from "vue";
import { deviceStore, deviceStoreMapped } from "../../../store";
import { Block, SectionType, AnalogType } from "../../interface";

type AnalogConfig = Record<string, number>;

type ModeInfo = {
  badgeText: string;
  badgeClass: string;
  detailsText: string;
};

export default defineComponent({
  name: "AnalogModeSummary",
  setup() {
    const { isConnected } = deviceStoreMapped;

    const modeStatusLoading = ref(false);
    const modeStatusError = ref<string>("");

    const analogConfigs = ref<Record<number, AnalogConfig | null>>({});
    const globalSettings = ref<Record<string, number> | null>(null);

    const refreshModeStatus = async (): Promise<void> => {
      if (!isConnected.value || modeStatusLoading.value) {
        return;
      }

      modeStatusLoading.value = true;
      modeStatusError.value = "";

      try {
        const [g, a0, a1, a2] = await Promise.all([
          deviceStore.actions
            .getComponentSettings(Block.Global, SectionType.Setting)
            .catch(() => null),
          deviceStore.actions
            .getComponentSettings(Block.Analog, SectionType.Value, 0)
            .catch(() => null),
          deviceStore.actions
            .getComponentSettings(Block.Analog, SectionType.Value, 1)
            .catch(() => null),
          deviceStore.actions
            .getComponentSettings(Block.Analog, SectionType.Value, 2)
            .catch(() => null),
        ]);

        globalSettings.value = g as any;
        analogConfigs.value = {
          0: a0 as any,
          1: a1 as any,
          2: a2 as any,
        };
      } catch {
        modeStatusError.value = "상태 읽기 실패 (연결/권한을 확인하세요)";
      } finally {
        modeStatusLoading.value = false;
      }
    };

    watch(
      () => isConnected.value,
      (connected) => {
        if (connected) {
          refreshModeStatus();
        } else {
          analogConfigs.value = {};
          globalSettings.value = null;
          modeStatusError.value = "";
        }
      },
      { immediate: true },
    );

    const breathSenderEnabled = computed((): boolean => {
      const g = globalSettings.value || {};
      return !!(g as any).saxBreathControllerEnable;
    });

    const analogLabelFor = (cfg: AnalogConfig | null | undefined): string => {
      if (!cfg) {
        return "?";
      }

      const enabled = Number(cfg.enabled) === 1;
      if (!enabled) {
        return "OFF";
      }

      const type = Number(cfg.type);

      if (type === AnalogType.PitchBend) {
        return "PB";
      }
      if (type === AnalogType.Reserved) {
        return "RES";
      }
      if (type === AnalogType.ControlChange7Bit) {
        const cc = Number(cfg.midiIdLSB);
        if (cc === 1) {
          return "MOD";
        }
        if (cc === 2) {
          return "CC2";
        }
        if (cc === 11) {
          return "CC11";
        }
        return `CC${Number.isFinite(cc) ? cc : "?"}`;
      }

      return `T${Number.isFinite(type) ? type : "?"}`;
    };

    const analogSummaryText = computed((): string => {
      const a0 = analogConfigs.value[0];
      const a1 = analogConfigs.value[1];
      const a2 = analogConfigs.value[2];
      return `${analogLabelFor(a0)} / ${analogLabelFor(a1)} / ${analogLabelFor(
        a2,
      )}`;
    });

    const isCc2Cc11PbPreset = computed((): boolean => {
      const a0 = analogConfigs.value[0];
      const a1 = analogConfigs.value[1];
      const a2 = analogConfigs.value[2];

      return (
        !!a0 &&
        !!a1 &&
        !!a2 &&
        Number(a0.enabled) === 1 &&
        Number(a0.type) === AnalogType.ControlChange7Bit &&
        Number(a0.midiIdLSB) === 2 &&
        Number(a1.enabled) === 1 &&
        Number(a1.type) === AnalogType.ControlChange7Bit &&
        Number(a1.midiIdLSB) === 11 &&
        Number(a2.enabled) === 1 &&
        Number(a2.type) === AnalogType.PitchBend
      );
    });

    const isPressurePbPreset = computed((): boolean => {
      const a1 = analogConfigs.value[1];
      const a2 = analogConfigs.value[2];
      return (
        !!a1 &&
        !!a2 &&
        Number(a1.enabled) === 1 &&
        Number(a1.type) === AnalogType.PitchBend &&
        Number(a2.enabled) === 1 &&
        Number(a2.type) === AnalogType.Reserved
      );
    });

    const currentMode = computed(
      (): ModeInfo => {
        if (!isConnected.value) {
          return {
            badgeText: "연결 필요",
            badgeClass: "border-gray-700 text-gray-300",
            detailsText:
              "보드에 연결되면 현재 설정을 읽어서 모드를 표시합니다.",
          };
        }

        if (isCc2Cc11PbPreset.value) {
          const details = breathSenderEnabled.value
            ? "현재 Analog에서 CC2/CC11/PB를 직접 내보내고 있습니다.\n또한 Sax Breath CC 자동 전송이 켜져 있어 CC가 중복될 수 있습니다. (Sax Breath Controller를 OFF 권장)"
            : "현재 Analog에서 CC2/CC11/PB를 직접 내보내는 구성입니다.\nSax Breath CC 자동 전송은 OFF라서 중복이 없습니다.";
          return {
            badgeText: "Analog 직결 (CC2/CC11/PB)",
            badgeClass: breathSenderEnabled.value
              ? "border-red-500/60 text-red-300"
              : "border-green-500/60 text-green-300",
            detailsText: details,
          };
        }

        if (isPressurePbPreset.value) {
          return {
            badgeText: "압력 → PB (+ amount)",
            badgeClass: "border-green-500/60 text-green-300",
            detailsText:
              "Analog #2가 Reserved로 잡혀 있으면 펌웨어 내부에서 피치벤드 amount(밴딩/비브라토 스케일) 소스로 사용될 수 있습니다.\n또는 Analog #2 자체를 Pitch Bend 센서로 구성해도 됩니다.",
          };
        }

        if (breathSenderEnabled.value) {
          return {
            badgeText: "Sax Breath Controller",
            badgeClass: "border-yellow-500/60 text-yellow-300",
            detailsText:
              "Sax Breath Controller가 CC를 자동으로 전송합니다.\n(Analog에서 CC2/CC11을 동시에 출력 중이라면 중복이 생길 수 있어요)",
          };
        }

        return {
          badgeText: "커스텀",
          badgeClass: "border-gray-700 text-gray-300",
          detailsText:
            "프리셋과 일치하지 않는 커스텀 구성입니다. Analog 1~3 요약을 참고하세요.",
        };
      },
    );

    return {
      isConnected,
      modeStatusLoading,
      modeStatusError,
      refreshModeStatus,
      breathSenderEnabled,
      analogSummaryText,
      currentMode,
    };
  },
});
</script>
