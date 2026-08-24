import { useEffect, useState } from "react";
import type { Device, EditorDocument } from "../types";
import { frameOf } from "../geometry";

const MOBILE_MAX = 767;
const TABLET_MAX = 1100;

function layoutViewportWidth(): number {
  if (typeof window === "undefined") return 1440;
  const rootWidth = document.documentElement?.clientWidth || 0;
  const innerWidth = window.innerWidth || 0;
  const width = rootWidth > 0 && innerWidth > 0 ? Math.min(rootWidth, innerWidth) : Math.max(rootWidth, innerWidth);
  return Math.max(320, Math.round(width || 1440));
}

function deviceForWidth(width: number): Device {
  if (width <= MOBILE_MAX) return "mobile";
  if (width <= TABLET_MAX) return "tablet";
  return "desktop";
}

function PublicNode({
  doc,
  id,
  device,
  horizontalScale,
}: {
  doc: EditorDocument;
  id: string;
  device: Device;
  horizontalScale: number;
}) {
  const node = doc.nodes[id];
  if (!node || !node.visible) return null;
  const sourceFrame = frameOf(node, device);
  const frame = {
    ...sourceFrame,
    x: sourceFrame.x * horizontalScale,
    width: sourceFrame.width * horizontalScale,
  };
  const styles = node.styles;
  const props = node.props;
  const actionSegmentId = String(props["actionSegmentId"] ?? "").trim();
  const commercialAction = props["actionType"] === "commercial-segment" && Boolean(actionSegmentId);
  const commercialHref = commercialAction
    ? String(props["href"] || `/catalogo?segment=${encodeURIComponent(actionSegmentId)}`)
    : "";

  const common: React.CSSProperties = {
    position: "absolute",
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: frame.height,
    opacity: node.opacity,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    background: typeof styles["background"] === "string" ? styles["background"] : undefined,
    borderRadius: Number(styles["radius"] ?? 0) || undefined,
    overflow: styles["clip"] ? "hidden" : undefined,
    zIndex: node.zIndex,
    cursor: commercialAction ? "pointer" : undefined,
    minWidth: 0,
    maxWidth: "100%",
  };

  let inner: React.ReactNode = null;
  if (["text", "heading", "paragraph", "productName", "productBrand", "productPrice"].includes(node.type)) {
    inner = (
      <div
        style={{
          fontSize: Number(styles["fontSize"] ?? 16),
          fontWeight: Number(styles["fontWeight"] ?? 400),
          color: String(styles["color"] ?? "#0f172a"),
          textAlign: (styles["textAlign"] as React.CSSProperties["textAlign"]) ?? "left",
          lineHeight: Number(styles["lineHeight"] ?? 1.3),
          overflowWrap: "anywhere",
        }}
      >
        {String(props["text"] ?? "")}
      </div>
    );
  } else if (["button", "productButton"].includes(node.type)) {
    inner = (
      <a
        href={String(props["href"] ?? "#")}
        style={{
          display: "grid",
          placeItems: "center",
          width: "100%",
          height: "100%",
          background: String(styles["background"] ?? "#1f6feb"),
          color: String(styles["color"] ?? "#fff"),
          borderRadius: Number(styles["radius"] ?? 10),
          fontSize: Number(styles["fontSize"] ?? 15),
          fontWeight: Number(styles["fontWeight"] ?? 600),
          textDecoration: "none",
          textAlign: "center",
          overflowWrap: "anywhere",
        }}
      >
        {String(props["label"] ?? "Botão")}
      </a>
    );
  } else if (["image", "productImage"].includes(node.type)) {
    const src = String(props["src"] ?? "");
    inner = src ? (
      <img
        src={src}
        alt={node.name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: (props["fit"] as React.CSSProperties["objectFit"]) ?? "contain",
          borderRadius: Number(styles["radius"] ?? 0),
        }}
      />
    ) : null;
  } else if (node.type === "video") {
    const src = String(props["src"] ?? "");
    inner = src ? (
      <video
        src={src}
        controls
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    ) : null;
  } else if (["banner", "hero"].includes(node.type)) {
    const src = String(props["src"] ?? "");
    inner = (
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {src ? (
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : null}
        <div
          style={{
            position: "absolute",
            left: 24,
            bottom: 24,
            maxWidth: "calc(100% - 48px)",
            color: String(styles["color"] ?? "#fff"),
            fontSize: 28,
            fontWeight: 700,
            overflowWrap: "anywhere",
          }}
        >
          {String(props["title"] ?? "")}
        </div>
      </div>
    );
  } else if (node.type === "carousel") {
    const images = (props["images"] as string[] | undefined) ?? [];
    inner = images[0] ? (
      <img src={images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    ) : null;
  } else if (node.type === "promotion") {
    inner = (
      <div style={{ padding: 18, overflowWrap: "anywhere" }}>
        <b>{String(props["title"] ?? "Promoção")}</b>
        <br />
        <a href={String(props["href"] ?? "#promocoes")}>{String(props["label"] ?? "Ver promoção")}</a>
      </div>
    );
  }

  const navigateCommercial = commercialAction && !["button", "productButton"].includes(node.type)
    ? () => { window.location.assign(commercialHref); }
    : undefined;

  return (
    <div
      style={common}
      data-commercial-segment-action={commercialAction ? actionSegmentId : undefined}
      role={commercialAction && !["button", "productButton"].includes(node.type) ? "link" : undefined}
      tabIndex={commercialAction && !["button", "productButton"].includes(node.type) ? 0 : undefined}
      onClick={navigateCommercial}
      onKeyDown={commercialAction && !["button", "productButton"].includes(node.type)
        ? (event) => { if (event.key === "Enter" || event.key === " ") window.location.assign(commercialHref); }
        : undefined}
    >
      {inner}
      {node.children.map((childId) => (
        <PublicNode
          key={childId}
          doc={doc}
          id={childId}
          device={device}
          horizontalScale={horizontalScale}
        />
      ))}
    </div>
  );
}

export function PublishedDocument({ doc }: { doc: EditorDocument }) {
  const [viewportWidth, setViewportWidth] = useState(layoutViewportWidth);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setViewportWidth(layoutViewportWidth());
      });
    };

    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    window.visualViewport?.addEventListener("resize", update, { passive: true });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  const root = doc.nodes[doc.rootId];
  if (!root) return null;

  const device = deviceForWidth(viewportWidth);
  const frame = frameOf(root, device);
  const designWidth = Math.max(1, Number(frame.width) || viewportWidth);
  const horizontalScale = Math.max(0.25, Math.min(4, viewportWidth / designWidth));
  const minHeight = Math.max(1, Number(frame.height) || 1);

  return (
    <div
      data-asteryon-published-document="true"
      data-asteryon-published-device={device}
      data-asteryon-published-viewport={viewportWidth}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        minHeight,
        background: String(root.styles["background"] ?? "#fff"),
        overflowX: "clip",
        overflowY: "visible",
      }}
    >
      {root.children.map((childId) => (
        <PublicNode
          key={childId}
          doc={doc}
          id={childId}
          device={device}
          horizontalScale={horizontalScale}
        />
      ))}
    </div>
  );
}
