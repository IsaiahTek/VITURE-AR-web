/// <reference types="vite/client" />
/// <reference types="w3c-web-hid" />
import type { IOrientationDriver } from './IOrientationDriver';
import { IMUParser } from '../core/IMUParser';

export class VitureWebHIDDriver implements IOrientationDriver {
  private connected = false;
  private callbacks: Array<(q: [number, number, number, number]) => void> = [];
  private device: HIDDevice | null = null;
  
  private readonly VITURE_VID = 0x35CA;

  async connect(): Promise<void> {
    if (!('hid' in navigator)) {
      throw new Error("WebHID API is not supported in this browser.");
    }

    try {
      // Request device with VITURE vendor ID
      const devices = await navigator.hid.requestDevice({
        filters: [{ vendorId: this.VITURE_VID }]
      });

      if (devices.length === 0) {
        throw new Error("No VITURE device selected.");
      }

      this.device = devices[0];
      await this.device.open();
      
      this.device.addEventListener('inputreport', this.handleInputReport);
      this.connected = true;
    } catch (e) {
      console.error("Viture connection failed:", e);
      this.connected = false;
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device && this.device.opened) {
      this.device.removeEventListener('inputreport', this.handleInputReport);
      await this.device.close();
    }
    this.device = null;
    this.connected = false;
  }

  private handleInputReport = (event: HIDInputReportEvent) => {
    const { data } = event;
    const quaternion = IMUParser.parseVitureIMUReport(data);
    
    if (quaternion) {
      this.callbacks.forEach(cb => cb(quaternion));
    }
  };

  onOrientation(callback: (quaternion: [number, number, number, number]) => void): void {
    this.callbacks.push(callback);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getDriverName(): string {
    return "VitureWebHIDDriver";
  }

  async sendCommand(command: Uint8Array): Promise<void> {
    if (this.device && this.device.opened) {
      // Typically reportId 0 or something specific, using 0 as fallback
      await this.device.sendReport(0, command as unknown as BufferSource);
    } else {
      throw new Error("Cannot send command: Device not connected.");
    }
  }
}
