import type { ITransform } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { ScrollZoomHandler, type ScrollZoomOptions } from './scrollZoomHandler';
import type { HandlerDelta } from './types';
import { MousePanHandler, type MousePanOptions } from './mousePanHandler';
import { MouseRotatePitchHandler, type MouseRotatePitchOptions } from './mouseRotatePitchHandler';
import { TouchMultiHandler, type TouchMultiOptions } from './touchMultiHandler';
import { KeyboardHandler, type KeyboardOptions } from './keyboardHandler';
import { DblclickHandler, type DblclickOptions } from './dblclickHandler';
import { BoxZoomHandler, type BoxZoomOptions } from './boxZoomHandler';
import { SafariGestureHandler, type SafariGestureOptions } from './safariGestureHandler';

export interface HandlerManagerOptions {
  scrollZoom?: ScrollZoomOptions | boolean;
  onChange?: (delta: HandlerDelta) => void;
  touch?: TouchMultiOptions | boolean;
  rubberbandStrength?: number;
  mousePan?: MousePanOptions | boolean;
  mouseRotatePitch?: MouseRotatePitchOptions | boolean;
  keyboard?: KeyboardOptions | boolean;
  dblclick?: DblclickOptions | boolean;
  boxZoom?: BoxZoomOptions | boolean;
  suppressContextMenu?: boolean;
  safariGestures?: SafariGestureOptions | boolean;
  anchorTightness?: number; // global default for anchor-based corrections
  rightButtonPan?: boolean; // if true, right button pans instead of rotate/pitch

  // Inertia friction settings (higher = faster decay, less glide)
  inertiaPanFriction?: number; // friction for mouse/trackpad pan inertia (default: 6 for mouse, 12 for touch)
  inertiaZoomFriction?: number; // friction for zoom inertia (default: 20, effectively disabled)
  inertiaRotateFriction?: number; // friction for rotate/pitch inertia on touch (default: 12)
}

