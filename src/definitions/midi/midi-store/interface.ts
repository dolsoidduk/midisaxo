export enum MidiConnectionState {
  Closed = "closed",
  Pending = "pending",
  Open = "open",
}

export interface IMidiPortSummary {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface IMidiDebugState {
  tag: string;
  supported: boolean;
  enabled: boolean;
  inputs: Array<IMidiPortSummary>;
  outputs: Array<IMidiPortSummary>;
  hasOnlyGenericThrough: boolean;
}

export interface IMidiState {
  connectionState: MidiConnectionState;
  inputs: Array<Input>;
  outputs: Array<Output>;
  log: boolean;
  isWebMidiSupported: boolean;
  debug: IMidiDebugState;
}
