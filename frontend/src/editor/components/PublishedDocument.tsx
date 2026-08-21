import { useEffect, useState } from "react";
import type { Device, EditorDocument } from "../types";
import { frameOf } from "../geometry";

function currentDevice(): Device {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth <= 640) return "mobile";
  if (window.innerWidth <= 1024) return "tablet";
  return "desktop";
}

function PublicNode({ doc, id, device }: { doc: EditorDocument; id: string; device: Device }) {
  const node = doc.nodes[id];
  if (!node || !node.visible) return null;
  const frame = frameOf(node, device);
  const styles = node.styles;
  const props = node.props;

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
            color: String(styles["color"] ?? "#fff"),
            fontSize: 28,
            fontWeight: 700,
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
      <div style={{ padding: 18 }}>
        <b>{String(props["title"] ?? "Promoção")}</b>
        <br />
        <a href={String(props["href"] ?? "#promocoes")}>{String(props["label"] ?? "Ver promoção")}</a>
      </div>
    );
  }

  return (
    <div style={common}>
      {inner}
      {node.children.map((childId) => (
        <PublicNode key={childId} doc={doc} id={childId} device={device} />
      ))}
    </div>
  );
}

export function PublishedDocument({ doc }: { doc: EditorDocument }) {
  const [device, setDevice] = useState<Device>(currentDevice);
  useEffect(() => {
    const update = () => setDevice(currentDevice());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const root = doc.nodes[doc.rootId];
  if (!root) return null;
  const frame = frameOf(root, device);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: frame.height,
        background: String(root.styles["background"] ?? "#fff"),
        overflow: "hidden",
      }}
    >
      {root.children.map((childId) => (
        <PublicNode key={childId} doc={doc} id={childId} device={device} />
      ))}
    </div>
  );
}
