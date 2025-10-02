import type { ITransform } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { on } from '../util/dom';
import type { HandlerDelta } from './types';

export interface MouseRotatePitchOptions {
  rotateButton?: number; // 2 = right button
  pitchModifier?: 'shift' | 'alt';
  sensitivity?: { rotatePerPx?: number; pitchPerPx?: number };
  onChange?: (delta: HandlerDelta) => void;
  around?: 'center' | 'pointer';
}

export class MouseRotatePitchHandler {
  private el: HTMLElement;
  private transform: ITransform;
  private helper: ICameraHelper;
  private opts: Required<MouseRotatePitchOptions>;
  private unbindDown: (() => void) | null = null;
  private unbindMoveUp: (() => void) | null = null;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: MouseRotatePitchOptions) {
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      rotateButton: 2,
      pitchModifier: 'shift',
      sensitivity: { rotatePerPx: 0.25, pitchPerPx: 0.25 },
      onChange: () => {},
      around: 'center',
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
    const isRotateBtn = e.button === this.opts.rotateButton;
    const wantsPitch = (this.opts.pitchModifier === 'shift' && e.shiftKey) || (this.opts.pitchModifier === 'alt' && (e.altKey || e.metaKey));
    if (!isRotateBtn && !wantsPitch) return;
    this.el.setPointerCapture?.(e.pointerId);
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const offMove = on(window, 'pointermove', this.onMove as any, { passive: false });
    const offUp = on(window, 'pointerup', this.onUp as any, { passive: true });
    this.unbindMoveUp = () => { offMove(); offUp(); };
  };

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    // Prevent contextmenu/selection while rotating or pitching
    e.preventDefault();

    const aroundPointer = this.opts.around === 'pointer';
    const rect = this.el.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const wantsPitch = (this.opts.pitchModifier === 'shift' && e.shiftKey) || (this.opts.pitchModifier === 'alt' && (e.altKey || e.metaKey));
    if (wantsPitch) {
      const dp = -dy * (this.opts.sensitivity.pitchPerPx / 1.0);
      if (aroundPointer) {
        const world = this.transform.screenToWorld(pointer);
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dp, 0, 0, 'center');
        if (world) {
          const sp = this.transform.worldToScreen(world);
          if (sp) {
            const cdx = sp.x - pointer.x; const cdy = sp.y - pointer.y;
            this.helper.handleMapControlsPan(this.transform, cdx, cdy);
          }
        }
      } else {
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dp, 0, 0, 'center');
      }
      this.opts.onChange({ axes: { pitch: true }, originalEvent: e });
    } else {
      const db = dx * (this.opts.sensitivity.rotatePerPx / 1.0);
      if (aroundPointer) {
        const world = this.transform.screenToWorld(pointer);
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, db, 0, 'center');
        if (world) {
          const sp = this.transform.worldToScreen(world);
          if (sp) {
            const cdx = sp.x - pointer.x; const cdy = sp.y - pointer.y;
            this.helper.handleMapControlsPan(this.transform, cdx, cdy);
          }
        }
      } else {
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, db, 0, 'center');
      }
      this.opts.onChange({ axes: { rotate: true }, originalEvent: e });
    }
  };

  private onUp = (_e: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    this.unbindMoveUp?.();
    this.unbindMoveUp = null;
  };
}
