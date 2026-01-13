<template>
  <Section title="Hardware settings">
    <div class="form-grid">
      <div class="form-field">
        <Button @click.prevent="startReboot">
          Reboot device
        </Button>
        <p class="help-text">
          Rebooting the device will temporarily disconnect the UI.
        </p>
      </div>

      <div class="form-field">
        <Button @click.prevent="onFactoryResetClicked">
          Factory reset
        </Button>
        <p class="help-text">
          Resets the device to factory settings.
        </p>
      </div>

      <div v-if="bootLoaderSupport" class="form-field">
        <ButtonLink :to="{ name: 'device-firmware-update' }">
          Firmware
        </ButtonLink>
        <p class="help-text">
          Opens the firmware page to enter bootloader mode and update firmware.
          <br />
          Firmware downloads:
          <a
            href="https://github.com/dolsoidduk/OpenDeck/releases"
            target="_blank"
            rel="noopener noreferrer"
            >OpenDeck (Midisaxo fork) releases</a
          <br />
          Flashing guide:
          <a
            href="https://github.com/shanteacontrols/OpenDeck/wiki/Flashing-the-OpenDeck-firmware"
            target="_blank"
            rel="noopener noreferrer"
            >OpenDeck wiki: flashing the firmware</a
        </p>
      </div>
    </div>
  </Section>
  <Section v-if="valueSize === 2" title="Backup & restore" class="w-full">
    <div class="form-grid">
      <div class="form-field">
        <Button @click.prevent="onBackupClicked">
          Backup
        </Button>
        <p class="help-text">
          Download a backup of your configuration (including presets).
          Backups are saved as a file by your browser (usually in Downloads).
        </p>
      </div>
      <div class="form-field">
        <FormFileInput
          label="Restore"
          name="backup-file"
          @change="onBackupFileSelected"
        />
        <p class="help-text">
          Select a backup file to restore your configuration.
        </p>
      </div>
    </div>
  </Section>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { deviceStoreMapped } from "../../../store";
import { useConfirmPrompt } from "../../../composables";

export default defineComponent({
  name: "GlobalHardware",
  setup() {
    const {
      valueSize,
      bootLoaderSupport,
      startFactoryReset,
      startReboot,
      startBackup,
    } = deviceStoreMapped;

    const modalVisible = ref(false);
    const modalTitle = ref("");
    const availableUpdates = ref([]);

    const onFactoryResetClicked = useConfirmPrompt(
      "This will reset all the parameters on the board to their factory settings. All analog inputs will be disabled as well. Depending on the board, this can take up to 30 seconds. Proceed?",
      startFactoryReset,
    );

    const onBackupFileSelected = (fileList) => {
      if (!fileList.length) return;

      deviceStoreMapped.startRestore(fileList[0]);
    };

    const onBackupClicked = useConfirmPrompt(
      "This will initiate a full backup of all parameters stored on the board. Proceed?",
      startBackup,
    );

    return {
      modalVisible,
      modalTitle,
      availableUpdates,
      onFactoryResetClicked,
      valueSize,
      bootLoaderSupport,
      startReboot,
      onBackupClicked,
      onBackupFileSelected,
    };
  },
});
</script>
