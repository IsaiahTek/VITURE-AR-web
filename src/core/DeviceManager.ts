import type { IOrientationDriver } from '../drivers/IOrientationDriver';
import { MockTelemetryDriver } from '../drivers/MockTelemetryDriver';
import { VitureWebHIDDriver } from '../drivers/VitureWebHIDDriver';
import { PhoneOrientationDriver } from '../drivers/PhoneOrientationDriver';

export class DeviceManager {
  private currentDriver: IOrientationDriver;
  private mockDriver: MockTelemetryDriver;
  private vitureDriver: VitureWebHIDDriver;
  private phoneDriver: PhoneOrientationDriver;
  
  private orientationCallbacks: Array<(q: [number, number, number, number]) => void> = [];

  constructor() {
    this.mockDriver = new MockTelemetryDriver();
    this.vitureDriver = new VitureWebHIDDriver();
    this.phoneDriver = new PhoneOrientationDriver();
    
    this.currentDriver = this.mockDriver;
    
    this.setupDriver(this.mockDriver);
    this.setupDriver(this.vitureDriver);
    this.setupDriver(this.phoneDriver);
  }

  private setupDriver(driver: IOrientationDriver) {
    driver.onOrientation((q) => {
      if (this.currentDriver === driver) {
        this.orientationCallbacks.forEach(cb => cb(q));
      }
    });
  }

  onOrientation(callback: (q: [number, number, number, number]) => void) {
    this.orientationCallbacks.push(callback);
  }

  async switchDriver(driverName: string): Promise<boolean> {
    let nextDriver: IOrientationDriver;
    switch (driverName) {
      case 'mock': nextDriver = this.mockDriver; break;
      case 'viture': nextDriver = this.vitureDriver; break;
      case 'phone': nextDriver = this.phoneDriver; break;
      default: nextDriver = this.mockDriver;
    }
    
    if (this.currentDriver === nextDriver && nextDriver.isConnected()) {
        return true;
    }

    try {
      if (this.currentDriver.isConnected()) {
        await this.currentDriver.disconnect();
      }
      
      this.currentDriver = nextDriver;
      await this.currentDriver.connect();
      return true;
    } catch (e) {
      console.error(`Failed to switch to ${nextDriver.getDriverName()}:`, e);
      if (driverName !== 'mock') {
        console.warn("Falling back to Mock Simulator.");
        this.currentDriver = this.mockDriver;
        await this.currentDriver.connect();
      }
      return false;
    }
  }

  getCurrentDriver(): IOrientationDriver {
    return this.currentDriver;
  }
}
