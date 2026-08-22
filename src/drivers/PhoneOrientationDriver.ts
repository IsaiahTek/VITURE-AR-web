import type { IOrientationDriver } from './IOrientationDriver';
import * as THREE from 'three';

export class PhoneOrientationDriver implements IOrientationDriver {
  private connected = false;
  private callbacks: Array<(q: [number, number, number, number]) => void> = [];
  
  private euler = new THREE.Euler();
  private quaternion = new THREE.Quaternion();
  private zee = new THREE.Vector3(0, 0, 1);
  private q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

  async connect(): Promise<void> {
    // Some iOS devices require explicit user permission for device orientation
    const devEvent = DeviceOrientationEvent as any;
    if (typeof devEvent.requestPermission === 'function') {
      try {
        const permissionState = await devEvent.requestPermission();
        if (permissionState !== 'granted') {
          throw new Error("Device orientation permission denied.");
        }
      } catch (e) {
        throw new Error("Permission request failed or not supported.");
      }
    }

    if (!window.DeviceOrientationEvent) {
        throw new Error("Device orientation is not supported by this browser/device.");
    }

    window.addEventListener('deviceorientation', this.onDeviceOrientation);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
    this.connected = false;
  }

  private onDeviceOrientation = (event: DeviceOrientationEvent) => {
    // Fallback or ignore if axes are null (e.g. desktop browser with no sensors)
    if (event.alpha === null || event.beta === null || event.gamma === null) return;

    const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0; 
    const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0; 
    const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0; 

    // W3C specifies YXZ rotation order for device orientation
    this.euler.set(beta, alpha, -gamma, 'YXZ');
    this.quaternion.setFromEuler(this.euler);

    const screenOrientation = typeof screen.orientation !== 'undefined' 
        ? THREE.MathUtils.degToRad(screen.orientation.angle) 
        : (window.orientation ? THREE.MathUtils.degToRad(window.orientation as number) : 0);
        
    const q1 = new THREE.Quaternion().setFromAxisAngle(this.zee, -screenOrientation);
    
    // Convert to world coordinates
    this.quaternion.multiply(this.q0).multiply(q1);

    this.callbacks.forEach(cb => cb([
      this.quaternion.x,
      this.quaternion.y,
      this.quaternion.z,
      this.quaternion.w
    ]));
  };

  onOrientation(callback: (quaternion: [number, number, number, number]) => void): void {
    this.callbacks.push(callback);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getDriverName(): string {
    return "PhoneOrientationDriver";
  }
}
