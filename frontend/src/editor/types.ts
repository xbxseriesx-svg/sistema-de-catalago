/**
 * ASTERYON — modelo recuperado do editor V5.
 * Esta fonte ainda está em migração para o frontend Enterprise oficial.
 */

export type Device = "desktop" | "tablet" | "mobile";
export type ResolutionPreset = "1366x768" | "1440x900" | "1080p" | "2k" | "4k";
export type Frame = { x: number; y: number; width: number; height: number };

export type NodeType =
  | "page" | "frame" | "container" | "row" | "column" | "section" | "group"
  | "text" | "heading" | "paragraph" | "button"
  | "image" | "gallery" | "video"
  | "search" | "menu" | "breadcrumb" | "header" | "footer"
  | "banner" | "hero" | "carousel" | "promotion"
  | "product" | "productImage" | "productName" | "productBrand" | "productPrice" | "productButton"
  | "category" | "brand" | "distribution" | "showcase" | "smartShowcase" | "html" | "embed";

export interface EditorNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  /** Geometria base = Desktop. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  responsive: Record<Device, Frame>;
  styles: Record<string, unknown>;
  props: Record<string, unknown>;
  children: string[];
}

export interface EditorDocument { rootId: string; nodes: Record<string, EditorNode> }
export type EditorMode = "beginner" | "pro";
export interface Guide { axis: "x" | "y"; position: number; start: number; end: number; kind: "edge" | "center" | "canvas" }

export const RESOLUTION_PRESETS: Record<ResolutionPreset, { width: number; height: number; label: string }> = {
  "1366x768": { width: 1366, height: 768, label: "HD 1366×768" },
  "1440x900": { width: 1440, height: 900, label: "Desktop 1440×900" },
  "1080p": { width: 1920, height: 1080, label: "1080p / Full HD" },
  "2k": { width: 2560, height: 1440, label: "2K / QHD" },
  "4k": { width: 3840, height: 2160, label: "4K / UHD" },
};

export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1920, tablet: 768, mobile: 390 };
