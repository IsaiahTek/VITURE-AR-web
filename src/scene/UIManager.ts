import { DeviceManager } from '../core/DeviceManager';
import { SpatialScene } from './SpatialScene';

export class UIManager {
  private deviceManager: DeviceManager;
  private scene: SpatialScene;
  
  private statusBadge: HTMLElement | null = null;
  private driverSelect: HTMLSelectElement | null = null;

  constructor(deviceManager: DeviceManager, scene: SpatialScene) {
    this.deviceManager = deviceManager;
    this.scene = scene;
    
    this.buildUI();
    this.updateStatusBadge();
  }

  private buildUI() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;

    const header = document.createElement('div');
    header.className = 'flex justify-between items-start pointer-events-auto';
    
    const titleContainer = document.createElement('div');
    titleContainer.innerHTML = `
      <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">Spatial Dashboard</h1>
      <p class="text-gray-400 text-sm mt-1">WebXR 3DoF Prototype</p>
    `;
    
    this.statusBadge = document.createElement('div');
    
    header.appendChild(titleContainer);
    header.appendChild(this.statusBadge);
    
    const controls = document.createElement('div');
    controls.className = 'pointer-events-auto self-center bg-gray-900/60 backdrop-blur-md border border-gray-700/50 p-6 rounded-2xl shadow-2xl flex flex-col gap-4 w-96';
    
    const selectContainer = document.createElement('div');
    selectContainer.className = 'flex flex-col gap-2';
    selectContainer.innerHTML = `
      <span class="text-sm font-medium text-gray-200">Input Source</span>
      <select id="driver-select" class="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none">
        <option value="mock">Simulated (Mouse)</option>
        <option value="phone">Phone IMU (Sensors)</option>
        <option value="viture">VITURE AR (WebHID)</option>
      </select>
    `;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = isMobile ? 'grid grid-cols-3 gap-2 mt-2' : 'grid grid-cols-2 gap-2 mt-2';
    
    const recenterBtn = document.createElement('button');
    recenterBtn.className = 'bg-gray-800 hover:bg-gray-700 text-white text-sm py-2 px-4 rounded transition-colors border border-gray-700';
    recenterBtn.innerText = 'Recenter View';
    recenterBtn.onclick = () => this.scene.recenter();

    const sbsBtn = document.createElement('button');
    sbsBtn.className = 'bg-gray-800 hover:bg-gray-700 text-white text-sm py-2 px-4 rounded transition-colors border border-gray-700';
    sbsBtn.innerText = 'Toggle 3D SBS';
    sbsBtn.onclick = async () => {
      const driver = this.deviceManager.getCurrentDriver();
      if (driver.getDriverName() === 'VitureWebHIDDriver' && driver.sendCommand) {
        try {
          await driver.sendCommand(new Uint8Array([0x01, 0x02, 0x03]));
        } catch(e) {
          console.error(e);
          alert("Failed to send SBS command");
        }
      } else {
        alert("SBS Toggle only available on physical VITURE hardware.");
      }
    };

    const arBtn = document.createElement('button');
    arBtn.className = 'bg-indigo-800 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-1 rounded transition-colors border border-indigo-700';
    arBtn.innerText = 'Toggle AR';
    arBtn.onclick = async () => {
      try {
        const enabled = await this.scene.toggleARPassthrough();
        if (enabled) {
          arBtn.className = 'bg-green-700 hover:bg-green-600 text-white text-xs font-bold py-2 px-1 rounded transition-colors border border-green-600';
        } else {
          arBtn.className = 'bg-indigo-800 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-1 rounded transition-colors border border-indigo-700';
        }
      } catch (e: any) {
        alert(e.message || "Failed to toggle AR Passthrough");
      }
    };

    buttonsContainer.appendChild(recenterBtn);
    buttonsContainer.appendChild(sbsBtn);
    if (isMobile) {
      buttonsContainer.appendChild(arBtn);
    }

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'flex flex-col gap-1 mt-2';
    sliderContainer.innerHTML = `
      <div class="flex justify-between text-xs text-gray-400">
        <span>Smoothing / Damping</span>
        <span id="slerp-val">10%</span>
      </div>
      <input type="range" id="slerp-slider" min="1" max="100" value="10" class="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer">
    `;

    controls.appendChild(selectContainer);
    controls.appendChild(sliderContainer);
    controls.appendChild(buttonsContainer);

    uiLayer.appendChild(header);
    uiLayer.appendChild(controls);

    this.driverSelect = document.getElementById('driver-select') as HTMLSelectElement;
    
    const currentName = this.deviceManager.getCurrentDriver().getDriverName();
    if (currentName === 'PhoneOrientationDriver') this.driverSelect.value = 'phone';
    else if (currentName === 'VitureWebHIDDriver') this.driverSelect.value = 'viture';
    else this.driverSelect.value = 'mock';

    this.driverSelect.addEventListener('change', async (e) => {
      const driverName = (e.target as HTMLSelectElement).value;
      const success = await this.deviceManager.switchDriver(driverName);
      
      if (!success) {
        // Revert to mock if failed
        this.driverSelect!.value = 'mock';
        alert(`Failed to connect to ${driverName === 'viture' ? 'VITURE AR' : 'Phone IMU'}. Ensure permissions are granted or device is supported.`);
      }
      this.updateStatusBadge();
    });

    const slerpSlider = document.getElementById('slerp-slider') as HTMLInputElement;
    const slerpVal = document.getElementById('slerp-val') as HTMLSpanElement;
    slerpSlider.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      slerpVal.innerText = `${val}%`;
      this.scene.setDamping(val / 100);
    });
  }

  private updateStatusBadge() {
    if (!this.statusBadge) return;
    
    const driver = this.deviceManager.getCurrentDriver();
    const driverName = driver.getDriverName();
    const isConnected = driver.isConnected();

    if (driverName === 'MockTelemetryDriver') {
      this.statusBadge.innerText = 'SIMULATING (MOCK)';
      this.statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-yellow-900/50 border border-yellow-700 text-yellow-400';
    } else if (driverName === 'PhoneOrientationDriver' && isConnected) {
      this.statusBadge.innerText = 'CONNECTED [PHONE IMU]';
      this.statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-blue-900/50 border border-blue-700 text-blue-400';
    } else if (driverName === 'VitureWebHIDDriver' && isConnected) {
      this.statusBadge.innerText = 'CONNECTED [VITURE 0x35CA]';
      this.statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-green-900/50 border border-green-700 text-green-400';
    } else {
      this.statusBadge.innerText = 'DISCONNECTED';
      this.statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-red-900/50 border border-red-700 text-red-400';
    }
  }
}
