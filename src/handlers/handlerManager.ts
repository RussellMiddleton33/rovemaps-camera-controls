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
  // Auto-apply touch-friendly defaults on touch-capable devices (does not override explicit options)
  autoTouchProfile?: boolean; // default: true

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
    // Mouse bindings depend on rightButtonPan mode:
    // - Default (rightButtonPan = false): left pans, right rotates/pitches
    // - Swapped  (rightButtonPan = true): right pans, left rotates/pitches
    if (options?.rightButtonPan) {
      // Right button pans
      const basePanSecondary: any = {
        onChange: options?.onChange,
        rubberbandStrength: options?.rubberbandStrength,
        ...(typeof mpOpts === 'object' ? mpOpts : {}),
        button: 2,
      };
      if (options?.inertiaPanFriction != null) basePanSecondary.inertiaPanFriction = options.inertiaPanFriction;
      this.mousePanSecondary = new MousePanHandler(this.el, this.transform, this.helper, basePanSecondary);
      this.mousePanSecondary.enable();
      // Left button rotates/pitches
      const mrpOpts = options?.mouseRotatePitch ?? {};
      const mrpBase: any = {
        onChange: options?.onChange,
        rotateButton: 0,
        ...(typeof mrpOpts === 'object' ? mrpOpts : {}),
      };
      if (options?.anchorTightness != null) mrpBase.anchorTightness = options.anchorTightness;
      this.mouseRotatePitch = new MouseRotatePitchHandler(this.el, this.transform, this.helper, mrpBase);
      this.mouseRotatePitch.enable();
      // Do NOT create the default left-button pan in this mode
    } else {
      // Default: left pans
      this.mousePan = new MousePanHandler(this.el, this.transform, this.helper, basePan);
      this.mousePan.enable();
      // Right button rotates/pitches
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
    // Auto touch profile: apply conservative thresholds on touch devices unless explicitly provided
    const autoTouch = options?.autoTouchProfile !== false; // default true
    const isTouch = typeof window !== 'undefined' && (("ontouchstart" in window) || (navigator.maxTouchPoints > 0));
    if (autoTouch && isTouch) {
      if (touchBase.rotateThresholdDeg == null) touchBase.rotateThresholdDeg = 0.5;
      if (touchBase.pitchThresholdPx == null) touchBase.pitchThresholdPx = 12;
      if (touchBase.zoomThreshold == null) touchBase.zoomThreshold = 0.04;
    }
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
    // Desktop-only Safari gestures: enable when gesture events exist and the device is not touch-capable.
    const gestureSupported = typeof window !== 'undefined' && (('ongesturestart' in window) || (typeof (window as any).GestureEvent !== 'undefined'));
    const touchCapable = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    if (sg && gestureSupported && !touchCapable) {
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

  // Runtime control: enable/disable touch debug overlay
  setTouchDebugOverlay(enabled: boolean) {
    this.touch?.setShowDebugOverlay(enabled);
  }
}
