declare class Camera {}
declare class PerspectiveCamera extends Camera {}
declare class OrthographicCamera extends Camera {}
declare class Vector3 { constructor(...args: any[]); [key: string]: any; x: number; y: number; z: number; }
declare class Ray { constructor(...args: any[]); [key: string]: any; }
declare class Plane { constructor(...args: any[]); [key: string]: any; }

declare module 'three' {
  export { Camera, PerspectiveCamera, OrthographicCamera, Vector3, Ray, Plane };
}
