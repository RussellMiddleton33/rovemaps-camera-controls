import type { ITransform } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { on } from '../util/dom';
import type { HandlerDelta } from './types';

export interface KeyboardOptions {
  panStepPx?: number;
  zoomDelta?: number; // per key press
  rotateStepDeg?: number;
  pitchStepDeg?: number;
  preventDefault?: boolean;
  onChange?: (delta: HandlerDelta) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return true;
  return false;
}

export class KeyboardHandler {
  private el: HTMLElement;
  private transform: ITransform;
  private helper: ICameraHelper;
  private opts: Required<KeyboardOptions>;
  private unbind: (() => void) | null = null;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: KeyboardOptions) {
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      panStepPx: 100,
      zoomDelta: 0.25,
      rotateStepDeg: 15,
      pitchStepDeg: 5,
      preventDefault: true,
      onChange: () => {},
      ...opts,
    };
  }

  enable() {
    if (typeof window === 'undefined' || this.unbind) return;
    const off = on(window, 'keydown', this.onKey as any, { passive: !this.opts.preventDefault });
    this.unbind = () => off();
  }

  destroy() {
    this.unbind?.();
    this.unbind = null;
  }

  private onKey = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) return;
    let handled = false;
    const axes: HandlerDelta['axes'] = {};
    const step = this.opts.panStepPx * (e.shiftKey ? 2 : 1);

    switch (e.key) {
      case 'ArrowUp':
        this.helper.handleMapControlsPan(this.transform, 0, -step);
        axes.pan = true; handled = true; break;
      case 'ArrowDown':
        this.helper.handleMapControlsPan(this.transform, 0, step);
        axes.pan = true; handled = true; break;
      case 'ArrowLeft':
        this.helper.handleMapControlsPan(this.transform, -step, 0);
        axes.pan = true; handled = true; break;
      case 'ArrowRight':
        this.helper.handleMapControlsPan(this.transform, step, 0);
        axes.pan = true; handled = true; break;
      case '+':
      case '=':
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, this.opts.zoomDelta, 'center');
        axes.zoom = true; handled = true; break;
      case '-':
      case '_':
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, -this.opts.zoomDelta, 'center');
        axes.zoom = true; handled = true; break;
      case 'q': case 'Q':
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, -this.opts.rotateStepDeg, 0, 'center');
        axes.rotate = true; handled = true; break;
      case 'e': case 'E':
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, this.opts.rotateStepDeg, 0, 'center');
        axes.rotate = true; handled = true; break;
      case 'PageUp':
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, this.opts.pitchStepDeg, 0, 0, 'center');
        axes.pitch = true; handled = true; break;
      case 'PageDown':
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, -this.opts.pitchStepDeg, 0, 0, 'center');
        axes.pitch = true; handled = true; break;
    }

    if (handled) {
      if (this.opts.preventDefault) e.preventDefault();
      this.opts.onChange({ axes, originalEvent: e });
    }
  };
}

