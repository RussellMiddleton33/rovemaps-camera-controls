// Experimental: Safari gesturestart/gesturechange support for trackpad pinch/rotate
// Behind an option; not all browsers support these events.
import type { ITransform } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import type { HandlerDelta } from './types';
import { scaleZoom } from '../util/math';

export interface SafariGestureOptions {
  enabled?: boolean;
  around?: 'center' | 'pointer';
  onChange?: (delta: HandlerDelta) => void;
  rotateSign?: 1 | -1;
  zoomSign?: 1 | -1;
  anchorTightness?: number; // 0..1
}

export class SafariGestureHandler {
  private el: HTMLElement;
  private transform: ITransform;
  private helper: ICameraHelper;
  private opts: Required<SafariGestureOptions>;
  private bound = false;
  private startScale = 1;
  private startRotation = 0;
  private lastGround: { gx: number; gz: number } | null = null;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: SafariGestureOptions) {
    this.el = el; this.transform = transform; this.helper = helper;
    this.opts = { enabled: false, around: 'pointer', onChange: () => {}, rotateSign: 1, zoomSign: 1, anchorTightness: 1, ...(opts || {}) };
  }

  enable() {
    if (this.bound || !this.opts.enabled) return;
    this.bound = true;
    this.el.addEventListener('gesturestart', this.onStart as any, { passive: true } as any);
    this.el.addEventListener('gesturechange', this.onChange as any, { passive: false } as any);
    this.el.addEventListener('gestureend', this.onEnd as any, { passive: true } as any);
  }
  destroy() {
    if (!this.bound) return;
    this.el.removeEventListener('gesturestart', this.onStart as any);
    this.el.removeEventListener('gesturechange', this.onChange as any);
    this.el.removeEventListener('gestureend', this.onEnd as any);
    this.bound = false;
  }

  private onStart = (e: any) => {
    this.startScale = e.scale || 1;
    this.startRotation = e.rotation || 0;
    // Seed lastGround for translational pan while twisting
    const rect = this.el.getBoundingClientRect();
    const pointer = this.opts.around === 'pointer' ? { x: (e.clientX ?? rect.width / 2) - rect.left, y: (e.clientY ?? rect.height / 2) - rect.top } : null;
    this.lastGround = pointer ? this.transform.groundFromScreen(pointer) : null;
  };
  private onChange = (e: any) => {
    // Prevent page zoom default
    e.preventDefault?.();
    const rect = this.el.getBoundingClientRect();
    const pointer = this.opts.around === 'pointer' ? { x: (e.clientX ?? rect.width / 2) - rect.left, y: (e.clientY ?? rect.height / 2) - rect.top } : null;
    const scale = (e.scale || 1) / (this.startScale || 1);
    const dz = scaleZoom(scale) * (this.opts.zoomSign ?? 1);
    // WebKit's gesture rotation increases clockwise; apply directly with rotateSign
    const drot = ((e.rotation || 0) - (this.startRotation || 0)) * (this.opts.rotateSign ?? 1);
    // Translational pan to follow pointer movement across frames (grab feel)
    const gpNow = pointer ? this.transform.groundFromScreen(pointer) : null;
    if (gpNow && this.lastGround) {
      const tight = Math.max(0, Math.min(1, this.opts.anchorTightness ?? 1));
      const dgxMov = (this.lastGround.gx - gpNow.gx) * tight;
      const dgzMov = (this.lastGround.gz - gpNow.gz) * tight;
      this.transform.adjustCenterByGroundDelta(dgxMov, dgzMov);
    }
    // Apply zoom/rotate around pointer
    const gpBefore = pointer ? this.transform.groundFromScreen(pointer) : null;
    if (dz) this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, 'center');
    if (drot) this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, drot, 0, 'center');
    if (pointer && gpBefore) {
      const gpAfter = this.transform.groundFromScreen(pointer);
      if (gpAfter) {
        const tight = Math.max(0, Math.min(1, this.opts.anchorTightness ?? 1));
        this.transform.adjustCenterByGroundDelta((gpBefore.gx - gpAfter.gx) * tight, (gpBefore.gz - gpAfter.gz) * tight);
      }
    }
    // Update for next frame movement
    this.lastGround = gpNow;
    this.opts.onChange({ axes: { zoom: !!dz, rotate: !!drot } });
  };
  private onEnd = (_e: any) => { this.lastGround = null; };
}
