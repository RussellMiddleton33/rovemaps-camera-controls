"use client";
import React, { useEffect, useRef } from 'react';
import { createControllerForNext } from '../../src';

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctl = createControllerForNext(() => ({
      // @ts-expect-error stub camera
      camera: {} as any,
      domElement: canvasRef.current!,
      width: canvasRef.current!.clientWidth,
      height: canvasRef.current!.clientHeight,
    }));
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        // @ts-expect-error stub ctl
        ctl?.setViewport({ width: cr.width, height: cr.height, devicePixelRatio: window.devicePixelRatio });
      }
    });
    ro.observe(canvasRef.current);
    return () => {
      ro.disconnect();
      // @ts-expect-error stub ctl
      ctl?.dispose();
    };
  }, []);
  return <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }} />;
}

