import type { ITransform } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { ScrollZoomHandler, type ScrollZoomOptions } from './scrollZoomHandler';
import type { HandlerDelta } from './types';
import { MousePanHandler } from './mousePanHandler';
import { MouseRotatePitchHandler } from './mouseRotatePitchHandler';
import { TouchMultiHandler, type TouchMultiOptions } from './touchMultiHandler';
import { KeyboardHandler, type KeyboardOptions } from './keyboardHandler';
import { DblclickHandler, type DblclickOptions } from './dblclickHandler';
import { BoxZoomHandler, type BoxZoomOptions } from './boxZoomHandler';

export interface HandlerManagerOptions {
  scrollZoom?: ScrollZoomOptions | boolean;
  onChange?: (delta: HandlerDelta) => void;
  touch?: TouchMultiOptions | boolean;
  rubberbandStrength?: number;
  keyboard?: KeyboardOptions | boolean;
  dblclick?: DblclickOptions | boolean;
  boxZoom?: BoxZoomOptions | boolean;
  suppressContextMenu?: boolean;
}

export class HandlerManager {
  private readonly el: HTMLElement;
  private readonly transform: ITransform;
  private readonly helper: ICameraHelper;
  private scroll?: ScrollZoomHandler;
  private mousePan?: MousePanHandler;
  private mouseRotatePitch?: MouseRotatePitchHandler;
  private touch?: TouchMultiHandler;
  private keyboard?: KeyboardHandler;
  private dblclick?: DblclickHandler;
  private boxZoom?: BoxZoomHandler;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, options?: HandlerManagerOptions) {
    this.el = el;
    this.transform = transform;
    this.helper = helper;

    if (options?.suppressContextMenu ?? true) {
      this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    const scrollOpts = options?.scrollZoom;
    if (scrollOpts) {
      this.scroll = new ScrollZoomHandler(
        this.el,
        this.transform,
        this.helper,
        { ...(typeof scrollOpts === 'object' ? scrollOpts : {}), onChange: options?.onChange }
      );
      this.scroll.enable();
    }
    // Mouse handlers (defaults enabled)
    this.mousePan = new MousePanHandler(this.el, this.transform, this.helper, {
      onChange: options?.onChange,
      rubberbandStrength: options?.rubberbandStrength,
    });
    this.mousePan.enable();
    this.mouseRotatePitch = new MouseRotatePitchHandler(this.el, this.transform, this.helper, {
      onChange: options?.onChange,
    });
    this.mouseRotatePitch.enable();
    // Touch handler (default enabled)
    const touchOpts = options?.touch ?? {};
    this.touch = new TouchMultiHandler(
      this.el,
      this.transform,
      this.helper,
      typeof touchOpts === 'object' ? { rubberbandStrength: options?.rubberbandStrength, ...touchOpts } : { onChange: options?.onChange, rubberbandStrength: options?.rubberbandStrength }
    );
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
  }

  dispose() {
    this.scroll?.destroy();
    this.mousePan?.destroy();
    this.mouseRotatePitch?.destroy();
    this.touch?.destroy();
    this.keyboard?.destroy();
    this.dblclick?.destroy();
    this.boxZoom?.destroy();
  }
}
