import type { ITransform, Vec2 } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { on } from '../util/dom';
import type { HandlerDelta } from './types';

export interface DblclickOptions {
  zoomDelta?: number; // +/- zoom change
  invertWithShift?: boolean;
  around?: 'center' | 'pointer';
  preventDefault?: boolean;
  onChange?: (delta: HandlerDelta) => void;
  anchorTightness?: number; // 0..1
}

export class DblclickHandler {
  private el: HTMLElement;
  private transform: ITransform;
  private helper: ICameraHelper;
  private opts: Required<DblclickOptions>;
  private unbind: (() => void) | null = null;
  private lastTap: { t: number; x: number; y: number } | null = null;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: DblclickOptions) {
    this.el = el; this.transform = transform; this.helper = helper;
    this.opts = {
      zoomDelta: 1,
      invertWithShift: true,
      around: 'pointer',
      preventDefault: true,
      onChange: () => {},
      anchorTightness: 1,
      ...opts,
    };
  }

  enable() {
    if (typeof window === 'undefined' || this.unbind) return;
    const offDbl = on(this.el, 'dblclick', this.onDblClick as any, { passive: !this.opts.preventDefault });
    // double-tap fallback via pointer events
    const offDown = on(this.el, 'pointerdown', this.onPointerDown as any, { passive: true });
    this.unbind = () => { offDbl(); offDown(); };
  }

  destroy() {
    this.unbind?.();
    this.unbind = null;
  }

  private onDblClick = (e: MouseEvent) => {
    if (this.opts.preventDefault) e.preventDefault();
    const rect = this.el.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const dz = this.getZoomDelta(e.shiftKey);
    this.applyZoomAround(dz, this.opts.around === 'pointer' ? pointer : null);
    this.opts.onChange({ axes: { zoom: true }, originalEvent: e });
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const now = performance.now();
    const rect = this.el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const prev = this.lastTap;
    this.lastTap = { t: now, x, y };
    if (prev && now - prev.t < 300 && Math.hypot(x - prev.x, y - prev.y) < 25) {
      // double tap
      const dz = this.getZoomDelta(false);
      this.applyZoomAround(dz, { x, y });
      this.opts.onChange({ axes: { zoom: true }, originalEvent: e });
      this.lastTap = null;
    }
  };

  private getZoomDelta(shift: boolean) {
    let dz = this.opts.zoomDelta;
    if (this.opts.invertWithShift && shift) dz = -dz;
    return dz;
  }

  private applyZoomAround(dz: number, pointer: Vec2 | null) {
    if (!pointer) {
      this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, 'center');
      return;
    }
    const groundBefore = this.transform.groundFromScreen(pointer);
    this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, 'center');
    if (!groundBefore) return;
    const groundAfter = this.transform.groundFromScreen(pointer);
    if (!groundAfter) return;
    const tight = Math.max(0, Math.min(1, this.opts.anchorTightness ?? 1));
    const dgx = (groundBefore.gx - groundAfter.gx) * tight;
    const dgz = (groundBefore.gz - groundAfter.gz) * tight;
    this.transform.adjustCenterByGroundDelta(dgx, dgz);
  }
}
