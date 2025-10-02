import React, { useEffect, useRef } from 'react';
import { createControllerForNext } from '../../src';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    controllerRef.current = createControllerForNext(() => ({
      // @ts-expect-error three camera stub for example only
      camera: {} as any,
      domElement: canvasRef.current!,
      width: canvasRef.current!.clientWidth,
      height: canvasRef.current!.clientHeight,
    }));
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        controllerRef.current?.setViewport({ width: cr.width, height: cr.height, devicePixelRatio: window.devicePixelRatio });
      }
    });
    ro.observe(canvasRef.current);
    return () => {
      ro.disconnect();
      controllerRef.current?.dispose();
    };
  }, []);

  return (
    <div style={{ height: '100vh' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

