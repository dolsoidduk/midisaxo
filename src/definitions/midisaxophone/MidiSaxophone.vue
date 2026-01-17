<template>
  <form class="relative flex flex-wrap flex-grow" novalidate @submit.prevent="">
    <div v-if="loading" class="absolute flex inset-0 opacity-75 bg-gray-900">
      <Spinner class="self-center" />
    </div>

    <Section title="MIDI Saxophone" class="w-full">
      <div class="w-full px-4 sm:px-6 lg:px-8">
        <p class="text-sm mb-6">
          야마하 YDS-150 키 시스템 지원 (레지스터 키 + 브레스 컨트롤러).
        </p>

        <div
          v-if="!isConnected"
          class="surface-neutral border rounded px-4 py-3 mb-6 text-sm"
        >
          <div class="text-gray-200 font-semibold">연결 안내</div>
          <div class="mt-2 text-gray-300">
            WebMIDI 권한(MIDI+SysEx)을 먼저 허용한 뒤 보드를 선택하세요.
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <router-link
              :to="{ name: 'home' }"
              class="px-3 py-1 border border-gray-600 rounded text-gray-200 hover:border-gray-400"
            >
              홈(보드 선택)으로 이동
            </router-link>
            <span class="text-gray-400">
              → <strong>SysEx 권한 요청 + Reload</strong> 클릭 → 보드 선택
            </span>
          </div>
          <div class="mt-2 text-xs text-gray-400">권장 브라우저: Chrome/Edge</div>
        </div>

        <p v-else-if="!hasSaxSections" class="text-sm mb-6">
          이 UI 빌드에는 색소폰 설정 항목이 포함되어 있지 않습니다.
        </p>

        <div class="surface-neutral border rounded px-4 py-3 mb-6 text-sm">
          <div class="flex items-center justify-between gap-2">
            <div class="text-gray-200 font-semibold">설정 설명</div>
            <button
              class="px-2 py-0.5 border border-gray-700 rounded text-[10px] text-gray-200 hover:border-gray-500"
              :aria-expanded="showSaxHelpPanel ? 'true' : 'false'"
              @click.prevent="toggleSaxHelpPanel"
            >
              {{ showSaxHelpPanel ? "접기" : "펼치기" }}
            </button>
          </div>
          <div class="mt-2 text-xs text-gray-300">
            각 항목 라벨 옆 <span class="font-mono">?</span>에 마우스를 올리면 설명이 풍선글로 표시됩니다.
          </div>
          <div
            v-show="showSaxHelpPanel"
            class="mt-2 grid gap-3"
            style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));"
          >
            <div
              v-for="item in saxHelpItems"
              :key="`help-${item.key}`"
              class="text-xs"
              :class="{ 'opacity-60': !item.isVisible }"
            >
              <div class="text-gray-200 font-semibold flex items-center gap-1">
                <span>
                  {{ item.label }}
                  <span v-if="item.rangeText" class="text-gray-400 font-normal">({{ item.rangeText }})</span>
                </span>
                <InfoTooltip v-if="item.description" :text="item.description" />
              </div>
              <div v-if="item.disabledText" class="mt-1 text-red-400">
                {{ item.disabledText }}
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="isConnected"
          class="surface-neutral border border-gray-700/60 rounded px-4 py-3 mb-6 text-sm"
        >
          <div
            v-if="isConnected && isMidisaxoBoard"
            class="mt-4 border-t border-gray-700/60 pt-4"
          >
            <div class="text-gray-200 font-semibold">압력 → 피치벤드 추천 설정</div>
            <div class="mt-2 text-gray-300 whitespace-pre-line text-xs">
              MPXV7002DP(압력 센서)를 피치벤드로 쓰는 구성입니다.
              적용 시 Analog #1을 Pitch bend로, Analog #2를 Reserved(피치 데드존 트림)로 설정합니다.

              주의: RP2040 ADC는 3.3V 입력입니다. MPXV7002DP(보통 5V 구동) 출력은 분압/레벨시프팅 없이 직접 연결하면 위험할 수 있습니다.
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                :disabled="pressurePbPresetBusy"
                @click.prevent="applyPressurePitchBendPreset"
              >
                {{ pressurePbPresetBusy ? "APPLY..." : "추천 설정 적용" }}
              </Button>
              <span v-if="pressurePbPresetNotice" class="text-xs text-green-300">
                {{ pressurePbPresetNotice }}
              </span>
            </div>

            <div class="mt-4 border-t border-gray-700/60 pt-4">
              <div class="text-gray-200 font-semibold">퀵 컨트롤(외부 컨트롤러 없이)</div>
              <div class="mt-2 text-gray-300 whitespace-pre-line text-xs">
                DAW/컴퓨터 환경에서 별도 컨트롤러 없이도 PB 센터 캡처와 데드존을 조정할 수 있습니다.
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  :disabled="pbQuickBusy"
                  @click.prevent="onPbCenterCapture()"
                >
                  PB Center Capture
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  :disabled="pbQuickBusy"
                  @click.prevent="onPbDeadzoneDec()"
                >
                  Deadzone -
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  :disabled="pbQuickBusy"
                  @click.prevent="onPbDeadzoneInc()"
                >
                  Deadzone +
                </Button>

                <div class="flex items-center gap-2">
                  <input
                    class="w-24 text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                    type="number"
                    min="0"
                    max="2000"
                    step="1"
                    :disabled="pbQuickBusy"
                    :value="pbDeadzoneDraft"
                    @change="onPbDeadzoneDraftChange($event)"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="pbQuickBusy"
                    @click.prevent="onPbDeadzoneSet()"
                  >
                    Set
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  :disabled="pbQuickBusy"
                  @click.prevent="refreshPbDeadzone()"
                >
                  Read
                </Button>

                <span v-if="pbDeadzoneValue !== null" class="text-xs text-gray-300">
                  현재: <strong class="text-gray-100">{{ pbDeadzoneValue }}</strong>
                </span>

                <span v-if="pbQuickError" class="text-xs text-red-400">
                  {{ pbQuickError }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          class="form-grid sax-settings-grid mb-8"
          :class="{ 'pointer-events-none opacity-50': !isConnected }"
        >
          <template v-for="section in saxSections" :key="section.key">
            <div v-if="showField(section)" class="flex flex-col gap-1">
              <FormField
                :value="formData[section.key]"
                :field-definition="section"
                :simple-layout="true"
                @modified="onSaxSettingChange"
              />

              <div
                v-if="isConnected && section.key === 'saxBreathControllerMidPercent'"
                class="text-xs text-gray-300 whitespace-nowrap"
              >
                현재 출력:
                <span class="ml-2 font-mono text-yellow-300">{{ breathCcStatusLine }}</span>
                <span v-if="lastBreathCcTime" class="ml-2 text-gray-500">({{ lastBreathCcTime }})</span>
                <button
                  class="ml-2 px-1.5 py-0.5 border border-gray-700 rounded text-[10px] text-gray-200 hover:border-gray-500"
                  @click.prevent="clearBreathActivity"
                >
                  clear
                </button>
              </div>
            </div>
          </template>
        </div>

        <div class="mb-6" :class="{ 'pointer-events-none opacity-50': fingeringLoading }">
          <div
            v-if="!isConnected"
            class="surface-neutral border border-gray-700/60 rounded px-3 py-2 mb-3 text-xs text-gray-300"
          >
            보드가 연결되지 않았습니다. 지금은 <strong class="text-gray-100">수동 입력(키패드 클릭)</strong>으로 조합을 만들 수 있지만,
            실제로 저장하려면 홈에서 보드를 선택해 연결해야 합니다.
          </div>
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <h4 class="heading mb-0">핑거링 테이블 (26키)</h4>

            <div class="flex items-center gap-2 ml-auto">
              <div class="flex items-center gap-2">
                <div class="text-xs text-gray-300 font-semibold">엔트리 표시(가로/세로)</div>
                <select
                  class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                  :disabled="fingeringSupport === 'unsupported'"
                  :value="fingeringEntryLayoutMode"
                  @change="onFingeringEntryLayoutModeChange($event)"
                >
                  <option value="horizontal">가로(스크롤)</option>
                  <option value="grid">세로(그리드)</option>
                </select>

                <div v-if="fingeringEntryLayoutMode === 'horizontal'" class="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="fingeringSupport === 'unsupported' || !showFingeringTable || !canScrollFingeringLeft"
                    @click.prevent="scrollFingeringEntriesByPage(-1)"
                  >
                    ◀
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="fingeringSupport === 'unsupported' || !showFingeringTable || !canScrollFingeringRight"
                    @click.prevent="scrollFingeringEntriesByPage(1)"
                  >
                    ▶
                  </Button>

                  <select
                    v-model="fingeringEntryScrollStepMode"
                    class="text-[10px] px-1.5 py-0.5 border border-gray-700 rounded bg-transparent text-gray-200"
                    :disabled="fingeringSupport === 'unsupported' || !showFingeringTable"
                    title="스크롤 이동 단위"
                  >
                    <option value="entry">1개</option>
                    <option value="page3">3개</option>
                  </select>
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                :disabled="fingeringSupport === 'unsupported' || !showFingeringTable"
                @click.prevent="openAllFingeringEntryDetails"
              >
                전체 펼치기
              </Button>
              <Button
                size="sm"
                variant="secondary"
                :disabled="fingeringSupport === 'unsupported' || !showFingeringTable"
                @click.prevent="closeAllFingeringEntryDetails"
              >
                전체 접기
              </Button>

              <Button
                size="sm"
                variant="secondary"
                :disabled="fingeringSupport !== 'supported' || fingeringLoading"
                @click.prevent="jumpToCurrentPressedFingering"
              >
                현재 눌림으로 이동
              </Button>

              <Button
                size="sm"
                variant="secondary"
                :disabled="fingeringSupport !== 'supported' || fingeringLoading"
                @click.prevent="exportFingeringBackup"
              >
                백업 내보내기
              </Button>
              <Button
                size="sm"
                variant="secondary"
                :disabled="fingeringSupport !== 'supported' || fingeringLoading"
                @click.prevent="triggerFingeringBackupImport"
              >
                백업 가져오기
              </Button>
              <Button
                size="sm"
                variant="danger"
                :disabled="fingeringSupport !== 'supported' || fingeringLoading || !hasPendingFingeringBackup"
                @click.prevent="applyFingeringBackup"
              >
                백업 적용
              </Button>

              <input
                ref="fingeringBackupFileInput"
                type="file"
                accept="application/json,.json"
                class="hidden"
                @change="onFingeringBackupFileChange"
              />

              <Button size="sm" variant="secondary" @click.prevent="showFingeringTable = !showFingeringTable">
                {{ showFingeringTable ? "접기" : "펼치기" }}
              </Button>

              <Button
                size="sm"
                variant="primary"
                :disabled="fingeringLoading"
                @click.prevent="showFingeringCapturePanel = true"
                title="키 조합을 캡처(수동 입력 가능)"
              >
                캡처
              </Button>
            </div>
          </div>
          <div v-if="fingeringBackupApplyProgressText" class="text-xs text-gray-400 mb-2">
            {{ fingeringBackupApplyProgressText }}
          </div>
          <div v-else-if="hasPendingFingeringBackup" class="text-xs text-gray-400 mb-2">
            <div>
              가져온 백업: <strong class="text-gray-200">{{ pendingFingeringBackupSummary }}</strong>
            </div>
            <div v-if="pendingFingeringBackupMetaText" class="mt-1 text-[11px] text-gray-500">
              {{ pendingFingeringBackupMetaText }}
            </div>
          </div>

          <div
            v-if="lastPressedJumpCandidates && lastPressedJumpCandidates.length"
            class="surface-neutral border rounded px-3 py-2 mb-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-xs text-gray-300">
                <strong class="text-gray-200">현재 눌림</strong>
                <span v-if="lastPressedJumpKeysText" class="ml-2 font-mono text-gray-200">{{ lastPressedJumpKeysText }}</span>
                <span v-if="lastPressedJumpExact" class="ml-2 text-gray-400">(일치)</span>
                <span v-else class="ml-2 text-gray-400">(가장 가까운 후보)</span>
              </div>

              <div class="flex items-center gap-1">
                <Button
                  v-for="idx in lastPressedJumpCandidates"
                  :key="`pressed-cand-${idx}`"
                  size="sm"
                  variant="secondary"
                  @click.prevent="jumpToFingeringEntry(idx)"
                >
                  #{{ idx }}
                </Button>
              </div>

              <div class="flex-grow"></div>
              <Button size="sm" variant="secondary" @click.prevent="clearLastPressedJump">닫기</Button>
            </div>
            <div v-if="!lastPressedJumpExact" class="mt-1 text-[11px] text-gray-500">
              정확히 일치하는 엔트리가 없어서, 가장 가까운 후보(최대 3개)를 보여줍니다.
            </div>
          </div>
          <div
            v-if="fingeringSupport !== 'unsupported'"
            class="surface-neutral border rounded px-3 py-2 mb-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-xs text-gray-300 font-semibold">키패드 레이아웃</div>

              <Button
                size="sm"
                variant="secondary"
                @click.prevent="() => { showFingeringLayoutEditor = !showFingeringLayoutEditor; saveUiState(); }"
              >
                {{ showFingeringLayoutEditor ? "레이아웃 편집 닫기" : "레이아웃 편집" }}
              </Button>

              <div class="flex-grow"></div>

              <Button
                size="sm"
                variant="secondary"
                @click.prevent="resetFingeringSaxLayoutOverrideToDefault()"
              >
                기본값 복사(편집용)
              </Button>

              <Button
                size="sm"
                variant="secondary"
                @click.prevent="clearFingeringSaxLayoutOverride()"
              >
                기본 레이아웃 사용
              </Button>

              <Button
                size="sm"
                variant="secondary"
                @click.prevent="exportFingeringSaxLayoutOverride"
              >
                레이아웃 내보내기
              </Button>
              <Button
                size="sm"
                variant="secondary"
                @click.prevent="triggerFingeringSaxLayoutOverrideImport"
              >
                레이아웃 가져오기
              </Button>

              <input
                ref="fingeringLayoutFileInput"
                type="file"
                accept="application/json,.json"
                class="hidden"
                @change="onFingeringLayoutFileChange"
              />
            </div>

            <div v-if="showFingeringLayoutEditor" class="mt-3">
              <div class="text-xs text-gray-400 mb-2">
                색소폰 실루엣 레이아웃을 JSON으로 오버라이드합니다(표시용).
                <strong class="text-gray-200">idx(0..23)는 그대로</strong>이고, row/col만 바꾸면 키 위치를 바꿀 수 있습니다.
              </div>

              <SaxFingeringLayoutDragEditor
                :layout="fingeringSaxLayoutForDragEditor"
                :labels="fingeringKeyLabels"
                :usable-mask="fingeringUiUsableKeyMask"
                :hide-unusable-keys="hideUnusableFingeringKeys"
                @update:layout="onFingeringSaxLayoutDragUpdate"
              />

              <div
                v-if="fingeringLayoutAutoRelocateNotice"
                class="mt-2 text-[11px] text-amber-300"
              >
                {{ fingeringLayoutAutoRelocateNotice }}
              </div>

              <div class="mt-3 border border-gray-800/60 rounded-md px-2 py-2">
                <div class="text-xs text-gray-300 font-semibold mb-2">레이아웃 프리셋</div>

                <div class="flex flex-wrap items-center gap-2">
                  <input
                    v-model="fingeringLayoutPresetNameDraft"
                    class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                    style="min-width: 200px;"
                    placeholder="새 프리셋 이름"
                  />

                  <Button
                    size="sm"
                    variant="secondary"
                    @click.prevent="addFingeringLayoutPresetFromCurrent"
                  >
                    현재 레이아웃 저장
                  </Button>

                  <div class="flex-grow"></div>

                  <select
                    v-model="selectedFingeringLayoutPresetId"
                    class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                    style="min-width: 220px;"
                  >
                    <option :value="null">(프리셋 선택)</option>
                    <option
                      v-for="p in fingeringLayoutPresets"
                      :key="p.id"
                      :value="p.id"
                    >
                      {{ p.name }}
                      <span v-if="activeFingeringLayoutPresetId === p.id">(사용중)</span>
                    </option>
                  </select>

                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="!selectedFingeringLayoutPresetId"
                    @click.prevent="applyFingeringLayoutPreset(selectedFingeringLayoutPresetId)"
                  >
                    적용
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="!selectedFingeringLayoutPresetId"
                    @click.prevent="updateSelectedFingeringLayoutPresetFromCurrent"
                  >
                    덮어쓰기
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="!selectedFingeringLayoutPresetId"
                    @click.prevent="renameSelectedFingeringLayoutPreset"
                  >
                    이름 변경
                  </Button>

                  <Button
                    size="sm"
                    variant="danger"
                    :disabled="!selectedFingeringLayoutPresetId"
                    @click.prevent="deleteSelectedFingeringLayoutPreset"
                  >
                    삭제
                  </Button>
                </div>

                <div class="flex flex-wrap items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="!selectedFingeringLayoutPresetId"
                    @click.prevent="exportSelectedFingeringLayoutPreset"
                  >
                    프리셋 내보내기
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    @click.prevent="triggerFingeringLayoutPresetImport"
                  >
                    프리셋 가져오기
                  </Button>

                  <input
                    ref="fingeringLayoutPresetFileInput"
                    type="file"
                    accept="application/json,.json"
                    class="hidden"
                    @change="onFingeringLayoutPresetFileChange"
                  />

                  <div class="flex-grow"></div>
                  <div class="text-[11px] text-gray-500">
                    저장 위치: 이 브라우저/앱의 localStorage
                  </div>
                </div>
              </div>

              <textarea
                class="w-full text-xs px-2 py-2 border border-gray-700 rounded bg-transparent text-gray-200 font-mono"
                style="min-height: 220px;"
                :value="fingeringSaxLayoutOverrideText"
                @input="onFingeringSaxLayoutOverrideInput($event)"
                @compositionstart="onFingeringSaxLayoutOverrideCompositionStart"
                @compositionend="onFingeringSaxLayoutOverrideCompositionEnd($event)"
              />
              <div v-if="fingeringSaxLayoutOverrideError" class="text-xs text-red-400 mt-2">
                {{ fingeringSaxLayoutOverrideError }}
                <span class="ml-2 text-gray-500">(유효하지 않으면 기본 레이아웃으로 표시됩니다)</span>
              </div>
            </div>
          </div>
          <p class="text-sm mb-3">
            키 조합(눌린 키 목록) → 노트(0-127)를 테이블로 지정합니다. 현재 펌웨어는 “정확히 일치하는 키 조합”만 인식하며,
            동일한 키 조합(마스크)이 여러 개면 인덱스가 낮은 항목이 우선입니다.
          </p>

          <div v-if="showFingeringTable">

          <Hero
            v-if="fingeringSupport === 'unsupported'"
            custom="h-20"
            title="이 펌웨어에서는 핑거링 테이블을 지원하지 않습니다."
          />

          <div v-else class="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-3">
            <span>
              펌웨어 지원:
              <strong class="text-gray-200">
                {{
                  fingeringSupport === "supported"
                    ? "지원됨"
                    : fingeringSupport === "unsupported"
                      ? "미지원"
                      : "확인중"
                }}
              </strong>
            </span>
            <span>
              엔트리: <strong class="text-gray-200">{{ fingeringEntryCount }}</strong>
            </span>
            <div class="flex-grow"></div>
            <Button size="sm" variant="secondary" @click.prevent="reloadFingering">
              새로고침
            </Button>
          </div>

          <div v-if="fingeringSupport !== 'unsupported'" class="surface-neutral border rounded px-3 py-2 mb-3">
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model="fingeringFilterText"
                class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                style="min-width: 220px;"
                placeholder="#엔트리(1-128), 키(예: 1,2,3), 노트(예: 60 또는 C4)"
              />

              <div class="text-xs text-gray-300 flex items-center gap-1">
                사용 엔트리(자동)
                <strong class="text-gray-200">{{ fingeringActiveEntryCount }}</strong>
                <span class="text-gray-500">( #1 ~ #{{ fingeringActiveEntryCount }} )</span>
              </div>

              <div class="flex items-center gap-2">
                <div class="text-xs text-gray-300">
                  사용 키:
                  <strong class="text-gray-200">{{ fingeringUsableKeyCount }}</strong>
                  / 24
                </div>

                <div class="flex items-center gap-1 text-[11px]">
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="fingeringSupport === 'unsupported'"
                    @click.prevent="applyFingeringControllerPreset('sax24')"
                  >
                    전체(24)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    :disabled="fingeringSupport === 'unsupported'"
                    @click.prevent="showFingeringUsableKeySelector = !showFingeringUsableKeySelector"
                  >
                    {{ showFingeringUsableKeySelector ? "사용 키 닫기" : "사용 키 선택" }}
                  </Button>
                </div>

                <span class="text-[11px] text-gray-500">
                  선택된 키만 편집/텍스트 입력/저장에서 사용
                </span>

                <label class="text-xs text-gray-300 flex items-center gap-1">
                  <input type="checkbox" v-model="hideUnusableFingeringKeys" />
                  비사용 키 숨김
                </label>
              </div>
            <div
              v-if="showFingeringUsableKeySelector && fingeringSupport !== 'unsupported'"
              class="mt-3 border border-gray-800/60 rounded-md px-2 py-2"
            >
              <div class="text-[11px] text-gray-400 mb-2">
                하드웨어에 존재하는 키(버튼)만 선택하세요. 비선택 키는 편집/입력에서 무시됩니다.
              </div>

              <label class="text-xs text-gray-300 flex items-center gap-1 mb-2">
                <input type="checkbox" v-model="hideUnselectedKeysInKeySelector" />
                미선택 키 숨김
              </label>

              <SaxFingeringKeyPad
                :mask="fingeringUiUsableKeyMask"
                :disabled="fingeringSupport === 'unsupported'"
                :key-count="24"
                :labels="fingeringKeyLabels"
                :show-index="true"
                layout-mode="grouped"
                :sax-layout-override="fingeringSaxLayoutOverride"
                :visible-mask="hideUnselectedKeysInKeySelector ? fingeringUiUsableKeyMask : null"
                @update:mask="(m) => (fingeringUiUsableKeyMask = m)"
              />
              <div class="text-[11px] text-gray-500 mt-2">
                팁: 비연속 구성(예: 0,1,2,4,5...)도 여기서 그대로 체크하면 됩니다.
              </div>
            </div>

              <label class="text-xs text-gray-300 flex items-center gap-1">
                <input type="checkbox" v-model="fingeringFilterOnlyEnabled" />
                사용 중만
              </label>

              <label class="text-xs text-gray-300 flex items-center gap-1">
                <input type="checkbox" v-model="fingeringFilterOnlyWithKeys" />
                키 지정됨만
              </label>

              <label class="text-xs text-gray-300 flex items-center gap-1">
                <input type="checkbox" v-model="fingeringFilterOnlyWithNote" />
                노트 지정됨만
              </label>

              <Button size="sm" variant="secondary" @click.prevent="resetFingeringFilters">
                초기화
              </Button>

              <Button
                size="sm"
                variant="secondary"
                :disabled="fingeringLoading"
                @click.prevent="showFingeringCapturePanel = !showFingeringCapturePanel"
              >
                {{ showFingeringCapturePanel ? "캡처 닫기" : "캡처" }}
              </Button>

              <div class="flex-grow"></div>
              <div class="text-xs text-gray-400">
                표시: <strong class="text-gray-200">{{ visibleFingeringEntries.length }}</strong> / {{ fingeringActiveEntryCount }}
              </div>
            </div>

          </div>

          <div v-if="showFingeringCapturePanel" class="fixed inset-0 z-50" style="z-index: 9999;">
            <div
              class="absolute inset-0 bg-black bg-opacity-60"
              @click.prevent="showFingeringCapturePanel = false"
            ></div>

            <div class="absolute inset-0 pointer-events-none">
              <div
                ref="capturePanelCardEl"
                class="absolute surface-neutral border rounded w-full flex flex-col shadow-xl pointer-events-auto"
                style="max-width: 640px; max-height: calc(100% - 2rem);"
                :style="capturePanelCardStyle"
              >
                <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-800/60 select-none">
                  <div
                    class="text-sm text-gray-200 font-semibold cursor-move"
                    title="드래그해서 위치 이동"
                    @pointerdown="onCapturePanelDragStart"
                  >
                    키맵 캡처
                  </div>
                  <div class="text-[11px] text-gray-500">
                    현재 눌림(키 마스크)을 읽거나, 수동으로 입력해 원하는 노트로 저장합니다.
                  </div>
                  <div class="flex-grow"></div>
                  <Button size="sm" variant="secondary" @click.prevent="resetCapturePanelPosition">
                    위치 초기화
                  </Button>
                  <Button size="sm" variant="secondary" @click.prevent="showFingeringCapturePanel = false">
                    닫기
                  </Button>
                </div>

                <div class="px-3 py-3 overflow-y-auto">
                  <div class="flex flex-wrap items-center gap-2">
                    <label class="text-xs text-gray-300 flex items-center gap-1">
                      <input type="checkbox" v-model="capturePanelManualMode" />
                      수동 입력(키패드 클릭)
                    </label>

                    <Button
                      size="sm"
                      variant="secondary"
                      :disabled="fingeringLoading"
                      @click.prevent="clearCapturePanelSelection"
                      title="선택된 키 조합을 초기화합니다"
                    >
                      선택 초기화
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      :disabled="!isConnected || fingeringSupport !== 'supported' || fingeringLoading"
                      @click.prevent="clearCapturePanelDevicePressedMask"
                      title="Nextion(Latching) 캡처에서 이전 눌림이 남아있을 때 초기화합니다"
                    >
                      장치 눌림 초기화
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      :disabled="
                        capturePanelManualMode ||
                        !isConnected ||
                        fingeringSupport !== 'supported' ||
                        fingeringLoading
                      "
                      @click.prevent="refreshCapturePanelPressedMask"
                    >
                      현재 눌림 읽기
                    </Button>

                    <div class="text-xs text-gray-200">
                      눌린 키(사용 키만):
                      <strong class="text-gray-100">{{ capturePanelPressedKeyCount }}개</strong>
                      <span class="text-gray-400 ml-2">(번호: {{ capturePanelPressedKeysText || "-" }})</span>
                      <span class="text-[11px] text-gray-500 ml-2">{{ capturePanelPressedMaskHex }}</span>
                    </div>

                    <div class="flex items-center gap-2 px-2 py-1 border border-gray-800/60 rounded">
                      <label class="text-xs text-gray-300 flex items-center gap-1 mr-1">
                        <input type="checkbox" v-model="capturePanelContinuousMode" />
                        연속 저장
                      </label>
                      <label class="text-xs text-gray-200">노트(0-127)</label>
                      <input
                        ref="capturePanelNoteInput"
                        v-model="capturePanelNoteDraft"
                        class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                        style="width: 110px;"
                        type="number"
                        min="0"
                        max="127"
                        step="1"
                        placeholder="예: 60"
                        title="마우스 휠로 증감 (Shift=12단위)"
                        @wheel="onCapturePanelNoteWheel"
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        :disabled="!isConnected || fingeringSupport !== 'supported' || fingeringLoading"
                        @click.prevent="saveCapturePanelToNote"
                      >
                        저장
                      </Button>
                    </div>

                    <div class="flex-grow"></div>
                  </div>

                  <div class="text-[11px] text-gray-400 mt-2 min-h-[14px]">
                    {{ capturePanelStatusText }}
                  </div>

                  <div class="mt-2 surface-neutral border border-gray-800/60 rounded px-3 py-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <div class="text-xs text-gray-200 font-semibold">터치스크린 키 설정</div>
                      <div class="text-[11px] text-gray-400">
                        Nextion 단일 터치 환경에서는 조합 입력을 위해 <span class="font-mono">Latching</span> 토글이 필요합니다.
                        아래 버튼은 Buttons 블록의 Touchscreen 그룹(24개)에 대해
                        <span class="font-mono">Type=Latching</span>과 키 번호(<span class="font-mono">0..23</span>)를 일괄 적용합니다.
                        (권장: <span class="font-mono">Sax Fingering Key (no MIDI)</span>)
                      </div>
                      <div class="flex-grow"></div>
                      <Button
                        size="sm"
                        variant="secondary"
                        :disabled="!isConnected || fingeringSupport !== 'supported' || fingeringLoading || touchscreenFingeringSetupBusy"
                        @click.prevent="setupTouchscreenFingeringButtons('no-midi')"
                        title="터치스크린 24키를 핑거링 키로 자동 설정"
                      >
                        {{ touchscreenFingeringSetupBusy ? "설정 중..." : "넥션 캡처용 24키 설정(추천)" }}
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        :disabled="!isConnected || fingeringSupport !== 'supported' || fingeringLoading || touchscreenFingeringSetupBusy"
                        @click.prevent="setupTouchscreenFingeringButtons('disable')"
                        title="문제 발생 시: 터치스크린 24키를 안전하게 비활성화(메시지 없음)"
                      >
                        {{ touchscreenFingeringSetupBusy ? "설정 중..." : "24키 비활성화" }}
                      </Button>
                    </div>
                    <div v-if="touchscreenFingeringSetupNotice" class="mt-1 text-[11px]" :class="touchscreenFingeringSetupNoticeIsError ? 'text-red-400' : 'text-green-300'">
                      {{ touchscreenFingeringSetupNotice }}
                    </div>
                  </div>

                  <div class="mt-3">
                    <div class="text-xs text-gray-200 mb-1">현재 눌림(미리보기)</div>
                    <SaxFingeringKeyPad
                      :mask="capturePanelPressedMask"
                      :disabled="!capturePanelManualMode"
                      @update:mask="(m) => (capturePanelPressedMask = m)"
                      :key-count="24"
                      :usable-mask="fingeringUiUsableKeyMask"
                      :hide-unusable-keys="false"
                      :labels="fingeringKeyLabels"
                      :show-index="showFingeringKeyIndex"
                      :layout-mode="fingeringKeyPadLayoutMode"
                      :sax-layout-override="fingeringSaxLayoutOverride"
                    />
                    <div class="text-[11px] text-gray-500 mt-1">
                      표시되는 키는 “사용 키” 설정과 “비사용 키 숨김” 옵션을 따릅니다.
                    </div>
                  </div>

                  <div class="text-[11px] text-gray-500 mt-3">
                    팁: ESC 키로 닫을 수 있습니다. 저장 시 동일 키조합 중복은 자동으로 기존 엔트리로 이동합니다.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="fingeringSupport !== 'unsupported'"
            class="surface-neutral border rounded px-3 py-2 mb-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <div class="text-xs text-gray-300 font-semibold">키 라벨</div>

              <select
                class="text-sm px-2 py-1 border border-gray-700 rounded bg-transparent text-gray-200"
                :value="fingeringKeyLabelPreset"
                @change="onFingeringLabelPresetChange($event)"
              >
                <option value="sax">색소폰 표준(추천)</option>
                <option value="numbers">0-23 숫자</option>
              </select>

              <label class="text-xs text-gray-300 flex items-center gap-1">
                <input type="checkbox" v-model="showFingeringKeyIndex" />
                인덱스(#0-23) 표시
              </label>

              <Button
                size="sm"
                variant="secondary"
                @click.prevent="showFingeringLabelEditor = !showFingeringLabelEditor"
              >
                {{ showFingeringLabelEditor ? "라벨 편집 닫기" : "라벨 편집" }}
              </Button>

              <div class="flex-grow"></div>

              <Button
                size="sm"
                variant="secondary"
                @click.prevent="resetFingeringLabelsToPreset()"
              >
                프리셋으로 초기화
              </Button>
            </div>

            <div v-if="showFingeringLabelEditor" class="mt-3">
              <div class="text-xs text-gray-400 mb-2">
                위에서부터 <strong class="text-gray-200">키 #0</strong> ~ <strong class="text-gray-200">키 #23</strong>
                순서로 1줄에 1개씩 입력하세요.
              </div>
              <textarea
                class="w-full text-sm px-2 py-2 border border-gray-700 rounded bg-transparent text-gray-200 font-mono"
                style="min-height: 220px;"
                :value="fingeringKeyLabelsText"
                @input="onFingeringKeyLabelsTextInput($event)"
                @compositionstart="onFingeringKeyLabelsTextCompositionStart"
                @compositionend="onFingeringKeyLabelsTextCompositionEnd($event)"
              />
              <div class="text-[11px] text-gray-500 mt-2">
                팁: 라벨은 UI 표시용이며 펌웨어 인덱스/기능은 바뀌지 않습니다.
              </div>
            </div>
          </div>

          

          <div
            v-if="fingeringEntryLayoutMode === 'horizontal'"
            ref="fingeringEntriesScrollEl"
            @scroll.passive="updateFingeringScrollButtons"
            class="flex gap-2 overflow-x-auto pb-2"
            style="scrollbar-gutter: stable; scroll-snap-type: x mandatory; scroll-padding-left: 4px; scroll-padding-right: 4px;"
          >
            <div
              v-for="entry in visibleFingeringEntries"
              :key="`fing-${entry.index}`"
              :ref="setFingeringEntryEl(entry.index)"
              :data-fingering-entry="entry.index"
              class="surface-neutral border rounded px-2 py-2 flex-none"
              style="width: 340px; scroll-snap-align: start;"
              :class="{ 'ring-2 ring-blue-500': activeFingeringEntryIndex === entry.index, 'opacity-80': !entry.enabled }"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs"><strong>#{{ entry.index + 1 }}</strong></div>
                <div class="flex items-center gap-3">
                  <label class="text-xs text-gray-200">
                    <input
                      type="checkbox"
                      :checked="entry.enabled"
                      @change="onFingeringEnabledChange(entry.index, $event)"
                    />
                    사용(매핑)
                  </label>
                </div>
              </div>

              <div v-if="!entry.enabled" class="text-[11px] text-gray-300 mb-2">
                비활성: 이 엔트리는 매핑에서 제외됩니다. (편집은 가능)
              </div>

              <label class="text-xs text-gray-200 block mb-1">눌린 키 (사용 키만)</label>
              <SaxFingeringKeyPad
                class="mb-2"
                :mask="entry.mask"
                :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                :key-count="24"
                :usable-mask="fingeringUiUsableKeyMask"
                :hide-unusable-keys="hideUnusableFingeringKeys"
                :labels="fingeringKeyLabels"
                :show-index="showFingeringKeyIndex"
                :layout-mode="fingeringKeyPadLayoutMode"
                :sax-layout-override="fingeringSaxLayoutOverride"
                @update:mask="(m) => setFingeringMask(entry.index, m)"
              />

              <div class="flex items-center gap-2 mt-2">
                <div class="text-xs text-gray-200 font-semibold">텍스트/노트</div>
                <div class="flex-grow"></div>
                <Button
                  size="sm"
                  variant="secondary"
                  @click.prevent="toggleFingeringEntryDetails(entry.index)"
                >
                  {{ isFingeringEntryDetailsOpen(entry.index) ? "접기" : "펼치기" }}
                </Button>
              </div>

              <div v-show="isFingeringEntryDetailsOpen(entry.index)">
                <div
                  v-if="getNoteAlternativesForEntry(entry.index, entry.note).length"
                  class="mt-2 border border-gray-800/60 rounded-md px-2 py-2"
                >
                  <div class="text-[11px] text-gray-300 font-semibold mb-1">대체키(같은 노트) - 최대 3개</div>
                  <div class="flex flex-col gap-1">
                    <button
                      v-for="altIndex in getNoteAlternativesForEntry(entry.index, entry.note)"
                      :key="`alt-note-${entry.index}-${altIndex}`"
                      type="button"
                      class="text-left text-[11px] text-gray-200 hover:text-white"
                      @click.prevent="jumpToFingeringEntry(altIndex)"
                    >
                        <span class="font-semibold">#{{ altIndex + 1 }}</span>
                      <span class="ml-2 font-mono text-gray-400">{{ fingeringEntries[altIndex]?.keysText }}</span>
                      <span v-if="!fingeringEntries[altIndex]?.enabled" class="ml-2 text-gray-500">(비활성)</span>
                    </button>
                  </div>
                </div>

                <label class="text-[11px] text-gray-300 block mt-2 mb-1">텍스트 입력 (고급)</label>
                <input
                  class="form-input mt-1 py-1 text-sm block w-full font-mono"
                  :value="entry.keysText"
                  :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                  @change="onFingeringKeysChange(entry.index, $event)"
                />

                <label class="text-xs text-gray-200 block mt-3 mb-1">노트 (0-127)</label>
                <input
                  class="form-input mt-1 py-1 text-sm block w-full"
                  type="number"
                  min="0"
                  max="127"
                  :value="entry.note"
                  :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                  :ref="setFingeringNoteInputEl(entry.index)"
                  @change="onFingeringNoteChange(entry.index, $event)"
                />

                
              </div>
            </div>
          </div>

          <div
            v-else
            class="grid gap-2"
            style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));"
          >
            <div
              v-for="entry in visibleFingeringEntries"
              :key="`fing-${entry.index}`"
              :ref="setFingeringEntryEl(entry.index)"
              :data-fingering-entry="entry.index"
              class="surface-neutral border rounded px-2 py-2"
              :class="{ 'ring-2 ring-blue-500': activeFingeringEntryIndex === entry.index, 'opacity-80': !entry.enabled }"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs"><strong>#{{ entry.index + 1 }}</strong></div>
                <div class="flex items-center gap-3">
                  <label class="text-xs text-gray-200">
                    <input
                      type="checkbox"
                      :checked="entry.enabled"
                      @change="onFingeringEnabledChange(entry.index, $event)"
                    />
                    사용(매핑)
                  </label>
                </div>
              </div>

              <div v-if="!entry.enabled" class="text-[11px] text-gray-300 mb-2">
                비활성: 이 엔트리는 매핑에서 제외됩니다. (편집은 가능)
              </div>

              <label class="text-xs text-gray-200 block mb-1">눌린 키 (사용 키만)</label>
              <SaxFingeringKeyPad
                class="mb-2"
                :mask="entry.mask"
                :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                :key-count="24"
                :usable-mask="fingeringUiUsableKeyMask"
                :hide-unusable-keys="hideUnusableFingeringKeys"
                :labels="fingeringKeyLabels"
                :show-index="showFingeringKeyIndex"
                :layout-mode="fingeringKeyPadLayoutMode"
                :sax-layout-override="fingeringSaxLayoutOverride"
                @update:mask="(m) => setFingeringMask(entry.index, m)"
              />

              <div class="flex items-center gap-2 mt-2">
                <div class="text-xs text-gray-200 font-semibold">텍스트/노트</div>
                <div class="flex-grow"></div>
                <Button
                  size="sm"
                  variant="secondary"
                  @click.prevent="toggleFingeringEntryDetails(entry.index)"
                >
                  {{ isFingeringEntryDetailsOpen(entry.index) ? "접기" : "펼치기" }}
                </Button>
              </div>

              <div v-show="isFingeringEntryDetailsOpen(entry.index)">
                <div
                  v-if="getNoteAlternativesForEntry(entry.index, entry.note).length"
                  class="mt-2 border border-gray-800/60 rounded-md px-2 py-2"
                >
                  <div class="text-[11px] text-gray-300 font-semibold mb-1">대체키(같은 노트) - 최대 3개</div>
                  <div class="flex flex-col gap-1">
                    <button
                      v-for="altIndex in getNoteAlternativesForEntry(entry.index, entry.note)"
                      :key="`alt-note-grid-${entry.index}-${altIndex}`"
                      type="button"
                      class="text-left text-[11px] text-gray-200 hover:text-white"
                      @click.prevent="jumpToFingeringEntry(altIndex)"
                    >
                      <span class="font-semibold">#{{ altIndex + 1 }}</span>
                      <span class="ml-2 font-mono text-gray-400">{{ fingeringEntries[altIndex]?.keysText }}</span>
                      <span v-if="!fingeringEntries[altIndex]?.enabled" class="ml-2 text-gray-500">(비활성)</span>
                    </button>
                  </div>
                </div>

                <label class="text-[11px] text-gray-300 block mt-2 mb-1">텍스트 입력 (고급)</label>
                <input
                  class="form-input mt-1 py-1 text-sm block w-full font-mono"
                  :value="entry.keysText"
                  :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                  @change="onFingeringKeysChange(entry.index, $event)"
                />

                <label class="text-xs text-gray-200 block mt-3 mb-1">노트 (0-127)</label>
                <input
                  class="form-input mt-1 py-1 text-sm block w-full"
                  type="number"
                  min="0"
                  max="127"
                  :value="entry.note"
                  :disabled="fingeringLoading || !isConnected || fingeringSupport !== 'supported'"
                  :ref="setFingeringNoteInputEl(entry.index)"
                  @change="onFingeringNoteChange(entry.index, $event)"
                />

                
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </Section>
  </form>
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { Block, SectionType, BlockMap, AnalogType, ButtonMessageType } from "../index";
import { useDeviceForm } from "../../composables";
import { midiStoreMapped, deviceStoreMapped, deviceStore } from "../../store";
import SaxFingeringKeyPad from "./SaxFingeringKeyPad.vue";
import SaxFingeringLayoutDragEditor from "./SaxFingeringLayoutDragEditor.vue";
import InfoTooltip from "../../components/elements/InfoTooltip.vue";
import {
  DEFAULT_SAX_LAYOUT_24,
  SaxLayoutKey,
  detectSaxLayoutCollision,
  relocateSaxLayoutKeysToAvoidCollisions,
} from "./sax-fingering-layout";

export default defineComponent({
  name: "MidiSaxophone",
  components: {
    SaxFingeringKeyPad,
    SaxFingeringLayoutDragEditor,
    InfoTooltip,
  },
  setup() {
    const { isConnected } = midiStoreMapped;

    const pressurePbPresetBusy = ref(false);
    const pressurePbPresetNotice = ref<string>("");

    const isMidisaxoBoard = computed((): boolean => {
      const board = String(deviceStore.state?.boardName || "").toLowerCase();
      return board.includes("midisaxo");
    });

    const pbQuickBusy = ref(false);
    const pbQuickError = ref<string | null>(null);
    const pbDeadzoneValue = ref<number | null>(null);
    const pbDeadzoneDraft = ref<number>(0);

    const refreshPbDeadzone = async (): Promise<void> => {
      pbQuickError.value = null;
      pbQuickBusy.value = true;
      try {
        const v = await deviceStoreMapped.saxPitchBendDeadzoneGet();
        pbDeadzoneValue.value = Number(v);
        if (Number.isFinite(pbDeadzoneValue.value)) {
          pbDeadzoneDraft.value = pbDeadzoneValue.value;
        }
      } catch (e: any) {
        pbQuickError.value = String(e?.message || e || "Failed to read deadzone");
      } finally {
        pbQuickBusy.value = false;
      }
    };

    const onPbCenterCapture = async (): Promise<void> => {
      pbQuickError.value = null;
      pbQuickBusy.value = true;
      try {
        await deviceStoreMapped.saxPitchBendCenterCapture();
      } catch (e: any) {
        pbQuickError.value = String(e?.message || e || "Failed to capture PB center");
      } finally {
        pbQuickBusy.value = false;
      }
    };

    const onPbDeadzoneInc = async (): Promise<void> => {
      pbQuickError.value = null;
      pbQuickBusy.value = true;
      try {
        await deviceStoreMapped.saxPitchBendDeadzoneInc();
        await refreshPbDeadzone();
      } catch (e: any) {
        pbQuickError.value = String(e?.message || e || "Failed to increase deadzone");
      } finally {
        pbQuickBusy.value = false;
      }
    };

    const onPbDeadzoneDec = async (): Promise<void> => {
      pbQuickError.value = null;
      pbQuickBusy.value = true;
      try {
        await deviceStoreMapped.saxPitchBendDeadzoneDec();
        await refreshPbDeadzone();
      } catch (e: any) {
        pbQuickError.value = String(e?.message || e || "Failed to decrease deadzone");
      } finally {
        pbQuickBusy.value = false;
      }
    };

    const onPbDeadzoneDraftChange = (event: Event): void => {
      const target = event && (event.target as unknown as HTMLInputElement);
      const v = Math.trunc(Number(target?.value ?? 0));
      pbDeadzoneDraft.value = Math.min(2000, Math.max(0, Number.isFinite(v) ? v : 0));
    };

    const onPbDeadzoneSet = async (): Promise<void> => {
      pbQuickError.value = null;
      pbQuickBusy.value = true;
      try {
        await deviceStoreMapped.saxPitchBendDeadzoneSet(pbDeadzoneDraft.value);
        await refreshPbDeadzone();
      } catch (e: any) {
        pbQuickError.value = String(e?.message || e || "Failed to set deadzone");
      } finally {
        pbQuickBusy.value = false;
      }
    };

    watch(
      () => [isConnected.value, isMidisaxoBoard.value],
      ([connected, isSax]) => {
        if (connected && isSax) {
          void refreshPbDeadzone();
        }
      },
      { immediate: true },
    );

    const fingeringMaskLo14 = ref<number[] | null>(null);
    const fingeringMaskHi10Enable = ref<number[] | null>(null);
    const fingeringNote = ref<number[] | null>(null);
    const fingeringSupport = ref<"unknown" | "supported" | "unsupported">(
      "unknown",
    );
    const fingeringLoading = ref(false);

    const touchscreenFingeringSetupBusy = ref(false);
    const touchscreenFingeringSetupNotice = ref<string>("");
    const touchscreenFingeringSetupNoticeIsError = ref(false);

    const setupTouchscreenFingeringButtons = async (
      mode: "no-midi" | "disable" = "no-midi",
    ): Promise<void> => {
      touchscreenFingeringSetupNotice.value = "";
      touchscreenFingeringSetupNoticeIsError.value = false;

      if (touchscreenFingeringSetupBusy.value) {
        return;
      }

      if (!isConnected.value) {
        touchscreenFingeringSetupNotice.value = "보드가 연결되어 있어야 합니다.";
        touchscreenFingeringSetupNoticeIsError.value = true;
        return;
      }

      const comps = deviceStoreMapped.numberOfComponents.value || [];
      const buttonsTotal = Number(comps[Block.Button] ?? 0);
      const tsCount = Number(comps[Block.Touchscreen] ?? 0);

      if (!Number.isFinite(buttonsTotal) || buttonsTotal <= 0) {
        touchscreenFingeringSetupNotice.value = "Buttons 컴포넌트 수를 읽지 못했습니다. 홈에서 보드 재선택 후 다시 시도하세요.";
        touchscreenFingeringSetupNoticeIsError.value = true;
        return;
      }

      if (!Number.isFinite(tsCount) || tsCount < 24) {
        touchscreenFingeringSetupNotice.value = `Touchscreen 컴포넌트 수가 ${tsCount}로 보고되어 자동 설정을 진행할 수 없습니다. (펌웨어/타겟 설정에서 터치스크린 컴포넌트가 24개로 선언되어야 합니다.)`;
        touchscreenFingeringSetupNoticeIsError.value = true;
        return;
      }

      const tsStartIndex = buttonsTotal - tsCount;
      if (tsStartIndex < 0) {
        touchscreenFingeringSetupNotice.value = `인덱스 계산이 비정상입니다. (buttonsTotal=${buttonsTotal}, tsCount=${tsCount})`;
        touchscreenFingeringSetupNoticeIsError.value = true;
        return;
      }

      touchscreenFingeringSetupBusy.value = true;
      try {
        const messageType =
          mode === "disable"
            ? ButtonMessageType.None
            : ButtonMessageType.SaxFingeringKey;

        const yieldToUi = async (): Promise<void> =>
          new Promise((resolve) => setTimeout(resolve, 0));

        // Apply mapping to first 24 touchscreen components.
        // Buttons block sections:
        // 0 = Type, 1 = Message type, 2 = MIDI ID, 3 = Value
        for (let i = 0; i < 24; i++) {
          const index = tsStartIndex + i;

          touchscreenFingeringSetupNotice.value = `설정 중... (${i + 1}/24)`;
          touchscreenFingeringSetupNoticeIsError.value = false;

          await deviceStoreMapped.setComponentSectionValue(
            { block: Block.Button, section: 0, index, value: 1 },
            () => {},
          );

          await deviceStoreMapped.setComponentSectionValue(
            {
              block: Block.Button,
              section: 1,
              index,
              value: messageType,
            },
            () => {},
          );

          await deviceStoreMapped.setComponentSectionValue(
            { block: Block.Button, section: 2, index, value: i },
            () => {},
          );

          await deviceStoreMapped.setComponentSectionValue(
            {
              block: Block.Button,
              section: 3,
              index,
              value: mode === "disable" ? 0 : 127,
            },
            () => {},
          );

          // Prevent long sync loops from freezing the UI and reduce the chance
          // of perceived "stuck" state while the device request queue drains.
          await yieldToUi();
        }

        const modeLabel = mode === "disable" ? "비활성화" : "무MIDI";
        touchscreenFingeringSetupNotice.value = `완료(${modeLabel}): Buttons→Touchscreen (${tsStartIndex}..${tsStartIndex + 23})에 24키 설정을 적용했습니다.`;
      } catch (e: any) {
        touchscreenFingeringSetupNotice.value = String(
          e?.message || e || "터치스크린 핑거링 자동 설정에 실패했습니다.",
        );
        touchscreenFingeringSetupNoticeIsError.value = true;
      } finally {
        touchscreenFingeringSetupBusy.value = false;
      }
    };

    const activeFingeringEntryIndex = ref<number | null>(null);
    const fingeringEntryEls = new Map<number, HTMLElement>();
    const fingeringNoteInputEls = new Map<number, HTMLInputElement>();

    const fingeringEntryCount = 128;

    // Default to ~4 octaves worth of notes (12*4 + 1 = 49).
    // This is only the initial default; if the user already has a saved value in
    // localStorage, `loadUiState()` will restore it.
    const defaultFingeringActiveEntryCount = 49;

    const showFingeringTable = ref(false);

    const showSaxHelpPanel = ref(false);

    const fingeringFilterText = ref("");
    const fingeringFilterOnlyEnabled = ref(false);
    const fingeringFilterOnlyWithKeys = ref(false);
    const fingeringFilterOnlyWithNote = ref(false);

    const saxKeyLabelPresets: Record<"sax" | "numbers", string[]> = {
      // 인덱스(0-23)는 펌웨어 내부 키 번호이고, 라벨은 UI 표시용입니다.
      sax: [
        "Octave",
        "LH 1",
        "LH 2",
        "LH 3",
        "RH 1",
        "RH 2",
        "RH 3",
        "Low F#",
        "Alt",
        "Bis Bb",
        "G#",
        "Palm D",
        "Palm Eb",
        "Palm F",
        "Side C",
        "Side Bb",
        "Side F#",
        "Low Eb",
        "Low C",
        "Low B",
        "Low Bb",
        "Front F",
        "High F#",
        "Low C#",
      ],
      numbers: Array.from({ length: 24 }, (_, i) => String(i)),
    };

    const fingeringKeyLabelPreset = ref<"sax" | "numbers">("sax");
    const fingeringKeyLabels = ref<string[]>([...saxKeyLabelPresets.sax]);
    const showFingeringKeyIndex = ref(false);
    const showFingeringLabelEditor = ref(false);
    const showFingeringLayoutEditor = ref(false);
    const fingeringSaxLayoutOverrideText = ref<string>("");
    const fingeringLayoutFileInput = ref<HTMLInputElement | null>(null);
    const fingeringLayoutPresetFileInput = ref<HTMLInputElement | null>(null);

    type FingeringLayoutPresetV1 = {
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
      layout: SaxLayoutKey[];
    };

    const fingeringLayoutPresets = ref<FingeringLayoutPresetV1[]>([]);
    const activeFingeringLayoutPresetId = ref<string | null>(null);
    const selectedFingeringLayoutPresetId = ref<string | null>(null);
    const fingeringLayoutPresetNameDraft = ref<string>("");

    const fingeringLayoutAutoRelocateNotice = ref<string>("");
    let fingeringLayoutAutoRelocateNoticeTimer: number | null = null;

    const normalizeSaxLayoutForEditor = (raw: unknown): SaxLayoutKey[] => {
      const baseByIdx = new Map<number, SaxLayoutKey>();
      for (const k of DEFAULT_SAX_LAYOUT_24) {
        baseByIdx.set(k.idx, { ...k });
      }

      const arr = Array.isArray(raw) ? (raw as any[]) : [];
      for (const item of arr) {
        const idx = Math.max(0, Math.min(23, Math.floor(Number(item?.idx) || 0)));
        const base = baseByIdx.get(idx);
        if (!base) {
          continue;
        }

        const row = Number(item?.row);
        const col = Number(item?.col);
        if (Number.isFinite(row) && row >= 1) {
          base.row = Math.floor(row);
        }
        if (Number.isFinite(col) && col >= 1) {
          base.col = Math.floor(col);
        }

        if (item?.rowSpan !== undefined) {
          base.rowSpan = Math.max(1, Math.floor(Number(item?.rowSpan) || 1));
        }
        if (item?.colSpan !== undefined) {
          base.colSpan = Math.max(1, Math.floor(Number(item?.colSpan) || 1));
        }
        if (item?.big !== undefined) {
          base.big = !!item?.big;
        }
      }

      return Array.from({ length: 24 }, (_, i) => baseByIdx.get(i) as SaxLayoutKey);
    };

    const fingeringSaxLayoutOverride = computed((): any[] | undefined => {
      const raw = String(fingeringSaxLayoutOverrideText.value || "").trim();
      if (!raw) {
        return undefined;
      }
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as any[]) : undefined;
      } catch {
        return undefined;
      }
    });

    const fingeringSaxLayoutOverrideError = computed((): string | null => {
      const raw = String(fingeringSaxLayoutOverrideText.value || "").trim();
      if (!raw) {
        return null;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          return "레이아웃은 JSON 배열이어야 합니다.";
        }
        if (parsed.length !== 24) {
          return "레이아웃 배열은 24개(0..23)를 포함해야 합니다.";
        }
        return null;
      } catch {
        return "레이아웃 JSON 파싱에 실패했습니다.";
      }
    });

    const full24Mask = 0x00ffffff;

    const fingeringUiUsableKeyMask = ref<number>(full24Mask);
    const showFingeringUsableKeySelector = ref(false);
    const hideUnusableFingeringKeys = ref(false);
    const hideUnselectedKeysInKeySelector = ref(false);

    const normalizeUsableMask = (value: unknown): number => {
      const v = (Number(value) >>> 0) & full24Mask;
      // 최소 1키는 남기기
      return v !== 0 ? v : 1;
    };

    const fingeringUsableKeyCount = computed((): number => {
      const m = fingeringUiUsableKeyMask.value >>> 0;
      let cnt = 0;
      for (let i = 0; i < 24; i++) {
        if ((m >>> i) & 1) {
          cnt++;
        }
      }
      return cnt;
    });

    const fingeringKeyPadLayoutMode = computed((): "sax" | "linear" => {
      // 사용 키 수가 적으면 linear로 단순 표시
      if (hideUnusableFingeringKeys.value && fingeringUsableKeyCount.value < 24) {
        return "linear";
      }
      return fingeringUsableKeyCount.value <= 10 ? "linear" : "sax";
    });

    type FingeringEntryLayoutMode = "grid" | "horizontal";
    const fingeringEntryLayoutMode = ref<FingeringEntryLayoutMode>("horizontal");

    type FingeringEntryScrollStepMode = "entry" | "page3";
    const fingeringEntryScrollStepMode = ref<FingeringEntryScrollStepMode>("page3");

    const fingeringEntriesScrollEl = ref<HTMLElement | null>(null);
    const canScrollFingeringLeft = ref(false);
    const canScrollFingeringRight = ref(false);

    const updateFingeringScrollButtons = (): void => {
      const el = fingeringEntriesScrollEl.value;
      if (!el || fingeringEntryLayoutMode.value !== "horizontal") {
        canScrollFingeringLeft.value = false;
        canScrollFingeringRight.value = false;
        return;
      }

      const left = el.scrollLeft;
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);

      canScrollFingeringLeft.value = left > 0;
      // allow a tiny epsilon for fractional scroll positions
      canScrollFingeringRight.value = left < maxLeft - 1;
    };

    const getFingeringEntryStepPx = (el: HTMLElement): number => {
      const items = Array.from(el.querySelectorAll<HTMLElement>("[data-fingering-entry]"));
      if (items.length >= 2) {
        const step = items[1].offsetLeft - items[0].offsetLeft;
        return Math.max(120, Math.abs(step) || 0);
      }
      if (items.length === 1) {
        return Math.max(120, items[0].getBoundingClientRect().width);
      }
      return Math.max(120, el.clientWidth / 3);
    };

    const scrollFingeringEntriesByPage = (direction: number): void => {
      const el = fingeringEntriesScrollEl.value;
      if (!el || fingeringEntryLayoutMode.value !== "horizontal") {
        return;
      }

      const dir = Math.sign(Number(direction) || 0);
      if (!dir) {
        return;
      }

      const entriesPerStep = fingeringEntryScrollStepMode.value === "entry" ? 1 : 3;
      const stepPx = getFingeringEntryStepPx(el);
      el.scrollBy({ left: dir * stepPx * entriesPerStep, behavior: "smooth" });

      // After smooth scroll, update state a bit later.
      window.setTimeout(() => updateFingeringScrollButtons(), 200);
    };

    const uiStateKey = "opendeck.midisaxophone.ui";

    const clampFingeringUiKeyCount = (value: unknown): number => {
      const n = Math.floor(Number(value) || 24);
      return Math.max(1, Math.min(24, n));
    };

    const loadUiState = (): void => {
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(uiStateKey) : null;
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.showSaxHelpPanel === "boolean") {
            showSaxHelpPanel.value = parsed.showSaxHelpPanel;
          }

          if (typeof parsed.showFingeringTable === "boolean") {
            showFingeringTable.value = parsed.showFingeringTable;
          }

          if (typeof parsed.fingeringFilterText === "string") {
            fingeringFilterText.value = parsed.fingeringFilterText;
          }
          if (typeof parsed.fingeringFilterOnlyEnabled === "boolean") {
            fingeringFilterOnlyEnabled.value = parsed.fingeringFilterOnlyEnabled;
          }
          if (typeof parsed.fingeringFilterOnlyWithKeys === "boolean") {
            fingeringFilterOnlyWithKeys.value = parsed.fingeringFilterOnlyWithKeys;
          }
          if (typeof parsed.fingeringFilterOnlyWithNote === "boolean") {
            fingeringFilterOnlyWithNote.value = parsed.fingeringFilterOnlyWithNote;
          }

          // NOTE: fingeringActiveEntryCount is auto-derived (no localStorage restore).

          if (parsed.fingeringKeyLabelPreset === "sax" || parsed.fingeringKeyLabelPreset === "numbers") {
            fingeringKeyLabelPreset.value = parsed.fingeringKeyLabelPreset;
          } else if (parsed.fingeringKeyLabelPreset === "recorder8") {
            // Backward-compat: old UI preset value
            fingeringKeyLabelPreset.value = "numbers";
          }
          if (typeof parsed.showFingeringKeyIndex === "boolean") {
            showFingeringKeyIndex.value = parsed.showFingeringKeyIndex;
          }
          if (typeof parsed.showFingeringLabelEditor === "boolean") {
            showFingeringLabelEditor.value = parsed.showFingeringLabelEditor;
          }

          if (parsed.fingeringEntryScrollStepMode === "entry" || parsed.fingeringEntryScrollStepMode === "page3") {
            fingeringEntryScrollStepMode.value = parsed.fingeringEntryScrollStepMode;
          }

          if (typeof parsed.showFingeringLayoutEditor === "boolean") {
            showFingeringLayoutEditor.value = parsed.showFingeringLayoutEditor;
          }

          if (typeof parsed.fingeringSaxLayoutOverrideText === "string") {
            fingeringSaxLayoutOverrideText.value = parsed.fingeringSaxLayoutOverrideText;
          }

          if (Array.isArray(parsed.fingeringLayoutPresets)) {
            const next = parsed.fingeringLayoutPresets
              .slice(0, 50)
              .map((p: any) => {
                const id = String(p?.id || "").trim();
                const name = String(p?.name || "").trim() || "Preset";
                const createdAt = String(p?.createdAt || "");
                const updatedAt = String(p?.updatedAt || "");
                const layout = normalizeSaxLayoutForEditor(p?.layout);
                if (!id) {
                  return null;
                }
                return {
                  id,
                  name,
                  createdAt,
                  updatedAt,
                  layout,
                } as FingeringLayoutPresetV1;
              })
              .filter(Boolean) as FingeringLayoutPresetV1[];
            fingeringLayoutPresets.value = next;
          }
          if (typeof parsed.activeFingeringLayoutPresetId === "string") {
            activeFingeringLayoutPresetId.value = parsed.activeFingeringLayoutPresetId;
          }
          if (typeof parsed.selectedFingeringLayoutPresetId === "string") {
            selectedFingeringLayoutPresetId.value = parsed.selectedFingeringLayoutPresetId;
          }
          if (parsed.fingeringEntryLayoutMode === "grid" || parsed.fingeringEntryLayoutMode === "horizontal") {
            fingeringEntryLayoutMode.value = parsed.fingeringEntryLayoutMode;
          }

          if (typeof parsed.fingeringUiUsableKeyMask === "number") {
            fingeringUiUsableKeyMask.value = normalizeUsableMask(parsed.fingeringUiUsableKeyMask);
          } else if (typeof parsed.fingeringUiKeyCount === "number") {
            // migrate from old contiguous count -> low N bits mask
            const n = clampFingeringUiKeyCount(parsed.fingeringUiKeyCount);
            fingeringUiUsableKeyMask.value = n >= 24 ? full24Mask : (((1 << n) - 1) >>> 0);
          }
          if (Array.isArray(parsed.fingeringKeyLabels)) {
            const next = parsed.fingeringKeyLabels
              .slice(0, 24)
              .map((v: any, i: number) => (typeof v === "string" ? v : saxKeyLabelPresets[fingeringKeyLabelPreset.value][i] || String(i)));
            if (next.length === 24) {
              fingeringKeyLabels.value = next;
            }
          }

          if (typeof parsed.showFingeringUsableKeySelector === "boolean") {
            showFingeringUsableKeySelector.value = parsed.showFingeringUsableKeySelector;
          }

          if (typeof parsed.hideUnusableFingeringKeys === "boolean") {
            hideUnusableFingeringKeys.value = parsed.hideUnusableFingeringKeys;
          }

          if (typeof parsed.hideUnselectedKeysInKeySelector === "boolean") {
            hideUnselectedKeysInKeySelector.value = parsed.hideUnselectedKeysInKeySelector;
          }

          if (typeof parsed.capturePanelContinuousMode === "boolean") {
            capturePanelContinuousMode.value = parsed.capturePanelContinuousMode;
          }

          if (typeof parsed.capturePanelManualMode === "boolean") {
            capturePanelManualMode.value = parsed.capturePanelManualMode;
          }
        }
      } catch {
        // ignore corrupted localStorage
      }
    };

    let saveUiStateTimer: number | null = null;

    const saveUiStateImmediate = (): void => {
      try {
        if (typeof window === "undefined") {
          return;
        }
        window.localStorage.setItem(
          uiStateKey,
          JSON.stringify({
            showSaxHelpPanel: showSaxHelpPanel.value,
            showFingeringTable: showFingeringTable.value,
            fingeringFilterText: fingeringFilterText.value,
            fingeringFilterOnlyEnabled: fingeringFilterOnlyEnabled.value,
            fingeringFilterOnlyWithKeys: fingeringFilterOnlyWithKeys.value,
            fingeringFilterOnlyWithNote: fingeringFilterOnlyWithNote.value,

            // NOTE: fingeringActiveEntryCount is auto-derived (no localStorage persist).

            fingeringKeyLabelPreset: fingeringKeyLabelPreset.value,
            fingeringKeyLabels: fingeringKeyLabels.value,
            showFingeringKeyIndex: showFingeringKeyIndex.value,
            showFingeringLabelEditor: showFingeringLabelEditor.value,
            showFingeringLayoutEditor: showFingeringLayoutEditor.value,
            fingeringSaxLayoutOverrideText: fingeringSaxLayoutOverrideText.value,
            fingeringEntryLayoutMode: fingeringEntryLayoutMode.value,
            fingeringEntryScrollStepMode: fingeringEntryScrollStepMode.value,

            fingeringLayoutPresets: fingeringLayoutPresets.value,
            activeFingeringLayoutPresetId: activeFingeringLayoutPresetId.value,
            selectedFingeringLayoutPresetId: selectedFingeringLayoutPresetId.value,

            fingeringUiUsableKeyMask: fingeringUiUsableKeyMask.value,
            showFingeringUsableKeySelector: showFingeringUsableKeySelector.value,
            hideUnusableFingeringKeys: hideUnusableFingeringKeys.value,
            hideUnselectedKeysInKeySelector: hideUnselectedKeysInKeySelector.value,

            capturePanelContinuousMode: capturePanelContinuousMode.value,
            capturePanelManualMode: capturePanelManualMode.value,
          }),
        );
      } catch {
        // ignore quota / private mode
      }
    };

    // Persisting large UI state blobs on every keystroke can freeze the UI
    // (especially in Electron). Debounce to batch rapid changes.
    const saveUiState = (): void => {
      try {
        if (typeof window === "undefined") {
          return;
        }
        if (saveUiStateTimer !== null) {
          window.clearTimeout(saveUiStateTimer);
        }
        saveUiStateTimer = window.setTimeout(() => {
          saveUiStateTimer = null;
          saveUiStateImmediate();
        }, 150);
      } catch {
        // ignore
      }
    };

    const fingeringKeyLabelsTextIsComposing = ref(false);
    const fingeringSaxLayoutOverrideTextIsComposing = ref(false);

    const onFingeringSaxLayoutOverrideInput = (event: Event): void => {
      const ie = event as unknown as { isComposing?: boolean };
      if (ie && ie.isComposing) {
        return;
      }
      if (fingeringSaxLayoutOverrideTextIsComposing.value) {
        return;
      }
      const target = event && (event.target as unknown as HTMLTextAreaElement);
      fingeringSaxLayoutOverrideText.value = target ? String(target.value || "") : "";
      saveUiState();
    };

    const onFingeringSaxLayoutOverrideCompositionStart = (): void => {
      fingeringSaxLayoutOverrideTextIsComposing.value = true;
    };

    const onFingeringSaxLayoutOverrideCompositionEnd = (event: Event): void => {
      fingeringSaxLayoutOverrideTextIsComposing.value = false;
      onFingeringSaxLayoutOverrideInput(event);
    };

    const fingeringSaxLayoutForDragEditor = computed((): SaxLayoutKey[] => {
      const override = fingeringSaxLayoutOverride.value;
      return normalizeSaxLayoutForEditor(override ?? DEFAULT_SAX_LAYOUT_24);
    });

    const onFingeringSaxLayoutDragUpdate = (layout: SaxLayoutKey[]): void => {
      // Drag editor always emits a full 24-key layout.
      const nextText = JSON.stringify(layout, null, 2);
      if (nextText === fingeringSaxLayoutOverrideText.value) {
        return;
      }
      fingeringSaxLayoutOverrideText.value = nextText;
      saveUiState();
    };

    const maybeRelocateLayoutOnUsableMaskRestore = (
      fixedMask: number,
      activeMask: number,
    ): void => {
      const fixed = (Number(fixedMask) >>> 0) & full24Mask;
      const active = (Number(activeMask) >>> 0) & full24Mask;
      const before = fingeringSaxLayoutForDragEditor.value;
      if (!detectSaxLayoutCollision(before, active)) {
        return;
      }

      const relocated = relocateSaxLayoutKeysToAvoidCollisions(
        before,
        fixed,
        active,
      );

      if (!detectSaxLayoutCollision(relocated, active)) {
        const moved: number[] = [];
        for (let i = 0; i < 24; i++) {
          if (((active >>> i) & 1) === 0) {
            continue;
          }
          if (((fixed >>> i) & 1) === 1) {
            continue;
          }
          const a = before[i];
          const b = relocated[i];
          if (!a || !b) {
            continue;
          }
          const changed =
            a.row !== b.row ||
            a.col !== b.col ||
            (a.rowSpan ?? 1) !== (b.rowSpan ?? 1) ||
            (a.colSpan ?? 1) !== (b.colSpan ?? 1) ||
            !!a.big !== !!b.big;
          if (changed) {
            moved.push(i);
          }
        }

        if (moved.length) {
          const labelOf = (idx: number): string => {
            const list = fingeringKeyLabels.value;
            const v = Array.isArray(list) && list.length >= 24 ? list[idx] : String(idx);
            return String(v || idx);
          };
          const ids = moved
            .slice(0, 10)
            .map((i) => `#${i}(${labelOf(i)})`)
            .join(" ");
          const suffix = moved.length > 10 ? ` 외 ${moved.length - 10}개` : "";
          fingeringLayoutAutoRelocateNotice.value = `겹침 방지를 위해 자동으로 위치를 조정했습니다: ${ids}${suffix}`;
          if (typeof window !== "undefined") {
            if (fingeringLayoutAutoRelocateNoticeTimer !== null) {
              window.clearTimeout(fingeringLayoutAutoRelocateNoticeTimer);
            }
            fingeringLayoutAutoRelocateNoticeTimer = window.setTimeout(() => {
              fingeringLayoutAutoRelocateNoticeTimer = null;
              fingeringLayoutAutoRelocateNotice.value = "";
            }, 6000);
          }
        }
        onFingeringSaxLayoutDragUpdate(relocated);
      }
    };

    const exportFingeringSaxLayoutOverride = (): void => {
      const effective = fingeringSaxLayoutForDragEditor.value;
      const ts = formatTimestampForFilename(new Date());
      downloadJson(buildFingeringBackupFilename("midisaxo-layout-override", ts), effective);
    };

    const triggerFingeringSaxLayoutOverrideImport = (): void => {
      fingeringLayoutFileInput.value?.click();
    };

    const onFingeringLayoutFileChange = async (ev: Event): Promise<void> => {
      const input = ev.target as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        if (!Array.isArray(raw) || raw.length !== 24) {
          window.alert("레이아웃 파일은 24개 항목을 가진 JSON 배열이어야 합니다.");
          return;
        }
        const normalized = normalizeSaxLayoutForEditor(raw);
        fingeringSaxLayoutOverrideText.value = JSON.stringify(normalized, null, 2);
        saveUiState();
      } catch (err) {
        const e = err as any;
        window.alert(`레이아웃 파일을 읽을 수 없습니다: ${String(e?.message || e)}`);
      } finally {
        if (input) {
          input.value = "";
        }
      }
    };

    const findPresetById = (id: string | null): FingeringLayoutPresetV1 | null => {
      const key = String(id || "");
      if (!key) {
        return null;
      }
      return fingeringLayoutPresets.value.find((p) => p.id === key) || null;
    };

    const createPresetId = (): string => {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    };

    const applyFingeringLayoutPreset = (presetId: string): void => {
      const preset = findPresetById(presetId);
      if (!preset) {
        return;
      }
      fingeringSaxLayoutOverrideText.value = JSON.stringify(preset.layout, null, 2);
      activeFingeringLayoutPresetId.value = preset.id;
      selectedFingeringLayoutPresetId.value = preset.id;
      saveUiState();
    };

    const addFingeringLayoutPresetFromCurrent = (): void => {
      const nameRaw = String(fingeringLayoutPresetNameDraft.value || "").trim();
      const name = nameRaw || `Preset ${fingeringLayoutPresets.value.length + 1}`;
      const now = new Date().toISOString();
      const preset: FingeringLayoutPresetV1 = {
        id: createPresetId(),
        name,
        createdAt: now,
        updatedAt: now,
        layout: fingeringSaxLayoutForDragEditor.value.map((k) => ({ ...k })),
      };
      fingeringLayoutPresets.value = [preset, ...fingeringLayoutPresets.value].slice(0, 50);
      fingeringLayoutPresetNameDraft.value = "";
      applyFingeringLayoutPreset(preset.id);
      saveUiState();
    };

    const updateSelectedFingeringLayoutPresetFromCurrent = (): void => {
      const preset = findPresetById(selectedFingeringLayoutPresetId.value);
      if (!preset) {
        return;
      }
      const now = new Date().toISOString();
      fingeringLayoutPresets.value = fingeringLayoutPresets.value.map((p) =>
        p.id === preset.id
          ? {
              ...p,
              updatedAt: now,
              layout: fingeringSaxLayoutForDragEditor.value.map((k) => ({ ...k })),
            }
          : p,
      );
      saveUiState();
    };

    const renameSelectedFingeringLayoutPreset = (): void => {
      const preset = findPresetById(selectedFingeringLayoutPresetId.value);
      if (!preset) {
        return;
      }
      const next = window.prompt("프리셋 이름", preset.name);
      if (next == null) {
        return;
      }
      const name = String(next).trim();
      if (!name) {
        return;
      }
      const now = new Date().toISOString();
      fingeringLayoutPresets.value = fingeringLayoutPresets.value.map((p) =>
        p.id === preset.id ? { ...p, name, updatedAt: now } : p,
      );
      saveUiState();
    };

    const deleteSelectedFingeringLayoutPreset = (): void => {
      const preset = findPresetById(selectedFingeringLayoutPresetId.value);
      if (!preset) {
        return;
      }
      if (!window.confirm(`프리셋을 삭제할까요? (${preset.name})`)) {
        return;
      }
      fingeringLayoutPresets.value = fingeringLayoutPresets.value.filter((p) => p.id !== preset.id);
      if (activeFingeringLayoutPresetId.value === preset.id) {
        activeFingeringLayoutPresetId.value = null;
      }
      selectedFingeringLayoutPresetId.value = null;
      saveUiState();
    };

    const exportSelectedFingeringLayoutPreset = (): void => {
      const preset = findPresetById(selectedFingeringLayoutPresetId.value);
      if (!preset) {
        return;
      }
      const ts = formatTimestampForFilename(new Date());
      const base = `midisaxo-layout-preset-${sanitizeFilenameToken(preset.name, 24) || "preset"}`;
      downloadJson(buildFingeringBackupFilename(base, ts), {
        schema: "midisaxo.layout-preset.v1",
        name: preset.name,
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt,
        layout: preset.layout,
      });
    };

    const triggerFingeringLayoutPresetImport = (): void => {
      fingeringLayoutPresetFileInput.value?.click();
    };

    const onFingeringLayoutPresetFileChange = async (ev: Event): Promise<void> => {
      const input = ev.target as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        let nameFromFile = sanitizeFilenameToken(String(file.name || "").replace(/\.[^.]+$/, ""), 24);
        if (!nameFromFile) {
          nameFromFile = "Imported";
        }

        let name = nameFromFile;
        let layoutRaw: unknown = null;
        if (Array.isArray(raw)) {
          layoutRaw = raw;
        } else if (raw && typeof raw === "object" && (raw as any).schema === "midisaxo.layout-preset.v1") {
          name = String((raw as any).name || nameFromFile).trim() || nameFromFile;
          layoutRaw = (raw as any).layout;
        } else {
          window.alert("지원하지 않는 프리셋 파일입니다.");
          return;
        }

        if (!Array.isArray(layoutRaw) || layoutRaw.length !== 24) {
          window.alert("프리셋 레이아웃은 24개 항목을 가진 JSON 배열이어야 합니다.");
          return;
        }

        const normalized = normalizeSaxLayoutForEditor(layoutRaw);
        const now = new Date().toISOString();
        const preset: FingeringLayoutPresetV1 = {
          id: createPresetId(),
          name,
          createdAt: now,
          updatedAt: now,
          layout: normalized,
        };
        fingeringLayoutPresets.value = [preset, ...fingeringLayoutPresets.value].slice(0, 50);
        applyFingeringLayoutPreset(preset.id);
        saveUiState();
      } catch (err) {
        const e = err as any;
        window.alert(`프리셋 파일을 읽을 수 없습니다: ${String(e?.message || e)}`);
      } finally {
        if (input) {
          input.value = "";
        }
      }
    };

    const resetFingeringSaxLayoutOverrideToDefault = (): void => {
      fingeringSaxLayoutOverrideText.value = JSON.stringify(DEFAULT_SAX_LAYOUT_24, null, 2);
      saveUiState();
    };

    const clearFingeringSaxLayoutOverride = (): void => {
      fingeringSaxLayoutOverrideText.value = "";
      saveUiState();
    };

    const toggleSaxHelpPanel = (): void => {
      showSaxHelpPanel.value = !showSaxHelpPanel.value;
      saveUiState();
    };

    const onFingeringEntryLayoutModeChange = (event: Event): void => {
      const target = event && (event.target as unknown as HTMLSelectElement);
      const value = target && typeof target.value === "string" ? target.value : "horizontal";
      if (value === "grid" || value === "horizontal") {
        fingeringEntryLayoutMode.value = value;
      }
    };

    const resetFingeringLabelsToPreset = (): void => {
      fingeringKeyLabels.value = [...saxKeyLabelPresets[fingeringKeyLabelPreset.value]];
    };

    const onFingeringLabelPresetChange = (event: Event): void => {
      const target = event && (event.target as unknown as HTMLSelectElement);
      const value = target && typeof target.value === "string" ? target.value : "sax";
      if (value === "sax" || value === "numbers") {
        fingeringKeyLabelPreset.value = value;
        resetFingeringLabelsToPreset();
      }
    };

    type FingeringControllerPreset = "sax24";
    const applyFingeringControllerPreset = (preset: FingeringControllerPreset): void => {
      // default: sax 24
      fingeringUiUsableKeyMask.value = full24Mask;
      fingeringKeyLabelPreset.value = "sax";
      fingeringKeyLabels.value = [...saxKeyLabelPresets.sax];
    };

    const onFingeringKeyLabelInput = (index: number, event: Event): void => {
      const i = Math.max(0, Math.min(23, Math.floor(Number(index) || 0)));
      const target = event && (event.target as unknown as HTMLInputElement);
      const text = target && typeof target.value === "string" ? target.value : "";

      const next = [...fingeringKeyLabels.value];
      while (next.length < 24) {
        next.push("");
      }
      next[i] = text;
      fingeringKeyLabels.value = next;
    };

    const fingeringKeyLabelsText = computed((): string => {
      const list = fingeringKeyLabels.value || [];
      const lines: string[] = [];
      for (let i = 0; i < 24; i++) {
        lines.push(String(list[i] ?? ""));
      }
      return lines.join("\n");
    });

    const onFingeringKeyLabelsTextInput = (event: Event): void => {
      const ie = event as unknown as { isComposing?: boolean };
      if (ie && ie.isComposing) {
        return;
      }
      if (fingeringKeyLabelsTextIsComposing.value) {
        return;
      }
      const target = event && (event.target as unknown as HTMLTextAreaElement);
      const text = target && typeof target.value === "string" ? target.value : "";
      const rawLines = text.split(/\r?\n/);
      const next: string[] = [];
      for (let i = 0; i < 24; i++) {
        const v = rawLines[i];
        next.push(typeof v === "string" ? v.trim() : "");
      }
      fingeringKeyLabels.value = next;
    };

    const onFingeringKeyLabelsTextCompositionStart = (): void => {
      fingeringKeyLabelsTextIsComposing.value = true;
    };

    const onFingeringKeyLabelsTextCompositionEnd = (event: Event): void => {
      fingeringKeyLabelsTextIsComposing.value = false;
      onFingeringKeyLabelsTextInput(event);
    };

    const { formData, loading, onSettingChange, showField } =
      useDeviceForm(Block.Global, SectionType.Setting);

    const applyPressurePitchBendPreset = async (): Promise<void> => {
      if (!isConnected.value || pressurePbPresetBusy.value) {
        return;
      }

      if (!isMidisaxoBoard.value) {
        return;
      }

      const ok = window.confirm(
        [
          "압력 → 피치벤드 추천 설정을 적용할까요?\n",
          "- Analog #1: Pitch bend (압력 센서)",
          "- Analog #2: Reserved (internal: PB deadzone trim)",
          "- Sax Breath Controller(CC 전송): OFF\n",
          "주의: 센서 전압이 RP2040 ADC(3.3V)를 넘지 않도록 하드웨어 분압/레벨시프팅이 필요합니다.",
        ].join("\n"),
      );

      if (!ok) {
        return;
      }

      pressurePbPresetBusy.value = true;
      pressurePbPresetNotice.value = "";

      const write = async (config: { block: number; section: number; index: number; value: number }) =>
        deviceStore.actions.setComponentSectionValue(config as any, () => {});

      const split14 = (v: number): { lsb: number; msb: number } => {
        const value = Math.max(0, Math.min(16383, Math.floor(Number(v) || 0)));
        return {
          lsb: value & 0x7f,
          msb: (value >> 7) & 0x7f,
        };
      };

      const sensorIndex = 1;
      const pbDeadzoneTrimIndex = 2;

      const desiredUpperPb = split14(16383);

      const globalChannelRaw = Number((formData as any).globalChannel);
      const desiredChannel = Number.isFinite(globalChannelRaw)
        ? Math.max(1, Math.min(17, Math.floor(globalChannelRaw)))
        : 1;

      try {
        // Disable breath CC sender (we're using pressure for pitch bend instead).
        await write({ block: Block.Global, section: 2, index: 6, value: 0 });
        // Keep the recommended breath analog index so re-enabling later is sane.
        await write({ block: Block.Global, section: 2, index: 7, value: sensorIndex });

        // Analog #1: Pitch bend.
        await write({ block: Block.Analog, section: 0, index: sensorIndex, value: 1 }); // enabled
        await write({ block: Block.Analog, section: 1, index: sensorIndex, value: 0 }); // invert
        await write({ block: Block.Analog, section: 2, index: sensorIndex, value: AnalogType.PitchBend }); // type
        await write({ block: Block.Analog, section: 3, index: sensorIndex, value: 0 }); // MIDI ID LSB (unused for PB)
        await write({ block: Block.Analog, section: 4, index: sensorIndex, value: 0 }); // MIDI ID MSB
        await write({ block: Block.Analog, section: 5, index: sensorIndex, value: 0 }); // lower limit LSB
        await write({ block: Block.Analog, section: 6, index: sensorIndex, value: 0 }); // lower limit MSB
        await write({ block: Block.Analog, section: 7, index: sensorIndex, value: desiredUpperPb.lsb }); // upper limit LSB
        await write({ block: Block.Analog, section: 8, index: sensorIndex, value: desiredUpperPb.msb }); // upper limit MSB
        await write({ block: Block.Analog, section: 9, index: sensorIndex, value: desiredChannel }); // midi channel
        await write({ block: Block.Analog, section: 10, index: sensorIndex, value: 0 }); // lower adc offset
        await write({ block: Block.Analog, section: 11, index: sensorIndex, value: 0 }); // upper adc offset

        // Analog #2: Reserved deadzone trim pot (0..127, internal only).
        await write({ block: Block.Analog, section: 0, index: pbDeadzoneTrimIndex, value: 1 }); // enabled
        await write({ block: Block.Analog, section: 1, index: pbDeadzoneTrimIndex, value: 0 }); // invert
        await write({ block: Block.Analog, section: 2, index: pbDeadzoneTrimIndex, value: AnalogType.Reserved }); // type
        await write({ block: Block.Analog, section: 3, index: pbDeadzoneTrimIndex, value: 0 });
        await write({ block: Block.Analog, section: 4, index: pbDeadzoneTrimIndex, value: 0 });
        await write({ block: Block.Analog, section: 5, index: pbDeadzoneTrimIndex, value: 0 });
        await write({ block: Block.Analog, section: 6, index: pbDeadzoneTrimIndex, value: 0 });
        await write({ block: Block.Analog, section: 7, index: pbDeadzoneTrimIndex, value: 127 });
        await write({ block: Block.Analog, section: 8, index: pbDeadzoneTrimIndex, value: 0 });
        await write({ block: Block.Analog, section: 9, index: pbDeadzoneTrimIndex, value: desiredChannel });
        await write({ block: Block.Analog, section: 10, index: pbDeadzoneTrimIndex, value: 0 });
        await write({ block: Block.Analog, section: 11, index: pbDeadzoneTrimIndex, value: 0 });

        pressurePbPresetNotice.value = "추천 설정 적용 완료";
      } catch {
        pressurePbPresetNotice.value = "추천 설정 적용 실패 (연결/권한을 확인하세요)";
      } finally {
        pressurePbPresetBusy.value = false;
        window.setTimeout(() => {
          pressurePbPresetNotice.value = "";
        }, 3000);
      }
    };

    const lastBreathCc2 = ref<number | null>(null);
    const lastBreathCc11 = ref<number | null>(null);
    const lastBreathCcTime = ref<string | null>(null);
    const clearBreathActivity = (): void => {
      lastBreathCc2.value = null;
      lastBreathCc11.value = null;
      lastBreathCcTime.value = null;
    };

    const breathCcStatusLine = computed((): string => {
      const ccMode = Number((formData as any).saxBreathControllerCC);
      const cc2 = lastBreathCc2.value;
      const cc11 = lastBreathCc11.value;

      const fmt = (value: number | null): string =>
        value === null ? "---" : String(value).padStart(3, "0");

      if (ccMode === 2) {
        return `CC2 v${fmt(cc2)}`;
      }

      if (ccMode === 11) {
        return `CC11 v${fmt(cc11)}`;
      }

      // 13 = CC2 + CC11, or unknown -> show both.
      return `CC2 v${fmt(cc2)} | CC11 v${fmt(cc11)}`;
    });


    const attachBreathActivityListener = (input: any): (() => void) => {
      if (!input || typeof input.addListener !== "function") {
        return () => {};
      }

      const handler = (event: any) => {
        const cc = Number(event?.controller?.number);
        if (cc !== 2 && cc !== 11) {
          return;
        }

        const value = Number(event?.value);
        const channel = Number(event?.channel);
        const now = new Date();
        const time = now.toTimeString().slice(0, 8);

        if (!Number.isFinite(value) || !Number.isFinite(channel)) {
          return;
        }

        const normalizedValue = Math.max(0, Math.min(127, Math.floor(value)));
        lastBreathCcTime.value = time;
        if (cc === 2) {
          lastBreathCc2.value = normalizedValue;
        } else {
          lastBreathCc11.value = normalizedValue;
        }
      };

      input.addListener("controlchange", "all", handler);

      return () => {
        try {
          input.removeListener("controlchange", "all", handler);
        } catch {
          // ignore
        }
      };
    };

    let detachBreathActivityListener: (() => void) | null = null;


    const onSaxSettingChange = (params: any) => {
      if (!isConnected.value) {
        return;
      }
      return onSettingChange(params);
    };

    const saxKeys = new Set([
      "saxBreathControllerEnable",
      "saxBreathControllerAnalogIndex",
      "saxBreathControllerMidPercent",
      "saxBreathControllerCC",
      "saxPitchBendDeadzone",
    ]);

    const saxSections = computed(() => {
      const globalSections = Object.values(BlockMap[Block.Global].sections);
      return globalSections.filter(
        (section) => section.type === SectionType.Setting && saxKeys.has(section.key),
      );
    });

    const hasSaxSections = computed(() => saxSections.value.length > 0);

    const saxHelpItems = computed(() => {
      return saxSections.value.map((section: any) => {
        const disabled = deviceStoreMapped.isControlDisabled(section);
        const disabledText = disabled ? "이 펌웨어/디바이스에서는 지원되지 않습니다." : "";

        const min = typeof section.min === "number" ? section.min : undefined;
        const max = typeof section.max === "number" ? section.max : undefined;
        const rangeText =
          typeof min === "number" && typeof max === "number" ? `${min} - ${max}` : "";

        const description =
          typeof section.helpText === "string" ? section.helpText.trim() : "";

        return {
          key: section.key,
          label: section.label || section.key,
          rangeText,
          description,
          disabledText,
          isVisible: !!showField(section),
        };
      });
    });

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

    const loadFingeringTable = async () => {
      if (!isConnected.value) {
        fingeringMaskLo14.value = null;
        fingeringMaskHi10Enable.value = null;
        fingeringNote.value = null;
        fingeringSupport.value = "unknown";
        return;
      }

      fingeringLoading.value = true;
      try {
        const values = await deviceStore.actions.getSectionValues(Block.Global);
        if (
          Object.prototype.hasOwnProperty.call(values, "saxFingeringMaskLo14") &&
          Object.prototype.hasOwnProperty.call(values, "saxFingeringMaskHi10Enable") &&
          Object.prototype.hasOwnProperty.call(values, "saxFingeringNote")
        ) {
          fingeringSupport.value = "supported";
          fingeringMaskLo14.value = values.saxFingeringMaskLo14;
          fingeringMaskHi10Enable.value = values.saxFingeringMaskHi10Enable;
          fingeringNote.value = values.saxFingeringNote;
        } else {
          fingeringSupport.value = "unsupported";
          fingeringMaskLo14.value = null;
          fingeringMaskHi10Enable.value = null;
          fingeringNote.value = null;
        }
      } finally {
        fingeringLoading.value = false;
      }
    };

    const reloadFingering = async () => {
      await loadFingeringTable();
    };

    const fingeringKeyCount = 24;
    const fingeringHiBits = Math.max(0, fingeringKeyCount - 14);
    const fingeringHiMask = (1 << fingeringHiBits) - 1;
    const fingeringEnableBit = 1 << fingeringHiBits;

    const MAX_ALTERNATE_FINGERINGS_PER_NOTE = 3;

    const popcount32 = (x: number): number => {
      let v = x >>> 0;
      v = v - ((v >>> 1) & 0x55555555);
      v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
      return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
    };

    const jaccardSimilarity = (a: number, b: number): number => {
      const aa = a >>> 0;
      const bb = b >>> 0;
      const inter = popcount32(aa & bb);
      const uni = popcount32(aa | bb);
      return uni ? inter / uni : 0;
    };

    const findClosestFingeringEntryIndices = (mask: number, limit = 3): number[] => {
      const targetMask = mask >>> 0;
      if (!targetMask) {
        return [];
      }

      const scored = fingeringEntries.value
        .map((entry) => {
          const entryMask = (Number(entry.mask) >>> 0) || 0;
          if (!entryMask) {
            return null;
          }
          const score = jaccardSimilarity(targetMask, entryMask);
          if (score <= 0) {
            return null;
          }
          const inter = popcount32(targetMask & entryMask);
          const uni = popcount32(targetMask | entryMask);
          return { index: entry.index, enabled: !!entry.enabled, score, inter, uni };
        })
        .filter(Boolean) as Array<{ index: number; enabled: boolean; score: number; inter: number; uni: number }>;

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.enabled !== a.enabled) return Number(b.enabled) - Number(a.enabled);
        if (b.inter !== a.inter) return b.inter - a.inter;
        return a.index - b.index;
      });

      return scored.slice(0, Math.max(0, limit)).map((x) => x.index);
    };

    const lastPressedJumpCandidates = ref<number[] | null>(null);
    const lastPressedJumpExact = ref(false);
    const lastPressedJumpMask = ref<number>(0);

    const lastPressedJumpKeysText = computed((): string => {
      const m = lastPressedJumpMask.value >>> 0;
      return m ? maskToKeysText(m) : "";
    });

    const clearLastPressedJump = (): void => {
      lastPressedJumpCandidates.value = null;
      lastPressedJumpExact.value = false;
      lastPressedJumpMask.value = 0;
    };

    const jumpToFingeringEntry = async (entryIndex: number): Promise<void> => {
      showFingeringTable.value = true;
      fingeringEntryDetailsOpen.value[entryIndex] = true;
      await focusFingeringEntry(entryIndex);
    };

    const getNoteAlternativesForEntry = (entryIndex: number, note: number): number[] => {
      const n = clampMidiNote(Number(note) || 0);

      const enabledMatches = fingeringEntries.value
        .filter((e) => e.enabled && e.note === n)
        .map((e) => e.index)
        .sort((a, b) => a - b);

      const result: number[] = [];
      if (!result.includes(entryIndex)) {
        result.push(entryIndex);
      }
      for (const idx of enabledMatches) {
        if (result.length >= MAX_ALTERNATE_FINGERINGS_PER_NOTE) {
          break;
        }
        if (!result.includes(idx)) {
          result.push(idx);
        }
      }

      return result;
    };

    const parseKeysToMask = (text: string): number => {
      if (!text) {
        return 0;
      }
      const usable = normalizeUsableMask(fingeringUiUsableKeyMask.value);
      const parts = text
        .split(/[,\s]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      let mask = 0;
      for (const p of parts) {
        const n = Number(p);
        if (!Number.isFinite(n)) {
          continue;
        }
        const idx = Math.floor(n);
        if (idx < 0 || idx > 23) {
          continue;
        }
        if (((usable >>> idx) & 1) === 0) {
          continue;
        }
        mask |= 1 << idx;
      }
      return mask >>> 0;
    };

    const maskToKeysText = (mask: number): string => {
      const keys: number[] = [];
      for (let i = 0; i < fingeringKeyCount; i++) {
        if ((mask >>> i) & 1) {
          keys.push(i);
        }
      }
      return keys.join(",");
    };

    const showFingeringCapturePanel = ref(false);

    const captureOnlyMode = computed((): boolean => {
      try {
        const params = new URLSearchParams(window.location.search || "");
        return params.has("capture") || params.has("captureOnly");
      } catch {
        return false;
      }
    });

    const capturePanelPressedMask = ref<number>(0);
    const capturePanelNoteDraft = ref<string>("60");
    const capturePanelStatusText = ref<string>("");
    const capturePanelContinuousMode = ref<boolean>(false);
    // Default to manual mode so the UI works even without touchscreen/hardware capture.
    const capturePanelManualMode = ref<boolean>(true);
    const capturePanelNoteInput = ref<HTMLInputElement | null>(null);

    onMounted(() => {
      // Minimal preview mode: auto-open capture panel.
      if (!captureOnlyMode.value) {
        return;
      }
      showSaxHelpPanel.value = false;
      showFingeringTable.value = true;
      showFingeringCapturePanel.value = true;
    });

    watch(
      () => capturePanelManualMode.value,
      () => {
        saveUiState();
      },
    );

    const onCapturePanelNoteWheel = (event: WheelEvent): void => {
      try {
        if (!event) {
          return;
        }

        // Do not block scrolling when the cursor is over the input.
        // Only intercept wheel when the note input is focused.
        if (
          typeof document !== "undefined" &&
          capturePanelNoteInput.value &&
          document.activeElement !== capturePanelNoteInput.value
        ) {
          return;
        }

        // Prevent browser default number-input wheel behavior when focused.
        event.preventDefault();

        // Wheel up (deltaY<0) => increment
        const dir = event.deltaY < 0 ? 1 : -1;
        const step = event.shiftKey ? 12 : 1;

        const current = Math.trunc(Number(String(capturePanelNoteDraft.value || "").trim()));
        const base = Number.isFinite(current) ? current : 60;
        const next = Math.min(127, Math.max(0, base + dir * step));
        capturePanelNoteDraft.value = String(next);
      } catch {
        // ignore
      }
    };

    const capturePanelPressedKeysText = computed(() => maskToKeysText(capturePanelPressedMask.value >>> 0));
    const capturePanelPressedKeyCount = computed(() => popcount32(capturePanelPressedMask.value >>> 0));
    const capturePanelPressedMaskHex = computed(() => {
      const m = capturePanelPressedMask.value >>> 0;
      return `0x${m.toString(16).padStart(6, "0")}`;
    });

    const clearCapturePanelSelection = (): void => {
      capturePanelPressedMask.value = 0;
      capturePanelStatusText.value = "선택을 초기화했습니다.";
    };

    const captureModalPrevBodyOverflow = ref<string | null>(null);

    const CAPTURE_PANEL_POS_KEY = "midisaxo.capturePanel.position.v2";
    const capturePanelCardEl = ref<HTMLElement | null>(null);
    const capturePanelPos = ref<{ x: number; y: number } | null>(null);
    const capturePanelDragOffset = ref<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
    const capturePanelDragging = ref<boolean>(false);

    const capturePanelCardStyle = computed(() => {
      const pos = capturePanelPos.value;
      if (!pos) {
        return {
          left: "50%",
          top: "5rem",
          transform: "translateX(-50%)",
        } as any;
      }
      return {
        left: `${Math.round(pos.x)}px`,
        top: `${Math.round(pos.y)}px`,
      } as any;
    });

    const clampCapturePanelPos = (x: number, y: number): { x: number; y: number } => {
      try {
        const el = capturePanelCardEl.value;
        const w = typeof window !== "undefined" ? window.innerWidth : 0;
        const h = typeof window !== "undefined" ? window.innerHeight : 0;
        if (!el || !w || !h) {
          return { x, y };
        }
        const rect = el.getBoundingClientRect();
        const margin = 12;
        const maxX = Math.max(margin, w - rect.width - margin);
        const maxY = Math.max(margin, h - rect.height - margin);
        const cx = Math.max(margin, Math.min(maxX, x));
        const cy = Math.max(margin, Math.min(maxY, y));
        return { x: cx, y: cy };
      } catch {
        return { x, y };
      }
    };

    const loadCapturePanelPosition = (): { x: number; y: number } | null => {
      try {
        if (typeof localStorage === "undefined") {
          return null;
        }
        const raw = localStorage.getItem(CAPTURE_PANEL_POS_KEY);
        if (!raw) {
          return null;
        }
        const parsed = JSON.parse(raw);
        const x = Number(parsed && parsed.x);
        const y = Number(parsed && parsed.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }
        return { x, y };
      } catch {
        return null;
      }
    };

    const persistCapturePanelPosition = (): void => {
      try {
        const pos = capturePanelPos.value;
        if (!pos || typeof localStorage === "undefined") {
          return;
        }
        localStorage.setItem(CAPTURE_PANEL_POS_KEY, JSON.stringify({ x: pos.x, y: pos.y }));
      } catch {
        // ignore
      }
    };

    const initCapturePanelPosition = async (): Promise<void> => {
      await nextTick();
      if (!showFingeringCapturePanel.value) {
        return;
      }

      const stored = loadCapturePanelPosition();
      if (stored) {
        capturePanelPos.value = clampCapturePanelPos(stored.x, stored.y);
        return;
      }

      try {
        const w = typeof window !== "undefined" ? window.innerWidth : 0;
        const h = typeof window !== "undefined" ? window.innerHeight : 0;
        const el = capturePanelCardEl.value;
        if (w && h && el) {
          const rect = el.getBoundingClientRect();
          const left = Math.max(12, Math.floor((w - rect.width) / 2));
          const top = Math.max(12, Math.floor(h * 0.08));
          capturePanelPos.value = clampCapturePanelPos(left, top);
        }
      } catch {
        // ignore
      }
    };

    const resetCapturePanelPosition = async (): Promise<void> => {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(CAPTURE_PANEL_POS_KEY);
        }
      } catch {
        // ignore
      }
      capturePanelPos.value = null;
      await initCapturePanelPosition();
    };

    const onCapturePanelDragStart = (event: PointerEvent): void => {
      try {
        if (!event || event.button !== 0) {
          return;
        }
        const target = event.target as unknown as HTMLElement | null;
        if (target && target.closest && target.closest("button, a, input, textarea, select, label")) {
          return;
        }
        event.preventDefault();

        const el = capturePanelCardEl.value;
        if (!el) {
          return;
        }
        const rect = el.getBoundingClientRect();
        capturePanelDragOffset.value = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
        capturePanelDragging.value = true;

        const onMove = (e: PointerEvent) => {
          if (!capturePanelDragging.value) {
            return;
          }
          const nextX = e.clientX - capturePanelDragOffset.value.dx;
          const nextY = e.clientY - capturePanelDragOffset.value.dy;
          capturePanelPos.value = clampCapturePanelPos(nextX, nextY);
        };

        const onUp = () => {
          capturePanelDragging.value = false;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          persistCapturePanelPosition();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      } catch {
        // ignore
      }
    };

    const splitMaskTo14BitParts = (mask: number) => {
      const lo14 = mask & 0x3fff;
      const hi = (mask >>> 14) & fingeringHiMask;
      return { lo14, hi };
    };

    const setGlobalValue = async (section: number, index: number, value: number) => {
      await deviceStore.actions.setComponentSectionValue(
        {
          block: Block.Global,
          section,
          index,
          value,
        },
        () => void 0,
      );
    };

    const clearCurrentPressedFingeringOnDevice = async (): Promise<boolean> => {
      // Firmware extension: global section 8 (SAX_FINGERING_CLEAR)
      // index 0, value 1 -> clear pressed/latching state for SAX_FINGERING_KEY
      try {
        await setGlobalValue(8, 0, 1);
        return true;
      } catch {
        return false;
      }
    };

    const clearCapturePanelDevicePressedMask = async (): Promise<void> => {
      capturePanelStatusText.value = "";

      if (!isConnected.value || fingeringSupport.value !== "supported") {
        capturePanelStatusText.value = "연결/지원 상태를 확인하세요.";
        return;
      }

      const ok = await clearCurrentPressedFingeringOnDevice();
      capturePanelPressedMask.value = 0;
      capturePanelStatusText.value = ok
        ? "장치 눌림 상태를 초기화했습니다."
        : "장치 눌림 초기화에 실패했습니다.";

      if (!capturePanelManualMode.value) {
        window.setTimeout(() => refreshCapturePanelPressedMask(), 0);
      }
    };

    const getGlobalValue = async (section: number, index: number): Promise<number> => {
      return deviceStore.actions.getValue(Block.Global, section, index);
    };

    const readCurrentPressedFingeringMask = async (): Promise<number | null> => {
      // Firmware extension: global section 7 (SAX_FINGERING_CURRENT_MASK)
      // index 0 -> lo14, index 1 -> hi10
      try {
        const lo14 = await getGlobalValue(7, 0);
        const hi10 = await getGlobalValue(7, 1);
        return (((hi10 & fingeringHiMask) << 14) | (lo14 & 0x3fff)) >>> 0;
      } catch {
        return null;
      }
    };

    const refreshCapturePanelPressedMask = async (): Promise<void> => {
      capturePanelStatusText.value = "";

      if (!isConnected.value) {
        capturePanelPressedMask.value = 0;
        capturePanelStatusText.value = "연결되지 않았습니다.";
        return;
      }

      if (fingeringSupport.value !== "supported") {
        capturePanelPressedMask.value = 0;
        capturePanelManualMode.value = true;
        capturePanelStatusText.value =
          "이 펌웨어/설정에서는 현재 눌림 읽기를 지원하지 않습니다. 수동 입력을 사용하세요.";
        return;
      }

      const rawMask = await readCurrentPressedFingeringMask();
      if (rawMask === null) {
        capturePanelPressedMask.value = 0;
        capturePanelManualMode.value = true;
        capturePanelStatusText.value =
          "현재 눌림(키 마스크) 읽기가 지원되지 않습니다. 수동 입력(키패드 클릭)으로 진행하세요.";
        return;
      }

      const usable = normalizeUsableMask(fingeringUiUsableKeyMask.value);
      const pressed = (rawMask >>> 0) & usable;
      capturePanelPressedMask.value = pressed;
      capturePanelStatusText.value = pressed
        ? `읽음: ${popcount32(pressed)}개 (${maskToKeysText(pressed)})`
        : "현재 눌린 키가 없습니다.";
    };

    const pollCapturePanelPressedMask = async (): Promise<void> => {
      // Silent poll: never force manual mode and never clear last known mask on read failures.
      if (!isConnected.value || fingeringSupport.value !== "supported" || fingeringLoading.value) {
        return;
      }
      if (!showFingeringCapturePanel.value || capturePanelManualMode.value) {
        return;
      }

      const rawMask = await readCurrentPressedFingeringMask();
      if (rawMask === null) {
        // Keep last successful value; avoid UI flicker.
        if (!capturePanelStatusText.value) {
          capturePanelStatusText.value = "현재 눌림 읽기 대기중…";
        }
        return;
      }

      const usable = normalizeUsableMask(fingeringUiUsableKeyMask.value);
      const pressed = (rawMask >>> 0) & usable;

      if ((capturePanelPressedMask.value >>> 0) !== (pressed >>> 0)) {
        capturePanelPressedMask.value = pressed;
      }

      // Only update status when it meaningfully changes.
      const nextStatus = pressed
        ? `읽음: ${popcount32(pressed)}개 (${maskToKeysText(pressed)})`
        : "현재 눌린 키가 없습니다.";
      if (capturePanelStatusText.value !== nextStatus) {
        capturePanelStatusText.value = nextStatus;
      }
    };

    const focusCapturePanelNoteInput = async (): Promise<void> => {
      await nextTick();
      const el = capturePanelNoteInput.value;
      if (!el) {
        return;
      }
      try {
        el.focus();
        el.select();
      } catch {
        // ignore
      }
    };

    type CaptureFingeringResult =
      | { action: "saved"; entryIndex: number }
      | { action: "jumped"; entryIndex: number }
      | { action: "cancelled" }
      | { action: "blocked" }
      | { action: "noop" };

    const captureFingeringMaskToNote = async (note: number, pressedMaskRaw: number): Promise<CaptureFingeringResult> => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return { action: "noop" };
      }

      // Ensure table data is present (we need it to decide where to store).
      if (!fingeringMaskLo14.value || !fingeringMaskHi10Enable.value || !fingeringNote.value) {
        await loadFingeringTable();
      }

      const usable = normalizeUsableMask(fingeringUiUsableKeyMask.value);
      const pressedMask = (pressedMaskRaw >>> 0) & usable;
      if (!pressedMask) {
        window.alert("현재 눌린 키가 없습니다.");
        return { action: "blocked" };
      }

      // If this exact key combination already exists, jump to it and ignore.
      const existing = findExactFingeringEntryIndicesByMask(pressedMask);
      const dupTarget = (existing.enabled.length ? existing.enabled : existing.any)[0];
      if (typeof dupTarget === "number") {
        window.alert(`이미 같은 키 조합이 등록되어 있습니다. 이동: #${dupTarget + 1}`);
        await jumpToFingeringEntry(dupTarget);
        return { action: "jumped", entryIndex: dupTarget };
      }

      // Enforce max alternate fingerings per note (enabled entries).
      const sameNoteEnabled: number[] = [];
      const activeCountForLimit = fingeringEntryRequiredCount.value;
      for (const other of fingeringEntries.value) {
        if (other.index >= activeCountForLimit) {
          continue;
        }
        if (!other.enabled) {
          continue;
        }
        if (other.note === note) {
          sameNoteEnabled.push(other.index);
        }
      }

      if (sameNoteEnabled.length >= MAX_ALTERNATE_FINGERINGS_PER_NOTE) {
        sameNoteEnabled.sort((a, b) => a - b);
        window.alert(
          `대체키 제한: 노트 ${note}(${midiNoteName(note)})는 최대 ${MAX_ALTERNATE_FINGERINGS_PER_NOTE}개까지 저장(활성화)할 수 있습니다.\n\n` +
            `이미 활성화된 엔트리: ${sameNoteEnabled
              .slice(0, MAX_ALTERNATE_FINGERINGS_PER_NOTE)
              .map((i) => `#${i + 1}`)
              .join(", ")}`,
        );
        if (sameNoteEnabled.length) {
          await jumpToFingeringEntry(sameNoteEnabled[0]);
        }
        return { action: "blocked" };
      }

      if (!fingeringMaskLo14.value || !fingeringMaskHi10Enable.value || !fingeringNote.value) {
        await loadFingeringTable();
      }

      const loArr = fingeringMaskLo14.value;
      const hiArr = fingeringMaskHi10Enable.value;
      const noteArr = fingeringNote.value;
      if (!loArr || !hiArr || !noteArr) {
        window.alert("핑거링 테이블을 불러오지 못했습니다.");
        return { action: "noop" };
      }

      const activeStart = 0;
      let activeCount = Math.min(fingeringEntryCount, fingeringEntryRequiredCount.value + 1);
      let activeEnd = activeCount - 1;

      let insertIndex: number | null = null;
      let lastSameNote = -1;
      let firstGreaterNote = -1;
      let maxUsed = -1;

      for (let i = activeStart; i <= activeEnd; i++) {
        const hasData =
          (Number(loArr[i] || 0) & 0x3fff) !== 0 ||
          (Number(hiArr[i] || 0) & (fingeringHiMask | fingeringEnableBit)) !== 0;
        if (!hasData) {
          continue;
        }
        maxUsed = i;
        const n = clampMidiNote(Math.floor(Number(noteArr[i]) || 0));
        if (n === note) {
          lastSameNote = i;
          continue;
        }
        if (n > note && firstGreaterNote === -1) {
          firstGreaterNote = i;
        }
      }

      if (lastSameNote >= 0) {
        insertIndex = Math.min(activeEnd, lastSameNote + 1);
      } else if (firstGreaterNote >= 0) {
        insertIndex = firstGreaterNote;
      } else {
        insertIndex = Math.min(activeEnd, maxUsed + 1);
      }

      const insertIndexFinal = Math.max(activeStart, Math.min(activeEnd, insertIndex ?? activeStart));

      const hasDataAt = (i: number): boolean => {
        return (
          (Number(loArr[i] || 0) & 0x3fff) !== 0 ||
          (Number(hiArr[i] || 0) & (fingeringHiMask | fingeringEnableBit)) !== 0
        );
      };

      let emptyIndex = -1;
      for (let i = insertIndexFinal; i <= activeEnd; i++) {
        if (!hasDataAt(i)) {
          emptyIndex = i;
          break;
        }
      }

      let didAutoExpand = false;
      if (emptyIndex < 0) {
        if (activeCount >= fingeringEntryCount) {
          window.alert(
            `엔트리 추가 실패: 현재 활성 엔트리가 이미 최대(${fingeringEntryCount}개)입니다.\n\n` +
              `더 이상 추가할 수 없어 이번 저장을 무시합니다.`,
          );
          return { action: "blocked" };
        }

        activeCount = Math.min(fingeringEntryCount, activeCount + 1);
        activeEnd = activeCount - 1;
        emptyIndex = activeEnd;
        didAutoExpand = true;
      }

      const willShift = emptyIndex > insertIndexFinal;
      if (willShift) {
        const ok = window.confirm(
          `대체키 삽입(밀려가기): #${insertIndexFinal + 1} 위치에 저장하기 위해 이후 엔트리가 한 칸씩 밀립니다.\n` +
            (didAutoExpand ? `\n현재 활성 엔트리 갯수가 자동으로 ${activeCount}개로 늘어났습니다.\n` : "\n") +
            `계속할까요?`,
        );
        if (!ok) {
          return { action: "cancelled" };
        }
      }

      const shiftDownToEmpty = async (startIndex: number, emptyDstIndex: number): Promise<void> => {
        for (let dst = emptyDstIndex; dst > startIndex; dst--) {
          const src = dst - 1;
          const lo = Number(loArr[src] || 0) & 0x3fff;
          const hiEn = Number(hiArr[src] || 0) & (fingeringHiMask | fingeringEnableBit);
          const n = clampMidiNote(Math.floor(Number(noteArr[src]) || 0));

          await setGlobalValue(3, dst, lo);
          await setGlobalValue(4, dst, hiEn);
          await setGlobalValue(5, dst, n);

          loArr[dst] = lo;
          hiArr[dst] = hiEn;
          noteArr[dst] = n;
        }
      };

      fingeringLoading.value = true;
      try {
        if (willShift) {
          await shiftDownToEmpty(insertIndexFinal, emptyIndex);
        }

        // Direct write (UI-driven) so this works even when firmware capture (section 6)
        // or current-pressed read (section 7) isn't available.
        const { lo14, hi } = splitMaskTo14BitParts(pressedMask);
        const hiEn = (hi & fingeringHiMask) | fingeringEnableBit;

        await setGlobalValue(3, insertIndexFinal, lo14);
        await setGlobalValue(4, insertIndexFinal, hiEn);
        await setGlobalValue(5, insertIndexFinal, note);

        loArr[insertIndexFinal] = lo14;
        hiArr[insertIndexFinal] = hiEn;
        noteArr[insertIndexFinal] = note;

        await loadFingeringTable();
        await focusFingeringEntry(insertIndexFinal);
      } finally {
        fingeringLoading.value = false;
      }

      return { action: "saved", entryIndex: insertIndexFinal };
    };

    const saveCapturePanelToNote = async (): Promise<void> => {
      capturePanelStatusText.value = "";

      if (!isConnected.value || fingeringSupport.value !== "supported") {
        capturePanelStatusText.value = "연결/지원 상태를 확인하세요.";
        return;
      }

      let pressed = capturePanelPressedMask.value >>> 0;
      if (!pressed && !capturePanelManualMode.value) {
        await refreshCapturePanelPressedMask();
        pressed = capturePanelPressedMask.value >>> 0;
      }

      if (!pressed) {
        if (capturePanelManualMode.value) {
          window.alert("키패드에서 눌린 키를 선택하세요.");
        }
        return;
      }

      const parsed = Number(String(capturePanelNoteDraft.value || "").trim());
      if (!Number.isFinite(parsed)) {
        window.alert("노트는 0-127 숫자여야 합니다.");
        return;
      }
      const note = clampMidiNote(parsed);

      const result = await captureFingeringMaskToNote(note, pressed);
      capturePanelStatusText.value = `저장: ${maskToKeysText(pressed)} -> ${note}(${midiNoteName(note)})`;

      const didSucceed = result.action === "saved" || result.action === "jumped";
      if (!didSucceed) {
        return;
      }

      // Always jump/focus to the affected entry so the user can immediately edit/verify.
      if (result.action === "saved" || result.action === "jumped") {
        await jumpToFingeringEntry(result.entryIndex);
      }

      if (capturePanelContinuousMode.value) {
        // Convenient for bulk capture: keep open.
        // If not manual, refresh for next press; if manual, keep current selection.
        if (!capturePanelManualMode.value) {
          window.setTimeout(() => refreshCapturePanelPressedMask(), 0);
        }
        window.setTimeout(() => void focusCapturePanelNoteInput(), 0);
        return;
      }

      // Single save: clear device state as well (useful for touchscreen latching capture).
      if (!capturePanelManualMode.value) {
        const ok = await clearCurrentPressedFingeringOnDevice();
        capturePanelPressedMask.value = 0;
        if (ok) {
          capturePanelStatusText.value = "저장 후 선택을 초기화했습니다.";
        }
      }

      showFingeringCapturePanel.value = false;
    };

    const capturePanelPollTimer = ref<number | null>(null);
    const capturePanelPollInFlight = ref<boolean>(false);

    const stopCapturePanelPolling = (): void => {
      try {
        if (capturePanelPollTimer.value !== null) {
          window.clearInterval(capturePanelPollTimer.value);
          capturePanelPollTimer.value = null;
        }
      } catch {
        // ignore
      }
      capturePanelPollInFlight.value = false;
    };

    const startCapturePanelPolling = (): void => {
      stopCapturePanelPolling();

      if (!showFingeringCapturePanel.value) {
        return;
      }
      if (capturePanelManualMode.value) {
        return;
      }
      if (!isConnected.value) {
        return;
      }
      if (fingeringSupport.value !== "supported") {
        return;
      }

      // Keep it lightweight: avoid spamming SysEx.
      capturePanelPollTimer.value = window.setInterval(() => {
        if (!showFingeringCapturePanel.value || capturePanelManualMode.value) {
          stopCapturePanelPolling();
          return;
        }
        if (!isConnected.value || fingeringSupport.value !== "supported" || fingeringLoading.value) {
          return;
        }
        if (capturePanelPollInFlight.value) {
          return;
        }

        capturePanelPollInFlight.value = true;
        pollCapturePanelPressedMask()
          .catch(() => void 0)
          .finally(() => {
            capturePanelPollInFlight.value = false;
          });
      }, 650);
    };

    const findExactFingeringEntryIndicesByMask = (mask: number): { enabled: number[]; any: number[] } => {
      const m = mask >>> 0;
      const enabled: number[] = [];
      const any: number[] = [];
      if (!m) {
        return { enabled, any };
      }
      for (const entry of fingeringEntries.value) {
        if (((Number(entry.mask) >>> 0) || 0) !== m) {
          continue;
        }
        any.push(entry.index);
        if (entry.enabled) {
          enabled.push(entry.index);
        }
      }
      enabled.sort((a, b) => a - b);
      any.sort((a, b) => a - b);
      return { enabled, any };
    };

    const jumpToCurrentPressedFingering = async (): Promise<void> => {
      if (!isConnected.value) {
        return;
      }

      if (fingeringSupport.value !== "supported") {
        window.alert("이 펌웨어에서는 핑거링 테이블/현재 눌림 읽기를 지원하지 않습니다.");
        return;
      }

      // Ensure table data is present.
      if (!fingeringMaskLo14.value || !fingeringMaskHi10Enable.value || !fingeringNote.value) {
        await loadFingeringTable();
      }

      fingeringLoading.value = true;
      try {
        clearLastPressedJump();
        const rawMask = await readCurrentPressedFingeringMask();
        if (rawMask === null) {
          window.alert(
            "현재 눌림(키 마스크) 읽기가 지원되지 않습니다.\n\n" +
              "펌웨어 업데이트가 필요하거나, 이 보드/타겟에서는 제공되지 않을 수 있습니다.",
          );
          return;
        }

        const usable = normalizeUsableMask(fingeringUiUsableKeyMask.value);
        const mask = (rawMask >>> 0) & usable;

        lastPressedJumpMask.value = mask;

        if (!mask) {
          window.alert("현재 눌린 키가 없습니다.");
          return;
        }

        // Exact match only: if no exact match exists, ignore (no jump/no popup).
        const matches = findExactFingeringEntryIndicesByMask(mask);
        const exactCandidates = (matches.enabled.length ? matches.enabled : matches.any).slice(0, 3);
        if (!exactCandidates.length) {
          // Keep lastPressedJumpMask for debugging display, but do not show candidates.
          lastPressedJumpExact.value = false;
          lastPressedJumpCandidates.value = null;
          return;
        }

        lastPressedJumpExact.value = true;
        lastPressedJumpCandidates.value = exactCandidates;
        await jumpToFingeringEntry(exactCandidates[0]);
      } finally {
        fingeringLoading.value = false;
      }
    };

    const setFingeringEnabled = async (entryIndex: number, enabled: boolean) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      const current = (fingeringMaskHi10Enable.value && fingeringMaskHi10Enable.value[entryIndex]) || 0;
      const hi = current & fingeringHiMask;
      const next = enabled ? (hi | fingeringEnableBit) : hi;
      fingeringLoading.value = true;
      try {
        await setGlobalValue(4, entryIndex, next);
        if (fingeringMaskHi10Enable.value) {
          fingeringMaskHi10Enable.value[entryIndex] = next;
        }
      } finally {
        fingeringLoading.value = false;
      }
    };

    const onFingeringEnabledChange = (entryIndex: number, event: Event) => {
      const target = event && (event.target as unknown as HTMLInputElement);
      const enabled = !!(target && (target as any).checked);

      if (enabled) {
        const entry = fingeringEntries.value[entryIndex];
        const mask = entry ? (Number(entry.mask) >>> 0) : 0;
        if (mask) {
          const duplicates: number[] = [];
          for (const other of fingeringEntries.value) {
            if (!other.enabled || other.index === entryIndex) {
              continue;
            }
            if (((Number(other.mask) >>> 0) || 0) === mask) {
              duplicates.push(other.index);
            }
          }

          if (duplicates.length) {
            duplicates.sort((a, b) => a - b);
            const dupText = duplicates.map((i) => `#${i + 1}`).join(", ");
            const jumpTarget = duplicates[0];
            const ok = window.confirm(
              `키 조합 중복: 엔트리 #${entryIndex + 1} ↔ ${dupText}\n` +
                `취소하면 #${jumpTarget + 1}로 이동합니다.\n\n` +
                `그래도 활성화할까요?`,
            );
            if (!ok) {
              if (target) {
                (target as any).checked = false;
              }

              // Jump to an already-enabled conflicting entry so user can edit/disable it.
              fingeringEntryDetailsOpen.value[jumpTarget] = true;
              void focusFingeringEntry(jumpTarget);
              return;
            }
          }
        }

        // Limit number of enabled alternate fingerings per note.
        const note = entry ? entry.note : 0;
        const sameNoteEnabled: number[] = [];
        for (const other of fingeringEntries.value) {
          if (!other.enabled || other.index === entryIndex) {
            continue;
          }
          if (other.note === note) {
            sameNoteEnabled.push(other.index);
          }
        }

        if (sameNoteEnabled.length >= MAX_ALTERNATE_FINGERINGS_PER_NOTE) {
          sameNoteEnabled.sort((a, b) => a - b);
          const keepText = sameNoteEnabled
            .slice(0, MAX_ALTERNATE_FINGERINGS_PER_NOTE)
            .map((i) => `#${i + 1}`)
            .join(", ");
          const jumpTarget = sameNoteEnabled[0];

          window.alert(
            `대체키 제한: 노트 ${note}(${midiNoteName(note)})는 최대 ${MAX_ALTERNATE_FINGERINGS_PER_NOTE}개까지 사용(매핑)할 수 있습니다.\n\n` +
              `이미 활성화된 엔트리: ${keepText}\n` +
              `#${entryIndex + 1}를 활성화하려면 기존 엔트리를 비활성하거나 다른 노트로 바꿔주세요.\n\n` +
              `이동: #${jumpTarget + 1}`,
          );

          if (target) {
            (target as any).checked = false;
          }
          fingeringEntryDetailsOpen.value[jumpTarget] = true;
          void focusFingeringEntry(jumpTarget);
          return;
        }
      }

      return setFingeringEnabled(entryIndex, enabled);
    };

    const setFingeringNote = async (entryIndex: number, noteValue: number) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      const n = Math.max(0, Math.min(127, Math.floor(Number(noteValue) || 0)));

      // Enforce max alternate fingerings per note for enabled entries.
      const entry = fingeringEntries.value[entryIndex];
      if (entry && entry.enabled) {
        let sameNoteEnabledCount = 0;
        for (const other of fingeringEntries.value) {
          if (!other.enabled || other.index === entryIndex) {
            continue;
          }
          if (other.note === n) {
            sameNoteEnabledCount++;
          }
        }

        if (sameNoteEnabledCount >= MAX_ALTERNATE_FINGERINGS_PER_NOTE) {
          window.alert(
            `대체키 제한: 노트 ${n}(${midiNoteName(n)})는 최대 ${MAX_ALTERNATE_FINGERINGS_PER_NOTE}개까지 사용(매핑)할 수 있습니다.\n\n` +
              `기존 엔트리를 비활성하거나, 다른 노트로 설정하세요.`,
          );
          return;
        }
      }

      fingeringLoading.value = true;
      try {
        await setGlobalValue(5, entryIndex, n);
        if (fingeringNote.value) {
          fingeringNote.value[entryIndex] = n;
        }
      } finally {
        fingeringLoading.value = false;
      }
    };

    const onFingeringNoteChange = (entryIndex: number, event: Event) => {
      const target = event && (event.target as unknown as HTMLInputElement);
      const raw = target && typeof target.value !== "undefined" ? Number(target.value) : 0;
      return setFingeringNote(entryIndex, raw);
    };

    const setFingeringMask = async (entryIndex: number, rawMask: number) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }

      const usable = normalizeUsableMask(fingeringUiUsableKeyMask.value);
      const mask = (Number(rawMask) >>> 0) & usable;

      const { lo14, hi } = splitMaskTo14BitParts(mask);
      const currentHiEn = (fingeringMaskHi10Enable.value && fingeringMaskHi10Enable.value[entryIndex]) || 0;
      const enabledBit = currentHiEn & fingeringEnableBit;
      const nextHiEn = (hi & fingeringHiMask) | enabledBit;

      fingeringLoading.value = true;
      try {
        // write lo then hi/en
        await setGlobalValue(3, entryIndex, lo14);
        await setGlobalValue(4, entryIndex, nextHiEn);

        if (fingeringMaskLo14.value) {
          fingeringMaskLo14.value[entryIndex] = lo14;
        }
        if (fingeringMaskHi10Enable.value) {
          fingeringMaskHi10Enable.value[entryIndex] = nextHiEn;
        }
      } finally {
        fingeringLoading.value = false;
      }
    };

    const setFingeringKeysText = async (entryIndex: number, text: string) => {
      const mask = parseKeysToMask(text);
      return setFingeringMask(entryIndex, mask);
    };

    const onFingeringKeysChange = (entryIndex: number, event: Event) => {
      const target = event && (event.target as unknown as HTMLInputElement);
      const text = target && typeof target.value !== "undefined" ? String(target.value) : "";
      return setFingeringKeysText(entryIndex, text);
    };

    const setFingeringEntryEl = (entryIndex: number) => (el: unknown) => {
      if (el && el instanceof HTMLElement) {
        fingeringEntryEls.set(entryIndex, el);
      } else {
        fingeringEntryEls.delete(entryIndex);
      }
    };

    const setFingeringNoteInputEl = (entryIndex: number) => (el: unknown) => {
      if (el && el instanceof HTMLInputElement) {
        fingeringNoteInputEls.set(entryIndex, el);
      } else {
        fingeringNoteInputEls.delete(entryIndex);
      }
    };

    const focusFingeringEntry = async (entryIndex: number) => {
      activeFingeringEntryIndex.value = entryIndex;
      await nextTick();

      const container = fingeringEntryEls.get(entryIndex);
      if (container) {
        container.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      const noteInput = fingeringNoteInputEls.get(entryIndex);
      if (noteInput && !noteInput.disabled) {
        noteInput.focus();
        noteInput.select();
      }
    };

    const captureFingeringEntry = async (entryIndex: number) => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }

      // Ensure table data is present (we need it to decide where to store).
      if (!fingeringMaskLo14.value || !fingeringMaskHi10Enable.value || !fingeringNote.value) {
        await loadFingeringTable();
      }

      const rawMask = await readCurrentPressedFingeringMask();
      if (rawMask === null) {
        window.alert(
          "현재 눌림(키 마스크) 읽기가 지원되지 않습니다.\n\n" +
            "펌웨어 업데이트가 필요하거나, 이 보드/타겟에서는 제공되지 않을 수 있습니다.",
        );
        return;
      }

      const usable = normalizeUsableMask(fingeringUiUsableKeyMask.value);
      const pressedMask = (rawMask >>> 0) & usable;
      if (!pressedMask) {
        window.alert("현재 눌린 키가 없습니다.");
        return;
      }

      // Ask which note to save to.
      const currentNote = fingeringNote.value ? fingeringNote.value[entryIndex] : 60;
      const rawNote = window.prompt(
        `눌린 키 조합(${maskToKeysText(pressedMask)})을 어떤 노트로 저장할까요? (0-127)`,
        String(typeof currentNote === "number" ? currentNote : 60),
      );
      if (rawNote === null) {
        return;
      }

      const parsed = Number(String(rawNote).trim());
      if (!Number.isFinite(parsed)) {
        window.alert("노트는 0-127 숫자여야 합니다.");
        return;
      }
      const note = clampMidiNote(parsed);

      await captureFingeringMaskToNote(note, pressedMask);
    };

    onMounted(() => {
      loadUiState();
      loadFingeringTable();

      // Keep scroll arrow enablement in sync.
      window.setTimeout(() => updateFingeringScrollButtons(), 0);
    });

    onMounted(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (!showFingeringCapturePanel.value) {
          return;
        }
        if (event.key === "Escape") {
          showFingeringCapturePanel.value = false;
        }
      };
      window.addEventListener("keydown", onKeyDown);
      onUnmounted(() => window.removeEventListener("keydown", onKeyDown));
    });

    onUnmounted(() => {
      stopCapturePanelPolling();
    });

    onUnmounted(() => {
      try {
        if (typeof document !== "undefined" && document.body) {
          if (captureModalPrevBodyOverflow.value !== null) {
            document.body.style.overflow = captureModalPrevBodyOverflow.value;
          }
          captureModalPrevBodyOverflow.value = null;
        }
      } catch {
        // ignore
      }
    });

    onMounted(() => {
      // Keep a lightweight activity panel in this view regardless of the global Activity toggle.
      detachBreathActivityListener?.();
      detachBreathActivityListener = attachBreathActivityListener(deviceStore.state.input as any);
    });

    onUnmounted(() => {
      detachBreathActivityListener?.();
      detachBreathActivityListener = null;
    });

    watch(
      () => [showSaxHelpPanel.value, showFingeringTable.value],
      () => saveUiState(),
      { deep: false },
    );

    watch(
      () => showFingeringCapturePanel.value,
      (open) => {
        try {
          if (typeof document !== "undefined" && document.body) {
            if (open) {
              if (captureModalPrevBodyOverflow.value === null) {
                captureModalPrevBodyOverflow.value = document.body.style.overflow || "";
              }
              document.body.style.overflow = "hidden";
            } else {
              if (captureModalPrevBodyOverflow.value !== null) {
                document.body.style.overflow = captureModalPrevBodyOverflow.value;
              }
              captureModalPrevBodyOverflow.value = null;
            }
          }
        } catch {
          // ignore
        }

        // Open UX: prefetch current pressed mask so user sees something.
        if (open) {
          window.setTimeout(() => void initCapturePanelPosition(), 0);
          window.setTimeout(() => refreshCapturePanelPressedMask(), 0);
          window.setTimeout(() => void focusCapturePanelNoteInput(), 0);
          window.setTimeout(() => startCapturePanelPolling(), 0);
        } else {
          stopCapturePanelPolling();
          persistCapturePanelPosition();
        }
      },
      { deep: false },
    );

    watch(
      () => capturePanelManualMode.value,
      () => {
        if (!showFingeringCapturePanel.value) {
          stopCapturePanelPolling();
          return;
        }
        if (capturePanelManualMode.value) {
          stopCapturePanelPolling();
          return;
        }
        startCapturePanelPolling();
      },
      { deep: false },
    );

    watch(
      () => [
        fingeringFilterText.value,
        fingeringFilterOnlyEnabled.value,
        fingeringFilterOnlyWithKeys.value,
        fingeringFilterOnlyWithNote.value,
      ],
      () => saveUiState(),
      { deep: false },
    );

    watch(
      () => [
        fingeringKeyLabelPreset.value,
        showFingeringKeyIndex.value,
        showFingeringLabelEditor.value,
        fingeringEntryLayoutMode.value,
        fingeringEntryScrollStepMode.value,
        fingeringKeyLabels.value.join("\u0000"),
      ],
      () => saveUiState(),
      { deep: false },
    );

    const lastUsableMask = ref<number>(normalizeUsableMask(fingeringUiUsableKeyMask.value));

    watch(
      () => fingeringUiUsableKeyMask.value,
      (next) => {
        const normalized = normalizeUsableMask(next);
        if (normalized !== next) {
          fingeringUiUsableKeyMask.value = normalized;
          return;
        }

        const prev = lastUsableMask.value;
        lastUsableMask.value = normalized;

        // If we add back keys while hiding unusable ones, keys that were hidden may
        // overlap the edited keys. Move the newly enabled keys to free spots.
        const added = (normalized & ~prev) >>> 0;
        if (hideUnusableFingeringKeys.value && added) {
          maybeRelocateLayoutOnUsableMaskRestore(prev, normalized);
        }

        saveUiState();
      },
      { deep: false },
    );

    watch(
      () => hideUnusableFingeringKeys.value,
      (next, prev) => {
        if (prev && !next) {
          // Showing all keys again: keep currently usable keys fixed and relocate
          // the others so the full 24-key view has no overlaps.
          maybeRelocateLayoutOnUsableMaskRestore(
            normalizeUsableMask(fingeringUiUsableKeyMask.value),
            full24Mask,
          );
        }
        saveUiState();
      },
      { deep: false },
    );

    watch(
      () => isConnected.value,
      (connected) => {
        if (connected) {
          loadFingeringTable();
          detachBreathActivityListener?.();
          detachBreathActivityListener = attachBreathActivityListener(deviceStore.state.input as any);
        } else {
          fingeringMaskLo14.value = null;
          fingeringMaskHi10Enable.value = null;
          fingeringNote.value = null;
          fingeringSupport.value = "unknown";
          clearBreathActivity();
          detachBreathActivityListener?.();
          detachBreathActivityListener = null;
        }
      },
    );

    watch(
      () => deviceStore.state.input,
      (input) => {
        if (!isConnected.value) {
          return;
        }
        detachBreathActivityListener?.();
        detachBreathActivityListener = attachBreathActivityListener(input as any);
      },
    );

    const fingeringEntries = computed(() => {
      const lo = fingeringMaskLo14.value || [];
      const hiEn = fingeringMaskHi10Enable.value || [];
      const noteArr = fingeringNote.value || [];

      const usable = normalizeUsableMask(fingeringUiUsableKeyMask.value);

      return Array.from({ length: fingeringEntryCount }, (_, index) => {
        const lo14 = Number(lo[index] || 0) & 0x3fff;
        const hiEnVal = Number(hiEn[index] || 0) & (fingeringHiMask | fingeringEnableBit);
        const hi = hiEnVal & fingeringHiMask;
        const enabled = (hiEnVal & fingeringEnableBit) !== 0;
        const mask = (lo14 | (hi << 14)) >>> 0;
        const note = Math.max(0, Math.min(127, Math.floor(Number(noteArr[index] || 0))));

        const displayMask = (mask & usable) >>> 0;

        return {
          index,
          enabled,
          mask: displayMask,
          keysText: maskToKeysText(displayMask),
          note,
        };
      });
    });


    type FingeringBackupEntryV1 = {
      index: number;
      enabled: boolean;
      mask: number;
      note: number;
    };

    type FingeringBackupV1 = {
      schema: "midisaxo.fingering-backup.v1";
      createdAt: string;
      keyCount: number;
      entryCount: number;
      entries: FingeringBackupEntryV1[];
      meta?: {
        boardName?: string;
        firmwareVersion?: string | null;
        buildSha?: string;
        buildTime?: string;
      };
    };

    const fingeringBackupFileInput = ref<HTMLInputElement | null>(null);
    const pendingFingeringBackup = ref<FingeringBackupV1 | null>(null);
    const fingeringBackupApplyProgressText = ref<string>("");

    const hasPendingFingeringBackup = computed(() => pendingFingeringBackup.value !== null);
    const formatBackupTimestampForDisplay = (value: string): string => {
      const raw = String(value || "").trim();
      if (!raw) {
        return "";
      }
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        return raw;
      }
      try {
        return date.toLocaleString();
      } catch {
        return date.toISOString();
      }
    };

    const buildFingeringBackupSummaryText = (backup: FingeringBackupV1): string =>
      `${backup.entryCount}개 엔트리 / ${backup.keyCount}키 / ${backup.entries.length}개 항목`;

    const buildFingeringBackupMetaText = (backup: FingeringBackupV1): string => {
      const parts: string[] = [];
      const createdAt = formatBackupTimestampForDisplay(backup.createdAt);
      if (createdAt) {
        parts.push(`생성: ${createdAt}`);
      }

      const meta = backup.meta || {};
      const board = String(meta.boardName || "").trim();
      if (board) {
        parts.push(`보드: ${board}`);
      }

      const fw = meta.firmwareVersion == null ? "" : String(meta.firmwareVersion).trim();
      if (fw) {
        parts.push(`FW: ${fw}`);
      }

      const shaFull = String(meta.buildSha || "").trim();
      if (shaFull) {
        parts.push(`UI: ${shaFull.slice(0, 7)}`);
      }

      const buildTime = formatBackupTimestampForDisplay(String(meta.buildTime || ""));
      if (buildTime) {
        parts.push(`빌드: ${buildTime}`);
      }

      return parts.join(" / ");
    };

    const pendingFingeringBackupSummary = computed(() => {
      const backup = pendingFingeringBackup.value;
      if (!backup) {
        return "";
      }
      return buildFingeringBackupSummaryText(backup);
    });

    const pendingFingeringBackupMetaText = computed(() => {
      const backup = pendingFingeringBackup.value;
      if (!backup) {
        return "";
      }

      return buildFingeringBackupMetaText(backup);
    });

    const createFingeringBackupFromCurrent = (): FingeringBackupV1 => {
      const entries: FingeringBackupEntryV1[] = fingeringEntries.value.map((e) => ({
        index: e.index,
        enabled: Boolean(e.enabled),
        mask: Number(e.mask) >>> 0,
        note: clampMidiNote(Number(e.note) || 0),
      }));

      const buildSha =
        (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BUILD_SHA) || "";
      const buildTime =
        (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BUILD_TIME) || "";

      const boardName = (deviceStore.state && deviceStore.state.boardName) || "";
      const firmwareVersion = (deviceStore.state && deviceStore.state.firmwareVersion) || null;

      return {
        schema: "midisaxo.fingering-backup.v1",
        createdAt: new Date().toISOString(),
        keyCount: fingeringKeyCount,
        entryCount: fingeringEntryCount,
        entries,
        meta: {
          boardName,
          firmwareVersion,
          buildSha,
          buildTime,
        },
      };
    };

    const formatTimestampForFilename = (date: Date): string => {
      // e.g. 20260115-132530
      return date
        .toISOString()
        .replace(/\..+$/, "")
        .replace(/[-:]/g, "")
        .replace("T", "-");
    };

    const sanitizeFilenameToken = (value: unknown, maxLen = 32): string => {
      const raw = String(value || "")
        .trim()
        .toLowerCase();
      if (!raw) {
        return "";
      }

      const safe = raw
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "")
        .replace(/-+/g, "-");

      if (!safe) {
        return "";
      }

      return safe.slice(0, Math.max(1, Math.floor(maxLen)));
    };

    const buildFingeringBackupFilename = (base: string, timestamp: string): string => {
      const board = sanitizeFilenameToken(deviceStore.state?.boardName, 24);
      const fw = sanitizeFilenameToken(deviceStore.state?.firmwareVersion, 16);
      const shaFull =
        (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BUILD_SHA) || "";
      const sha = sanitizeFilenameToken(String(shaFull).slice(0, 7), 7);

      const parts = [base, board, fw, sha, timestamp].filter(Boolean);
      return `${parts.join("-")}.json`;
    };

    const downloadJson = (filename: string, data: unknown): void => {
      const text = JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();

      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    const exportFingeringBackup = (): void => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      const backup = createFingeringBackupFromCurrent();
      const ts = formatTimestampForFilename(new Date());
      downloadJson(buildFingeringBackupFilename("midisaxo-fingering-backup", ts), backup);
    };

    const triggerFingeringBackupImport = (): void => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      fingeringBackupFileInput.value?.click();
    };

    const parseFingeringBackup = (raw: any): FingeringBackupV1 => {
      if (!raw || raw.schema !== "midisaxo.fingering-backup.v1") {
        throw new Error("지원하지 않는 백업 형식입니다.");
      }
      const entryCount = Math.max(0, Math.floor(Number(raw.entryCount) || 0));
      const keyCount = Math.max(0, Math.floor(Number(raw.keyCount) || 0));
      const createdAt = String(raw.createdAt || "");
      const entriesRaw = Array.isArray(raw.entries) ? raw.entries : [];
      const entries: FingeringBackupEntryV1[] = entriesRaw
        .map((e: any) => ({
          index: Math.max(0, Math.floor(Number(e?.index) || 0)),
          enabled: Boolean(e?.enabled),
          mask: (Number(e?.mask) >>> 0) || 0,
          note: clampMidiNote(Math.floor(Number(e?.note) || 0)),
        }))
        .filter((e) => Number.isFinite(e.index) && e.index >= 0 && e.index < entryCount);

      const metaRaw = raw && typeof raw.meta === "object" ? raw.meta : null;
      const meta = metaRaw
        ? {
            boardName: String((metaRaw as any).boardName || "").trim() || undefined,
            firmwareVersion:
              (metaRaw as any).firmwareVersion == null
                ? undefined
                : String((metaRaw as any).firmwareVersion),
            buildSha: String((metaRaw as any).buildSha || "").trim() || undefined,
            buildTime: String((metaRaw as any).buildTime || "").trim() || undefined,
          }
        : undefined;

      return {
        schema: "midisaxo.fingering-backup.v1",
        createdAt,
        keyCount,
        entryCount,
        entries,
        meta,
      };
    };

    const onFingeringBackupFileChange = async (ev: Event): Promise<void> => {
      const input = ev.target as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) {
        return;
      }
      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        const backup = parseFingeringBackup(raw);

        if (backup.keyCount !== fingeringKeyCount || backup.entryCount !== fingeringEntryCount) {
          pendingFingeringBackup.value = null;
          window.alert(
            `이 백업은 현재 설정과 호환되지 않습니다. (백업: ${backup.entryCount}엔트리/${backup.keyCount}키, 현재: ${fingeringEntryCount}엔트리/${fingeringKeyCount}키)`,
          );
          return;
        }

        pendingFingeringBackup.value = backup;
      } catch (err) {
        const e = err as any;
        pendingFingeringBackup.value = null;
        window.alert(`백업 파일을 읽을 수 없습니다: ${String(e?.message || e)}`);
      } finally {
        if (input) {
          input.value = "";
        }
      }
    };

    const applyFingeringBackup = async (): Promise<void> => {
      if (!isConnected.value || fingeringSupport.value !== "supported") {
        return;
      }
      const backup = pendingFingeringBackup.value;
      if (!backup) {
        return;
      }

      const summaryText = buildFingeringBackupSummaryText(backup);
      const metaText = buildFingeringBackupMetaText(backup);
      const ok = window.confirm(
        [
          "현재 기기의 핑거링 테이블(전체 128개)을 백업 내용으로 덮어씁니다.",
          "",
          `백업: ${summaryText}`,
          metaText ? metaText : "",
          "",
          "계속할까요?",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      if (!ok) {
        return;
      }

      // Safety: auto-export current table before overwriting.
      try {
        const safety = createFingeringBackupFromCurrent();
        const ts = formatTimestampForFilename(new Date());
        downloadJson(buildFingeringBackupFilename("midisaxo-fingering-safety-backup-before-apply", ts), safety);
      } catch {
        // Ignore auto-backup failures and continue.
      }

      const entryMap = new Map<number, FingeringBackupEntryV1>();
      for (const e of backup.entries) {
        entryMap.set(e.index, e);
      }

      fingeringLoading.value = true;
      fingeringBackupApplyProgressText.value = "백업 적용 준비중…";

      try {
        for (let i = 0; i < fingeringEntryCount; i++) {
          const e = entryMap.get(i) || { index: i, enabled: false, mask: 0, note: 0 };
          const mask = Number(e.mask) >>> 0;
          const { lo14, hi } = splitMaskTo14BitParts(mask);
          const hiEn = (hi & fingeringHiMask) | (e.enabled ? fingeringEnableBit : 0);
          const note = clampMidiNote(Math.floor(Number(e.note) || 0));

          fingeringBackupApplyProgressText.value = `백업 적용중… ${i + 1}/${fingeringEntryCount}`;
          await setGlobalValue(3, i, lo14);
          await setGlobalValue(4, i, hiEn);
          await setGlobalValue(5, i, note);
        }

        fingeringBackupApplyProgressText.value = "백업 적용 완료. 테이블 동기화중…";
        await loadFingeringTable();
        pendingFingeringBackup.value = null;
      } finally {
        fingeringBackupApplyProgressText.value = "";
        fingeringLoading.value = false;
      }
    };

    const normalizeFilterText = (text: string): string =>
      String(text || "")
        .trim()
        .toLowerCase();

    const fingeringEntryDetailsOpen = ref<Record<number, boolean>>({});
    const isFingeringEntryDetailsOpen = (entryIndex: number): boolean => fingeringEntryDetailsOpen.value[entryIndex] === true;
    const toggleFingeringEntryDetails = (entryIndex: number): void => {
      fingeringEntryDetailsOpen.value[entryIndex] = !isFingeringEntryDetailsOpen(entryIndex);
    };

    const openAllFingeringEntryDetails = (): void => {
      const next: Record<number, boolean> = {};
      for (let i = 0; i < fingeringEntryCount; i++) {
        next[i] = true;
      }
      fingeringEntryDetailsOpen.value = next;
    };

    const closeAllFingeringEntryDetails = (): void => {
      fingeringEntryDetailsOpen.value = {};
    };

    const resetFingeringFilters = (): void => {
      fingeringFilterText.value = "";
      fingeringFilterOnlyEnabled.value = false;
      fingeringFilterOnlyWithKeys.value = false;
      fingeringFilterOnlyWithNote.value = false;
    };

    const fingeringEntryMeta = computed(() => {
      // "Data" means: enabled OR non-zero mask. (Note alone is always 0..127 and not meaningful.)
      let maxUsedIndex = -1;
      for (const entry of fingeringEntries.value) {
        const hasData = !!entry.enabled || ((Number(entry.mask) >>> 0) !== 0);
        if (!hasData) {
          continue;
        }
        if (entry.index > maxUsedIndex) {
          maxUsedIndex = entry.index;
        }
      }

      const usedCount = maxUsedIndex >= 0 ? maxUsedIndex + 1 : 0;
      // Keep a baseline (default ~4 octaves), then expand/shrink as notes (incl alternates) change.
      const requiredCount = Math.max(defaultFingeringActiveEntryCount, usedCount);
      return {
        requiredCount: Math.max(1, Math.min(fingeringEntryCount, requiredCount)),
      };
    });

    const fingeringEntryRequiredCount = computed(() => fingeringEntryMeta.value.requiredCount);
    const fingeringActiveEntryCount = computed(() => fingeringEntryRequiredCount.value);

    const visibleFingeringEntries = computed(() => {
      const q = normalizeFilterText(fingeringFilterText.value);
      const qNoSpaces = q.replace(/\s+/g, "");
      const qIndexText = qNoSpaces.replace(/^#/, "");
      const activeCount = fingeringActiveEntryCount.value;

      return fingeringEntries.value.filter((entry) => {
        const hasNote = typeof entry.note === "number" && Number.isFinite(entry.note);
        if (entry.index >= activeCount) {
          return false;
        }
        if (fingeringFilterOnlyEnabled.value && !entry.enabled) {
          return false;
        }
        if (fingeringFilterOnlyWithKeys.value && !entry.mask) {
          return false;
        }
        // Note 0 is valid (0-127). Don't treat it as "missing".
        if (fingeringFilterOnlyWithNote.value && !hasNote) {
          return false;
        }

        if (!qNoSpaces) {
          return true;
        }

        const keysText = String(entry.keysText || "").toLowerCase();
        const keysTextNoSpaces = keysText.replace(/\s+/g, "");
        const noteStr = hasNote ? String(entry.note) : "";
        const noteName = hasNote ? midiNoteName(entry.note).toLowerCase() : "";

        return (
          // UI shows entry numbers as 1..128; keep 0-based matching too for backward-compat.
          String(entry.index + 1).includes(qIndexText) ||
          String(entry.index).includes(qIndexText) ||
          noteStr.includes(qNoSpaces) ||
          noteName.includes(qNoSpaces) ||
          keysTextNoSpaces.includes(qNoSpaces)
        );
      });
    });

    watch(
      () => [
        fingeringEntryLayoutMode.value,
        visibleFingeringEntries.value.length,
        fingeringLoading.value,
      ],
      () => {
        window.setTimeout(() => updateFingeringScrollButtons(), 0);
      },
      { deep: false },
    );

    return {
      formData,
      loading,
      onSaxSettingChange,
      showField,
      saxSections,
      hasSaxSections,
      saxHelpItems,
      showSaxHelpPanel,
      toggleSaxHelpPanel,
      saveUiState,
      isConnected,

      isMidisaxoBoard,
      pressurePbPresetBusy,
      pressurePbPresetNotice,
      applyPressurePitchBendPreset,

      pbQuickBusy,
      pbQuickError,
      pbDeadzoneValue,
      pbDeadzoneDraft,
      refreshPbDeadzone,
      onPbCenterCapture,
      onPbDeadzoneInc,
      onPbDeadzoneDec,
      onPbDeadzoneDraftChange,
      onPbDeadzoneSet,

      clearBreathActivity,
      breathCcStatusLine,
      lastBreathCcTime,
      showFingeringTable,

      exportFingeringBackup,
      triggerFingeringBackupImport,
      onFingeringBackupFileChange,
      applyFingeringBackup,
      hasPendingFingeringBackup,
      pendingFingeringBackupSummary,
      pendingFingeringBackupMetaText,
      fingeringBackupApplyProgressText,
      fingeringBackupFileInput,

      fingeringSupport,
      fingeringLoading,
      fingeringEntryCount,
      fingeringEntries,
      visibleFingeringEntries,
      isFingeringEntryDetailsOpen,
      toggleFingeringEntryDetails,
      openAllFingeringEntryDetails,
      closeAllFingeringEntryDetails,
      fingeringFilterText,
      fingeringFilterOnlyEnabled,
      fingeringFilterOnlyWithKeys,
      fingeringFilterOnlyWithNote,
      fingeringActiveEntryCount,
      fingeringEntryRequiredCount,
      fingeringUiUsableKeyMask,
      fingeringUsableKeyCount,
      showFingeringUsableKeySelector,
      hideUnusableFingeringKeys,
      hideUnselectedKeysInKeySelector,
      midiNoteName,
      applyFingeringControllerPreset,
      fingeringKeyPadLayoutMode,
      resetFingeringFilters,
      reloadFingering,
      captureFingeringEntry,

      showFingeringCapturePanel,
      capturePanelCardEl,
      capturePanelCardStyle,
      capturePanelPressedMask,
      capturePanelPressedKeysText,
      capturePanelPressedKeyCount,
      capturePanelPressedMaskHex,
      capturePanelNoteDraft,
      capturePanelStatusText,
      capturePanelContinuousMode,
      capturePanelManualMode,
      clearCapturePanelSelection,
      clearCapturePanelDevicePressedMask,
      refreshCapturePanelPressedMask,
      saveCapturePanelToNote,
      resetCapturePanelPosition,
      onCapturePanelDragStart,
      onCapturePanelNoteWheel,

      onFingeringEnabledChange,
      onFingeringKeysChange,
      onFingeringNoteChange,
      setFingeringEnabled,
      setFingeringMask,
      setFingeringKeysText,
      setFingeringNote,
      activeFingeringEntryIndex,
      setFingeringEntryEl,
      setFingeringNoteInputEl,

      fingeringKeyLabelPreset,
      fingeringKeyLabels,
      showFingeringKeyIndex,
      showFingeringLabelEditor,
      showFingeringLayoutEditor,
      fingeringSaxLayoutOverrideText,
      fingeringSaxLayoutOverride,
      fingeringSaxLayoutOverrideError,
      fingeringSaxLayoutForDragEditor,
      onFingeringSaxLayoutDragUpdate,
      onFingeringSaxLayoutOverrideInput,
      onFingeringSaxLayoutOverrideCompositionStart,
      onFingeringSaxLayoutOverrideCompositionEnd,
      fingeringLayoutAutoRelocateNotice,
      exportFingeringSaxLayoutOverride,
      triggerFingeringSaxLayoutOverrideImport,
      onFingeringLayoutFileChange,
      fingeringLayoutFileInput,

      fingeringLayoutPresets,
      activeFingeringLayoutPresetId,
      selectedFingeringLayoutPresetId,
      fingeringLayoutPresetNameDraft,
      applyFingeringLayoutPreset,
      addFingeringLayoutPresetFromCurrent,
      updateSelectedFingeringLayoutPresetFromCurrent,
      renameSelectedFingeringLayoutPreset,
      deleteSelectedFingeringLayoutPreset,
      exportSelectedFingeringLayoutPreset,
      triggerFingeringLayoutPresetImport,
      onFingeringLayoutPresetFileChange,
      fingeringLayoutPresetFileInput,

      resetFingeringSaxLayoutOverrideToDefault,
      clearFingeringSaxLayoutOverride,
      fingeringEntryLayoutMode,
      fingeringEntryScrollStepMode,
      fingeringEntriesScrollEl,
      canScrollFingeringLeft,
      canScrollFingeringRight,
      scrollFingeringEntriesByPage,
      updateFingeringScrollButtons,

      jumpToCurrentPressedFingering,
      jumpToFingeringEntry,
      lastPressedJumpCandidates,
      lastPressedJumpExact,
      lastPressedJumpKeysText,
      clearLastPressedJump,
      getNoteAlternativesForEntry,
      onFingeringLabelPresetChange,
      onFingeringEntryLayoutModeChange,
      onFingeringKeyLabelInput,
      fingeringKeyLabelsText,
      onFingeringKeyLabelsTextInput,
      onFingeringKeyLabelsTextCompositionStart,
      onFingeringKeyLabelsTextCompositionEnd,
      resetFingeringLabelsToPreset,
    };
  },
});
</script>

<style scoped>
.form-grid.sax-settings-grid {
  padding-bottom: 1rem;
  gap: 0.75rem 1rem;
}

.sax-settings-grid :deep(.form-field .label) {
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.1;
}

.sax-settings-grid :deep(.form-field .instructions) {
  font-size: 0.75rem;
}

.sax-settings-grid :deep(.form-field .error-message) {
  margin-top: 0.25rem;
  font-size: 0.75rem;
}
</style>
