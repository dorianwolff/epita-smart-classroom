import { createCameraService } from "./services/camera-service.js";
import { AudioController } from "./audio/audio-controller.js";
import { createModelService } from "./services/model-service.js";
import { createStore } from "./state/store.js";
import { UiController } from "./ui/ui-controller.js";
import { getElement } from "./utils/dom.js";
import { safeLog } from "./utils/errors.js";

function showFatalError(error) {
  safeLog("bootstrap", error);
  const panel = getElement("#app-error");
  getElement("#error-title").textContent = "Initialisation impossible";
  getElement("#error-message").textContent = "L’application n’a pas pu démarrer. Rechargez la page dans un navigateur récent.";
  panel.hidden = false;
}

function bootstrap() {
  try {
    const store = createStore();
    const audioController = new AudioController({ store });
    const controller = new UiController({
      store,
      modelService: createModelService(),
      cameraService: createCameraService(),
      audioController
    });
    audioController.start();
    controller.start();
  } catch (error) {
    showFatalError(error);
  }
}

bootstrap();
