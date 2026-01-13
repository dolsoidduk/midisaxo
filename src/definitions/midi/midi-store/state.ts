import { reactive } from "vue";
import { Input, Output } from "webmidi";
import { IMidiState, MidiConnectionState } from "./interface";

export const defaultState: IMidiState = {
  connectionState: MidiConnectionState.Closed,
  isReloading: false,
  lastRescanAt: null,
  inputs: [] as Array<Input>,
  outputs: [] as Array<Output>,
  rawInputs: [],
  rawOutputs: [],
  lastEnableError: null,
  log: true,
  isWebMidiSupported: false,
};

export const midiState = reactive(defaultState);
