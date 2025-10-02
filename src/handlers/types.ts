export type HandlerAxes = {
  pan?: boolean;
  zoom?: boolean;
  rotate?: boolean; // bearing/yaw
  pitch?: boolean;
  roll?: boolean;
};

export type HandlerDelta = {
  axes: HandlerAxes;
  originalEvent?: Event;
};

