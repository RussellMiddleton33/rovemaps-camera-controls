import type { ITransform, Vec2 } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { on } from '../util/dom';
import type { HandlerDelta } from './types';

export interface BoxZoomOptions {
  triggerModifier?: 'shift';
  minAreaPx?: number;
  preventDefault?: boolean;
  onChange?: (delta: HandlerDelta) => void;
}

export class BoxZoomHandler {
  private el: HTMLElement;
  private transform: ITransform;
  private helper: ICameraHelper;
  private opts: Required<BoxZoomOptions>;
  private unbindDown: (() => void) | null = null;
  private unbindMoveUp: (() => void) | null = null;
  private startPt: Vec2 | null = null;
  private curPt: Vec2 | null = null;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: BoxZoomOptions) {
    this.el = el; this.transform = transform; this.helper = helper;
    this.opts = {
      triggerModifier: 'shift',
      minAreaPx: 64,
      preventDefault: true,
      onChange: () => {},
      ...opts,
    };
  }

  enable() {
    if (typeof window === 'undefined' || this.unbindDown) return;
    this.unbindDown = on(this.el, 'pointerdown', this.onDown as any, { passive: true });
  }

  destroy() {
    this.unbindDown?.();
    this.unbindDown = null;
    if (this.unbindMoveUp) { this.unbindMoveUp(); this.unbindMoveUp = null; }
  }

  private onDown = (e: PointerEvent) => {
    const wants = this.opts.triggerModifier === 'shift' ? e.shiftKey : false;
    if (!wants || e.button !== 0) return;
    const rect = this.el.getBoundingClientRect();
    this.startPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.curPt = { ...this.startPt };
    const offMove = on(window, 'pointermove', this.onMove as any, { passive: false });
    const offUp = on(window, 'pointerup', this.onUp as any, { passive: true });
    this.unbindMoveUp = () => { offMove(); offUp(); };
  };

  private onMove = (e: PointerEvent) => {
    if (!this.startPt) return;
    if (this.opts.preventDefault) e.preventDefault();
    const rect = this.el.getBoundingClientRect();
    this.curPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  private onUp = (_e: PointerEvent) => {
    if (!this.startPt || !this.curPt) return this.cleanup();
    const minX = Math.min(this.startPt.x, this.curPt.x);
    const minY = Math.min(this.startPt.y, this.curPt.y);
    const maxX = Math.max(this.startPt.x, this.curPt.x);
    const maxY = Math.max(this.startPt.y, this.curPt.y);
    const area = (maxX - minX) * (maxY - minY);
    if (area >= this.opts.minAreaPx) {
      // Project to world and fit
      const pMin = { x: minX, y: minY };
      const pMax = { x: maxX, y: maxY };
      const wMin = this.transform.screenToWorld(pMin);
      const wMax = this.transform.screenToWorld(pMax);
      if (wMin && wMax) {
        const bounds = { min: { x: Math.min(wMin.x, wMax.x), y: Math.min(wMin.y, wMax.y) }, max: { x: Math.max(wMin.x, wMax.x), y: Math.max(wMin.y, wMax.y) } };
        const cam = this.helper.cameraForBoxAndBearing(this.transform, bounds);
        this.transform.setCenter(cam.center);
        this.transform.setZoom(cam.zoom);
        this.opts.onChange({ axes: { pan: true, zoom: true } });
      } else {
        // Fallback: estimate zoom by screen box size
        const scaleX = this.transform.width / (maxX - minX);
        const scaleY = this.transform.height / (maxY - minY);
        const zoomDelta = Math.log2(Math.min(scaleX, scaleY));
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, zoomDelta, 'center');
        const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
        const world = this.transform.screenToWorld({ x: cx, y: cy });
        if (world) {
          this.transform.setCenter({ x: world.x, y: world.y, z: this.transform.center.z });
        }
        this.opts.onChange({ axes: { pan: true, zoom: true } });
      }
    }
    this.cleanup();
  };

  private cleanup() {
    this.startPt = null; this.curPt = null;
    if (this.unbindMoveUp) { this.unbindMoveUp(); this.unbindMoveUp = null; }
  }
}

