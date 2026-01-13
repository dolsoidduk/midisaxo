<template>
  <div class="section" :class="{ wide: viewSetting.viewListAsTable }">
    <div class="section-heading">
      <h2 v-if="title" class="section-heading-inner text-center">
        {{ title }}
      </h2>
    </div>
    <div v-if="!showMsbControls" class="section-heading">
      <div class="section-heading-inner-sm clearfix">
        <span class="">
          <span
            class="btn btn-xs mr-2"
            :class="{ 'btn-active': !viewSetting.viewListAsTable }"
            @click="setViewSetting(block, { viewListAsTable: false })"
          >
            그리드
          </span>
          <span
            class="btn btn-xs"
            :class="{ 'btn-active': viewSetting.viewListAsTable }"
            @click="setViewSetting(block, { viewListAsTable: true })"
          >
            테이블
          </span>
        </span>

        <span
          v-if="viewSetting.viewListAsTable && pageSizes.length"
          class="ml-6 float-right"
        >
          <span class="text-xs">표시</span>
          <span
            v-for="itemsPerPage in pageSizes"
            :key="`page-size-${itemsPerPage}`"
            class="btn btn-xs ml-1"
            :class="{ 'btn-active': itemsPerPage === viewSetting.itemsPerPage }"
            @click="setViewSetting(block, { itemsPerPage })"
          >
            {{ itemsPerPage }}
          </span>
        </span>

        <span
          v-if="viewSetting.viewListAsTable && pages > 1"
          class="ml-6 mt-4 md:mt-0 float-right"
        >
          <span class="text-xs ml-4">페이지</span>
          <span
            v-for="page in pages"
            :key="`page-size-${page}`"
            class="btn btn-xs ml-1"
            :class="{ 'btn-active': page === viewSetting.currentPage }"
            @click="setViewSetting(block, { currentPage: page })"
          >
            {{ page }}
          </span>
        </span>
      </div>
    </div>

    <form
      v-if="viewSetting.viewListAsTable"
      class="relative"
      novalidate
      @submit.prevent=""
    >
      <SpinnerOverlay v-if="loading" />
      <div class="form-table">
        <DeviceTableComponentRow
          v-for="index in indexRange"
          :key="`table-form-${index}`"
          :index="index"
          :form-data="columnViewData[index]"
          :show-field="showField"
          :sections="sections"
          :on-value-change="onValueChange"
          :highlight="highlights[block][index]"
        />
      </div>
    </form>
    <div v-else-if="(!segments || !segments.length) && componentCount > 0" class="device-grid">
      <DeviceGridButton
        v-for="index in componentCount"
        :key="`button-${index}`"
        :output-id="outputId"
        :route-name="routeName"
        :index="index - 1"
        :highlight="highlights[block][index - 1]"
      >
        <span class="text-xl font-bold">{{ index - 1 }}</span>
      </DeviceGridButton>
    </div>
    <template v-else-if="segments && segments.length">
      <div
        v-for="(segment, idx) in segments"
        :key="`grid-segment-${idx}`"
        class="grid-segment"
      >
        <h3 class="section-heading text-center">
          <div class="section-heading-inner-sm">
            {{ segment.title }}
          </div>
        </h3>

        <div class="device-grid">
          <DeviceGridButton
            v-for="index in segment.indexArray"
            :key="`button-${index}`"
            :output-id="outputId"
            :route-name="routeName"
            :index="index"
            :highlight="highlights[block][index]"
          >
            <span class="text-xl font-bold">{{ index }}</span>
          </DeviceGridButton>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, toRefs, onMounted, nextTick, watch } from "vue";
import { Block } from "./../../definitions";
import { deviceStoreMapped, requestLogMapped } from "../../store";
import {
  useDeviceTableView,
  useViewSettings,
  useGridSegments,
} from "../../composables";
import DeviceGridButton from "./DeviceGridButton.vue";
import DeviceTableComponentRow from "./DeviceTableComponentRow.vue";

export default defineComponent({
  name: "DeviceGrid",
  components: {
    DeviceGridButton,
    DeviceTableComponentRow,
  },
  props: {
    title: {
      default: "",
      type: String,
    },
    block: {
      required: true,
      type: Number as () => Block,
    },
    segmentGrid: {
      type: Boolean,
      default: false,
    },
    routeName: {
      required: true,
      type: String,
    },
  },
  setup(props) {
    const {
      outputId,
      setViewSetting,
      showMsbControls,
      numberOfComponents,
    } = deviceStoreMapped;
    const { highlights } = requestLogMapped;
    const { block, segmentGrid } = toRefs(props);

    const segments = segmentGrid.value
      ? useGridSegments(numberOfComponents, block)
      : undefined;
    const {
      componentCount,
      indexRange,
      pages,
      pageSizes,
      sections,
      viewSetting,
    } = useViewSettings(block.value);

    const {
      columnViewData,
      loading,
      showField,
      onValueChange,
    } = useDeviceTableView(block.value, viewSetting);

    // Linux/Electron workaround: inputs sometimes don't paint their text until
    // the first focus/click. When the table view becomes visible (and after
    // data finishes loading), force a tiny reflow on form controls and perform
    // a focus->blur cycle on the first control.
    const forcePaintTableControls = async (): Promise<void> => {
      try {
        await nextTick();

        requestAnimationFrame(() => {
          const table = document.querySelector(".form-table") as HTMLElement | null;
          if (!table) {
            return;
          }

          const controls = Array.from(
            table.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
              "input, select, textarea",
            ),
          );

          if (!controls.length) {
            return;
          }

          // Promote each control to its own layer briefly to force repaint.
          for (const control of controls) {
            const prevTransform = control.style.transform;
            control.style.transform = "translateZ(0)";
            void control.offsetHeight;
            control.style.transform = prevTransform;
          }

          const prevActive = document.activeElement as HTMLElement | null;
          const first = controls[0] as any;
          try {
            first.focus?.({ preventScroll: true });
            first.blur?.();
          } catch (_) {
            // ignore
          }

          // Restore focus if we stole it.
          if (prevActive && prevActive !== document.body) {
            try {
              (prevActive as any).focus?.({ preventScroll: true });
            } catch (_) {
              // ignore
            }
          }

          window.dispatchEvent(new Event("resize"));
        });
      } catch (_) {
        // ignore
      }
    };

    onMounted(() => {
      if (viewSetting.value.viewListAsTable) {
        void forcePaintTableControls();
      }
    });

    watch(
      () => viewSetting.value.viewListAsTable,
      (enabled) => {
        if (enabled) {
          void forcePaintTableControls();
        }
      },
    );

    watch(
      () => loading.value,
      (isLoading) => {
        if (!isLoading && viewSetting.value.viewListAsTable) {
          void forcePaintTableControls();
        }
      },
    );

    return {
      outputId,
      highlights,
      columnViewData,
      loading,
      showField,
      onValueChange,
      setViewSetting,
      componentCount,
      viewSetting,
      indexRange,
      pages,
      pageSizes,
      sections,
      showMsbControls,
      segments,
    };
  },
});
</script>