export class HandlerManager {
  private readonly el: HTMLElement;
  private readonly transform: ITransform;
  private readonly helper: ICameraHelper;
  private onCtx?: (e: Event) => void;
  private scroll?: ScrollZoomHandler;
  private mousePan?: MousePanHandler;
  private mousePanSecondary?: MousePanHandler;
  private mouseRotatePitch?: MouseRotatePitchHandler;
  private touch?: TouchMultiHandler;
  private keyboard?: KeyboardHandler;
  private dblclick?: DblclickHandler;
  private boxZoom?: BoxZoomHandler;
  private safariGestures?: SafariGestureHandler;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, options?: HandlerManagerOptions) {
    this.el = el;
    this.transform = transform;
    this.helper = helper;

    // Suppress native context menu to allow two-finger/right-drag rotate+pitch without interruption
    if (options?.suppressContextMenu ?? true) {
      this.onCtx = (e: Event) => e.preventDefault();
      this.el.addEventListener('contextmenu', this.onCtx, { capture: true } as any);
      window.addEventListener('contextmenu', this.onCtx as any, { capture: true } as any);
    }

    const scrollOpts = options?.scrollZoom;
    if (scrollOpts) {
      this.scroll = new ScrollZoomHandler(
        this.el,
        this.transform,
        this.helper,
        { anchorTightness: options?.anchorTightness, ...(typeof scrollOpts === 'object' ? scrollOpts : {}), onChange: options?.onChange }
      );
      this.scroll.enable();
    }
    // Mouse handlers (defaults enabled)
    const mpOpts = options?.mousePan ?? {};
    // Avoid passing undefined values that overwrite handler defaults
    const basePan: any = {
      onChange: options?.onChange,
      rubberbandStrength: options?.rubberbandStrength,
      ...(typeof mpOpts === 'object' ? mpOpts : {}),
    };
    if (options?.inertiaPanFriction != null) basePan.inertiaPanFriction = options.inertiaPanFriction;
    this.mousePan = new MousePanHandler(this.el, this.transform, this.helper, basePan);
    this.mousePan.enable();
    // Optional: right button pans instead of rotate/pitch
    if (options?.rightButtonPan) {
      const basePanSecondary: any = {
        onChange: options?.onChange,
        rubberbandStrength: options?.rubberbandStrength,
        ...(typeof mpOpts === 'object' ? mpOpts : {}),
        button: 2,
      };
      if (options?.inertiaPanFriction != null) basePanSecondary.inertiaPanFriction = options.inertiaPanFriction;
      this.mousePanSecondary = new MousePanHandler(this.el, this.transform, this.helper, basePanSecondary);
      this.mousePanSecondary.enable();
    } else {
      const mrpOpts = options?.mouseRotatePitch ?? {};
      const mrpBase: any = {
        onChange: options?.onChange,
        ...(typeof mrpOpts === 'object' ? mrpOpts : {}),
      };
      if (options?.anchorTightness != null) mrpBase.anchorTightness = options.anchorTightness;
      this.mouseRotatePitch = new MouseRotatePitchHandler(this.el, this.transform, this.helper, mrpBase);
      this.mouseRotatePitch.enable();
    }
    // Touch handler (default enabled)
    const touchOpts = options?.touch ?? {};
    const touchBase: any = typeof touchOpts === 'object' ? { ...touchOpts } : { onChange: options?.onChange };
    if (options?.anchorTightness != null) touchBase.anchorTightness = options.anchorTightness;
    if (options?.rubberbandStrength != null) touchBase.rubberbandStrength = options.rubberbandStrength;
    if (options?.inertiaPanFriction != null) touchBase.inertiaPanFriction = options.inertiaPanFriction;
    if (options?.inertiaZoomFriction != null) touchBase.inertiaZoomFriction = options.inertiaZoomFriction;
    if (options?.inertiaRotateFriction != null) touchBase.inertiaRotateFriction = options.inertiaRotateFriction;
    this.touch = new TouchMultiHandler(this.el, this.transform, this.helper, touchBase);
    this.touch.enable();
    // Keyboard handler (default enabled)
    const kbOpts = options?.keyboard ?? {};
    this.keyboard = new KeyboardHandler(
      this.el,
      this.transform,
      this.helper,
      typeof kbOpts === 'object' ? kbOpts : { onChange: options?.onChange }
    );
    this.keyboard.enable();
    // Dblclick handler (default enabled)
    const dblOpts = options?.dblclick ?? {};
    this.dblclick = new DblclickHandler(
      this.el,
      this.transform,
      this.helper,
      typeof dblOpts === 'object' ? dblOpts : { onChange: options?.onChange }
    );
    this.dblclick.enable();
    // Box zoom (default enabled)
    const boxOpts = options?.boxZoom ?? {};
    this.boxZoom = new BoxZoomHandler(
      this.el,
      this.transform,
      this.helper,
      typeof boxOpts === 'object' ? boxOpts : { onChange: options?.onChange }
    );
    this.boxZoom.enable();
    // Safari gesture handler (optional)
    const sg = options?.safariGestures ?? false;
    // Enable Safari gesture handler only on non-touch devices (desktop Safari trackpad),
    // to avoid conflicts with touch pinch/rotate on mobile.
    const touchCapable = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    if (sg && !touchCapable) {
      this.safariGestures = new SafariGestureHandler(
        this.el,
        this.transform,
        this.helper,
        typeof sg === 'object' ? { onChange: options?.onChange, anchorTightness: options?.anchorTightness, ...sg, enabled: true } : { enabled: true, onChange: options?.onChange, anchorTightness: options?.anchorTightness }
      );
      this.safariGestures.enable();
    }
  }

  dispose() {
    if (this.onCtx) {
      this.el.removeEventListener('contextmenu', this.onCtx as any, { capture: true } as any);
      window.removeEventListener('contextmenu', this.onCtx as any, { capture: true } as any);
      this.onCtx = undefined;
    }
    this.scroll?.destroy();
    this.mousePan?.destroy();
    this.mousePanSecondary?.destroy();
    this.mouseRotatePitch?.destroy();
    this.touch?.destroy();
    this.keyboard?.destroy();
    this.dblclick?.destroy();
    this.boxZoom?.destroy();
    this.safariGestures?.destroy();
  }
}
