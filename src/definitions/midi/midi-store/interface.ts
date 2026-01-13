export enum MidiConnectionState {
  Closed = "closed",
  Pending = "pending",
  Open = "open",
}

export interface MidiPortSummary {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface IMidiState {
  connectionState: MidiConnectionState;
  isReloading: boolean;
  lastRescanAt: number | null;
  inputs: Array<Input>;
  outputs: Array<Output>;
  rawInputs: Array<MidiPortSummary>;
  rawOutputs: Array<MidiPortSummary>;
  lastEnableError: string | null;
  log: boolean;
  isWebMidiSupported: boolean;
}
