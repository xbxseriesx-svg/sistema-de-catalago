export {};

declare global {
  interface DOMStringMap {
    nodeId?: string;
  }

  interface Window {
    [key: string]: unknown;
  }
}
