import type { IOrientationDriver } from './IOrientationDriver';
import * as THREE from 'three';

export class MockTelemetryDriver implements IOrientationDriver {
  private connected = false;
  private callbacks: Array<(q: [number, number, number, number]) => void> = [];
  private animationFrameId = 0;
  private time = 0;

  private targetEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private currentEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private quaternion = new THREE.Quaternion();

  async connect(): Promise<void> {
    this.connected = true;
    this.startSimulation();
    window.addEventListener('mousemove', this.onMouseMove);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  private onMouseMove = (e: MouseEvent) => {
    // Map mouse position to reasonable head rotation angles
    const normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
    const normalizedY = (e.clientY / window.innerHeight) * 2 - 1;

    // Pitch & Yaw constraints
    this.targetEuler.y = -normalizedX * (Math.PI / 1.5);
    this.targetEuler.x = -normalizedY * (Math.PI / 3);
  };

  private startSimulation = () => {
    if (!this.connected) return;

    this.time += 0.016; 

    // Smooth parametric sinusoidal curves (pitch, yaw, slight roll)
    const swayX = Math.sin(this.time * 0.5) * 0.05;
    const swayY = Math.cos(this.time * 0.3) * 0.05;
    const swayZ = Math.sin(this.time * 0.7) * 0.02;

    this.currentEuler.x += (this.targetEuler.x + swayX - this.currentEuler.x) * 0.1;
    this.currentEuler.y += (this.targetEuler.y + swayY - this.currentEuler.y) * 0.1;
    this.currentEuler.z += (swayZ - this.currentEuler.z) * 0.1;

    this.quaternion.setFromEuler(this.currentEuler);

    this.callbacks.forEach(cb => cb([
      this.quaternion.x,
      this.quaternion.y,
      this.quaternion.z,
      this.quaternion.w
    ]));

    this.animationFrameId = requestAnimationFrame(this.startSimulation);
  };

  onOrientation(callback: (quaternion: [number, number, number, number]) => void): void {
    this.callbacks.push(callback);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getDriverName(): string {
    return "MockTelemetryDriver";
  }
}
