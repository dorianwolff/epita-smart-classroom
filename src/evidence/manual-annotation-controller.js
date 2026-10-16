import { createEvidence } from "./evidence-schema.js";
import { movePolygonHandle, normalizePoint, rectangleFromDrag, rectangleToPolygon } from "./annotation-geometry.js";

const HANDLE_RADIUS = 22;

export class ManualAnnotationController {
  constructor({ canvas, sourceSize, onCreate, onUpdate }) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.sourceSize = sourceSize;
    this.onCreate = onCreate;
    this.onUpdate = onUpdate;
    this.evidence = [];
    this.mode = null;
    this.label = "whiteboard";
    this.startPoint = null;
    this.previewPoint = null;
    this.polygon = [];
    this.dragging = null;
  }

  start() {
    this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
  }

  begin(mode, label) {
    this.mode = mode;
    this.label = label;
    this.startPoint = null;
    this.polygon = [];
    this.canvas.dataset.drawing = "true";
    this.render();
  }

  cancel() { this.mode = null; this.startPoint = null; this.polygon = []; delete this.canvas.dataset.drawing; this.render(); }

  setEvidence(evidence) { this.evidence = evidence; this.render(); }

  point(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * this.canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * this.canvas.height / bounds.height };
  }

  pointerDown(event) {
    const point = this.point(event);
    if (this.mode === "rectangle") { this.startPoint = point; this.previewPoint = point; this.canvas.setPointerCapture(event.pointerId); return; }
    if (this.mode === "polygon") {
      const size = this.sourceSize();
      this.polygon.push(normalizePoint(point, size.width, size.height));
      if (this.polygon.length === 4) this.commitPolygon(this.polygon);
      this.render();
      return;
    }
    const handle = this.findHandle(point);
    if (handle) { this.dragging = handle; this.canvas.setPointerCapture(event.pointerId); }
  }

  pointerMove(event) {
    const point = this.point(event);
    if (this.startPoint) { this.previewPoint = point; this.render(); }
    if (this.dragging) {
      const size = this.sourceSize();
      const polygon = movePolygonHandle(this.dragging.evidence.polygon, this.dragging.index, point, size.width, size.height);
      const updated = createEvidence({ ...this.dragging.evidence, polygon });
      this.dragging.evidence = updated;
      this.onUpdate(updated);
    }
  }

  pointerUp(event) {
    if (this.startPoint) {
      const size = this.sourceSize();
      const box = rectangleFromDrag(this.startPoint, this.point(event), size.width, size.height);
      if (box.width > 0.02 && box.height > 0.02) this.commitPolygon(rectangleToPolygon(box));
    }
    this.startPoint = null;
    this.previewPoint = null;
    this.dragging = null;
    this.render();
  }

  commitPolygon(polygon) {
    this.onCreate(createEvidence({ evidenceType: "manual", status: "confirmed", label: this.label,
      sourceModel: "manual-annotation", score: null, mask: null, box: null, polygon,
      explanation: "Confirmé manuellement sur l’image figée.", canAffectAudit: true }));
    this.cancel();
  }

  findHandle(point) {
    const size = this.sourceSize();
    for (const evidence of this.evidence.filter((item) => item.status === "confirmed" && item.polygon)) {
      for (let index = 0; index < evidence.polygon.length; index += 1) {
        const handle = evidence.polygon[index];
        if (Math.hypot(handle.x * size.width - point.x, handle.y * size.height - point.y) <= HANDLE_RADIUS) return { evidence, index };
      }
    }
    return null;
  }

  render() {
    const { width, height } = this.canvas;
    this.context.clearRect(0, 0, width, height);
    this.context.lineWidth = Math.max(3, width / 300);
    this.evidence.filter((item) => item.status !== "rejected").forEach((item) => {
      const polygon = item.polygon ?? (item.box ? rectangleToPolygon(item.box) : null);
      if (polygon) this.drawPolygon(polygon, item.status === "confirmed" ? "#22c55e" : "#f59e0b", item.status === "confirmed");
    });
    if (this.startPoint && this.previewPoint) {
      const size = this.sourceSize();
      this.drawPolygon(rectangleToPolygon(rectangleFromDrag(this.startPoint, this.previewPoint, size.width, size.height)), "#5eead4", false);
    }
    if (this.polygon.length) this.drawPolygon(this.polygon, "#5eead4", false, false);
  }

  drawPolygon(polygon, color, handles, close = true) {
    const size = this.sourceSize();
    this.context.beginPath();
    polygon.forEach((point, index) => {
      const x = point.x * size.width; const y = point.y * size.height;
      if (!index) this.context.moveTo(x, y); else this.context.lineTo(x, y);
    });
    if (close) this.context.closePath();
    this.context.strokeStyle = color;
    this.context.fillStyle = `${color}22`;
    if (close) this.context.fill();
    this.context.stroke();
    if (handles) polygon.forEach((point) => {
      this.context.beginPath();
      this.context.arc(point.x * size.width, point.y * size.height, Math.max(8, size.width / 100), 0, Math.PI * 2);
      this.context.fillStyle = color;
      this.context.fill();
    });
  }
}
