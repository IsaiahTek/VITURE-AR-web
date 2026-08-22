import * as THREE from 'three';
import { DeviceManager } from '../core/DeviceManager';

export class SpatialScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private deviceManager: DeviceManager;
  
  private targetQuaternion = new THREE.Quaternion();
  private slerpFactor = 0.1; 
  private yawOffset = 0; 
  private videoElement: HTMLVideoElement | null = null;
  private originalBackground: THREE.Color | THREE.Texture | null = null;
  private arEnabled = false;

  constructor(container: HTMLElement, deviceManager: DeviceManager) {
    this.deviceManager = deviceManager;
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1115);
    this.scene.fog = new THREE.FogExp2(0x0f1115, 0.03);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.setupEnvironment();
    this.setupPanels();
    this.setupTelemetrySubscription();

    window.addEventListener('resize', this.onWindowResize);

    this.animate();
  }

  private setupEnvironment() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);

    const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
    gridHelper.position.y = -2;
    this.scene.add(gridHelper);

    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 1000;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 50;
      positions[i+1] = (Math.random() - 0.5) * 50;
      positions[i+2] = (Math.random() - 0.5) * 50;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.05,
      transparent: true,
      opacity: 0.6
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(particles);
  }

  private setupPanels() {
    const panelMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x111928,
      metalness: 0.3,
      roughness: 0.2,
      transparent: true,
      opacity: 0.8,
      transmission: 0.6,
      side: THREE.DoubleSide
    });

    const leftPanel = this.createPanel("Telemetry Monitor", panelMaterial);
    leftPanel.position.set(-3, 0, -4);
    leftPanel.lookAt(this.camera.position);
    this.scene.add(leftPanel);

    const centerPanel = this.createPanel("Main Dashboard", panelMaterial);
    centerPanel.scale.set(1.5, 1.5, 1.5);
    centerPanel.position.set(0, 0, -5);
    centerPanel.lookAt(this.camera.position);
    this.scene.add(centerPanel);

    const rightPanel = this.createPanel("Device Diagnostics", panelMaterial);
    rightPanel.position.set(3, 0, -4);
    rightPanel.lookAt(this.camera.position);
    this.scene.add(rightPanel);
  }

  private createPanel(title: string, material: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    
    const geometry = new THREE.PlaneGeometry(2, 1.2);
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, canvas.width / 2, canvas.height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const textPlane = new THREE.Mesh(geometry, textMaterial);
    textPlane.position.z = 0.01;
    group.add(textPlane);

    return group;
  }

  private setupTelemetrySubscription() {
    this.deviceManager.onOrientation((q) => {
      this.targetQuaternion.set(q[0], q[1], q[2], q[3]);
      
      if (this.yawOffset !== 0) {
        const offsetQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yawOffset);
        this.targetQuaternion.premultiply(offsetQ);
      }
    });
  }

  public recenter() {
    const currentEuler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yawOffset -= currentEuler.y;
  }

  public setDamping(value: number) {
    this.slerpFactor = value;
  }

  public async toggleARPassthrough(): Promise<boolean> {
    if (this.arEnabled) {
      if (this.videoElement) {
        const stream = this.videoElement.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        this.videoElement.remove();
        this.videoElement = null;
      }
      this.scene.background = this.originalBackground;
      this.arEnabled = false;
      return false;
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        
        this.videoElement = document.createElement('video');
        this.videoElement.srcObject = stream;
        this.videoElement.setAttribute('playsinline', 'true');
        this.videoElement.play();
        
        const videoTexture = new THREE.VideoTexture(this.videoElement);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        
        this.originalBackground = this.scene.background;
        this.scene.background = videoTexture;
        this.arEnabled = true;
        return true;
      } catch (e) {
        console.error("Camera access denied or unavailable", e);
        throw new Error("Could not access the camera for AR Passthrough.");
      }
    }
  }

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private animate = () => {
    requestAnimationFrame(this.animate);
    this.camera.quaternion.slerp(this.targetQuaternion, this.slerpFactor);
    this.renderer.render(this.scene, this.camera);
  };
}
