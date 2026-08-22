export interface IOrientationDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onOrientation(callback: (quaternion: [number, number, number, number]) => void): void;
  isConnected(): boolean;
  getDriverName(): string;
  sendCommand?(command: Uint8Array): Promise<void>;
}
