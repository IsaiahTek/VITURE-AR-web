import './style.css';
import { DeviceManager } from './core/DeviceManager';
import { SpatialScene } from './scene/SpatialScene';
import { UIManager } from './scene/UIManager';

async function bootstrap() {
  const appContainer = document.getElementById('app-container');
  if (!appContainer) throw new Error("App container not found");

  const deviceManager = new DeviceManager();
  
  await deviceManager.getCurrentDriver().connect();
  
  const scene = new SpatialScene(appContainer, deviceManager);
  
  new UIManager(deviceManager, scene);
}

bootstrap().catch(console.error);
