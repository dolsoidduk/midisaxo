<template>
  <Hero v-if="isConnecting" custom="h-64 relative">
    <SpinnerOverlay />
  </Hero>

  <div v-else-if="isConnected" class="relative">
    <DeviceNav v-if="!isBootloaderMode" />
    <router-view></router-view>

    <ProgressBar
      v-if="
        isSystemOperationRunning && Number.isInteger(systemOperationPercentage)
      "
      :percentage="systemOperationPercentage"
    />
    <SpinnerOverlay v-else-if="isSystemOperationRunning" />
  </div>

    <Hero
      v-else
      custom="h-64"
      :title="connectionError || 'No WebMidi device found.'"
    >
      <div class="mt-4 text-sm text-gray-300">
        <div>체크 포인트:</div>
        <div class="mt-2">- 홈 화면에서 <strong>SysEx 권한 요청 + Reload</strong>를 먼저 눌러 권한을 허용하세요.</div>
        <div>- 장치 목록에 <strong>MIDI Through</strong>만 보이면, 브라우저/OS가 실제 USB-MIDI 장치를 못 보고 있는 상태일 수 있습니다.</div>
      </div>
      <div class="mt-6">
        <router-link
          :to="{ name: 'home' }"
          class="px-4 py-2 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
        >
          홈으로 이동
        </router-link>
      </div>
    </Hero>

  <RequestLog />
</template>

<script lang="ts">
import { defineComponent, onMounted } from "vue";
import router from "../../router";
import { logger } from "../../util";
import { deviceStoreMapped } from "../../store";

import RequestLog from "../request-log/RequestLog.vue";
import DeviceNav from "./DeviceNav.vue";

export default defineComponent({
  name: "Device",
  components: {
    RequestLog,
    DeviceNav,
  },
  setup() {
    const {
      connectDevice,
      isConnected,
      isConnecting,
      isSystemOperationRunning,
      systemOperationPercentage,
      isBootloaderMode,
        connectionError,
    } = deviceStoreMapped;

    onMounted(async () => {
      try {
        await connectDevice(
          router.currentRoute.value.params.outputId as string,
        );
        if (isBootloaderMode.value) {
          return router.push({ name: "device-firmware-update" });
        }
      } catch (err) {
        logger.error(err);
      }
    });

    return {
      isConnected,
      isConnecting,
      isBootloaderMode,
      isSystemOperationRunning,
      systemOperationPercentage,
        connectionError,
    };
  },
});
</script>
