import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

export type StockVideoProps = {
  src: string;
  background: string;
};

export const STOCK_FPS = 30;
export const STOCK_DURATION = 150;
export const STOCK_WIDTH = 1280;
export const STOCK_HEIGHT = 720;

export const StockVideo: React.FC<StockVideoProps> = ({ src, background }) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, 35, 120, 149], [0.72, 1, 1.04, 0.98], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [0, 20, 125, 149], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rotate = interpolate(frame, [0, 149], [-2, 2]);

  return (
    <AbsoluteFill
      style={{
        background,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Img
        src={src}
        style={{
          width: "72%",
          height: "72%",
          objectFit: "contain",
          transform: `scale(${scale}) rotate(${rotate}deg)`,
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};