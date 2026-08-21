import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "../store";
import { NodeView } from "./NodeView";
import { absFrame, frameOf } from "../geometry";
import { computeSnap } from "../geometry";
import type { Frame, Guide } from "../types";

type Interaction =
  | { kind: "idle" }
  | {
      kind: "drag";
      startWorld: { x: number; y: number };
      frames: Record<string, Frame>;
    }
  | {
      kind: "resize";
      dir: string;
      startWorld: { x: number; y: number };
      frames: Record<string, Frame>;
    }
  | {
      kind: "rotate";
      id: string;
      center: { x: number; y: number };
      startAngle: number;
      startRotation: number;
    }
  | { kind: "marquee"; origin: { x: number; y: number } }
  | { kind: "pan"; origin: { x: number; y: number }; pan: { x: number; y: number } };

const HANDLES = [
  ["nw", 0, 0],
  ["n", 0.5, 0],
  ["ne", 1, 0],
  ["e", 1, 0.5],
  ["se", 1, 1],
  ["s", 0.5, 1],
  ["sw", 0, 1],
  ["w", 0, 0.5],
] as const;

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction>({ kind: "idle" });
  const [marquee, setMarquee] = useState<Frame | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  const {
    doc,
    device,
    zoom,
    pan,
    selection,
    preview,
    grid,
    snap,
    gridSize,
    setPan,
    setZoom,
    select,
    setSelection,
    setHover,
    setEditing,
    updateFrame,
    updateNode,
    commit,
  } = useEditor();

  const page = doc.nodes[doc.rootId]!;
  const pageFrame = frameOf(page, device);

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom],
  );

  // Non-passive wheel: zoom (ctrl / pinch) + pan.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    if (e.ctrlKey || e.metaKey) {
      const next = Math.min(4, Math.max(0.1, zoom * Math.exp(-dy * 0.002)));
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / zoom;
      setPan({ x: px - (px - pan.x) * k, y: py - (py - pan.y) * k });
      setZoom(next);
    } else {
      const dx = e.deltaX * (e.deltaMode === 1 ? 16 : 1);
      setPan({ x: pan.x - dx, y: pan.y - dy });
    }
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Center the page on first mount.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPan({ x: rect.width / 2 - (pageFrame.width * zoom) / 2, y: 64 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, pageFrame.width, pageFrame.height]);

  const siblingsFor = (ids: string[]): Frame[] => {
    const exclude = new Set(ids);
    return Object.values(doc.nodes)
      .filter((n) => n.id !== doc.rootId && !exclude.has(n.id) && n.visible)
      .map((n) => absFrame(doc, n.id, device));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (preview) return;
    const target = e.target as HTMLElement;
    const el = target.closest("[data-node-id]") as HTMLElement | null;
    const handle = target.closest("[data-handle]") as HTMLElement | null;
    const world = toWorld(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (e.button === 1 || e.altKey) {
      interaction.current = { kind: "pan", origin: { x: e.clientX, y: e.clientY }, pan };
      return;
    }

    if (handle) {
      const dir = handle.dataset["handle"]!;
      commit();
      if (dir === "rotate") {
        const id = selection[0];
        if (!id) return;
        const r = absFrame(doc, id, device);
        const center = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        interaction.current = {
          kind: "rotate",
          id,
          center,
          startAngle: Math.atan2(world.y - center.y, world.x - center.x),
          startRotation: doc.nodes[id]?.rotation ?? 0,
        };
      } else {
        const frames: Record<string, Frame> = {};
        for (const id of selection) {
          const n = doc.nodes[id];
          if (n) frames[id] = { ...frameOf(n, device) };
        }
        interaction.current = { kind: "resize", dir, startWorld: world, frames };
      }
      return;
    }

    if (!el) {
      setSelection([]);
      setEditing(null);
      interaction.current = { kind: "marquee", origin: world };
      setMarquee({ x: world.x, y: world.y, width: 0, height: 0 });
      return;
    }

    const id = el.dataset["nodeId"]!;
    const node = doc.nodes[id];
    if (!node || node.locked) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const nextSelection = additive
      ? selection.includes(id)
        ? selection.filter((x) => x !== id)
        : [...selection, id]
      : selection.includes(id)
        ? selection
        : [id];
    if (additive) setSelection(nextSelection);
    else if (!selection.includes(id)) select(id);

    commit();
    const frames: Record<string, Frame> = {};
    for (const sid of nextSelection) {
      const n = doc.nodes[sid];
      if (n && !n.locked) frames[sid] = { ...frameOf(n, device) };
    }
    interaction.current = { kind: "drag", startWorld: world, frames };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const it = interaction.current;
    if (it.kind === "idle") {
      const el = (e.target as HTMLElement).closest("[data-node-id]") as HTMLElement | null;
      setHover(el?.dataset["nodeId"] ?? null);
      return;
    }
    const world = toWorld(e.clientX, e.clientY);

    if (it.kind === "pan") {
      setPan({ x: it.pan.x + (e.clientX - it.origin.x), y: it.pan.y + (e.clientY - it.origin.y) });
      return;
    }

    if (it.kind === "marquee") {
      const rect: Frame = {
        x: Math.min(it.origin.x, world.x),
        y: Math.min(it.origin.y, world.y),
        width: Math.abs(world.x - it.origin.x),
        height: Math.abs(world.y - it.origin.y),
      };
      setMarquee(rect);
      const hits = Object.values(doc.nodes)
        .filter((n) => n.id !== doc.rootId && n.visible && !n.locked)
        .filter((n) => {
          const r = absFrame(doc, n.id, device);
          return (
            r.x < rect.x + rect.width &&
            r.x + r.width > rect.x &&
            r.y < rect.y + rect.height &&
            r.y + r.height > rect.y
          );
        })
        .map((n) => n.id);
      setSelection(hits);
      return;
    }

    if (it.kind === "rotate") {
      const angle = Math.atan2(world.y - it.center.y, world.x - it.center.x);
      let deg = it.startRotation + ((angle - it.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      updateNode(it.id, { rotation: Math.round(deg) });
      return;
    }

    let dx = world.x - it.startWorld.x;
    let dy = world.y - it.startWorld.y;

    if (it.kind === "drag") {
      const ids = Object.keys(it.frames);
      const primary = ids[0];
      if (primary) {
        const base = absFrame(doc, primary, device);
        const start = it.frames[primary]!;
        const cur = frameOf(doc.nodes[primary]!, device);
        const originAbs = {
          x: base.x - cur.x + start.x + dx,
          y: base.y - cur.y + start.y + dy,
          width: start.width,
          height: start.height,
        };
        const res = computeSnap(originAbs, siblingsFor(ids), { ...pageFrame }, {
          snap,
          grid,
          gridSize,
          zoom,
        });
        dx += res.dx;
        dy += res.dy;
        setGuides(res.guides);
      }
      for (const [id, f] of Object.entries(it.frames)) {
        updateFrame(id, { x: Math.round(f.x + dx), y: Math.round(f.y + dy) });
      }
      return;
    }

    if (it.kind === "resize") {
      const dir = it.dir;
      for (const [id, f] of Object.entries(it.frames)) {
        let { x, y, width, height } = f;
        if (dir.includes("e")) width = f.width + dx;
        if (dir.includes("s")) height = f.height + dy;
        if (dir.includes("w")) {
          width = f.width - dx;
          x = f.x + dx;
        }
        if (dir.includes("n")) {
          height = f.height - dy;
          y = f.y + dy;
        }
        if (e.shiftKey && f.width && f.height) {
          const ratio = f.width / f.height;
          height = width / ratio;
          if (dir.includes("n")) y = f.y + (f.height - height);
        }
        updateFrame(id, {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.max(4, Math.round(width)),
          height: Math.max(4, Math.round(height)),
        });
      }
    }
  };

  const endInteraction = () => {
    interaction.current = { kind: "idle" };
    setMarquee(null);
    setGuides([]);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-node-id]") as HTMLElement | null;
    if (!el) return;
    const id = el.dataset["nodeId"]!;
    const node = doc.nodes[id];
    if (!node) return;
    if (
      ["text", "heading", "paragraph", "button", "productName", "productBrand", "productPrice", "productButton"].includes(
        node.type,
      )
    ) {
      setEditing(id);
    } else if (node.type === "image" || node.type === "productImage") {
      const url = window.prompt("URL da imagem", String(node.props["src"] ?? ""));
      if (url !== null) {
        commit();
        useEditor.getState().updateProps(id, { src: url });
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/x-asteryon-element");
    if (!type) return;
    const world = toWorld(e.clientX, e.clientY);
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-node-id]") as
      | HTMLElement
      | null;
    const targetId = el?.dataset["nodeId"];
    const target = targetId ? doc.nodes[targetId] : undefined;
    const parentId =
      target && ["frame", "container", "row", "column", "section", "group", "showcase", "smartShowcase", "product", "hero"].includes(target.type)
        ? target.id
        : doc.rootId;
    const parentAbs = parentId === doc.rootId ? { x: 0, y: 0 } : absFrame(doc, parentId, device);
    useEditor
      .getState()
      .addElement(type as never, { x: world.x - parentAbs.x, y: world.y - parentAbs.y }, parentId);
  };

  const selRects = selection.map((id) => absFrame(doc, id, device));
  const box =
    selRects.length > 0
      ? {
          x: Math.min(...selRects.map((r) => r.x)),
          y: Math.min(...selRects.map((r) => r.y)),
          width: Math.max(...selRects.map((r) => r.x + r.width)) - Math.min(...selRects.map((r) => r.x)),
          height:
            Math.max(...selRects.map((r) => r.y + r.height)) - Math.min(...selRects.map((r) => r.y)),
        }
      : null;
  const single = selection.length === 1 ? doc.nodes[selection[0]!] : null;
  const inv = 1 / zoom;

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden bg-ed-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div
        className="absolute origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <div
          className="relative shadow-[0_30px_80px_-20px_rgba(2,8,23,0.55)]"
          style={{
            width: pageFrame.width,
            height: pageFrame.height,
            background:
              typeof page.styles["background"] === "string"
                ? (page.styles["background"] as string)
                : "#fff",
            backgroundImage:
              grid && !preview
                ? `linear-gradient(to right, rgba(15,23,42,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.06) 1px, transparent 1px)`
                : undefined,
            backgroundSize: `${gridSize * 4}px ${gridSize * 4}px`,
          }}
          data-node-id={doc.rootId}
        >
          {page.children.map((cid) => (
            <NodeView key={cid} id={cid} />
          ))}
        </div>

        {!preview &&
          guides.map((g, i) => (
            <div
              key={i}
              className={g.kind === "center" ? "absolute bg-fuchsia-500" : "absolute bg-sky-500"}
              style={
                g.axis === "x"
                  ? {
                      left: g.position,
                      top: g.start - 20,
                      width: inv,
                      height: g.end - g.start + 40,
                    }
                  : {
                      top: g.position,
                      left: g.start - 20,
                      height: inv,
                      width: g.end - g.start + 40,
                    }
              }
            />
          ))}

        {!preview && marquee && (
          <div
            className="pointer-events-none absolute border border-ed-accent bg-ed-accent/10"
            style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
          />
        )}

        {!preview && box && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              transform: single?.rotation ? `rotate(${single.rotation}deg)` : undefined,
            }}
          >
            <div
              className="absolute inset-0 border border-ed-accent"
              style={{ borderWidth: inv }}
            />
            {HANDLES.map(([dir, fx, fy]) => (
              <div
                key={dir}
                data-handle={dir}
                className="pointer-events-auto absolute rounded-[2px] border border-ed-accent bg-white"
                style={{
                  width: 9 * inv,
                  height: 9 * inv,
                  left: box.width * fx - 4.5 * inv,
                  top: box.height * fy - 4.5 * inv,
                  cursor: `${dir}-resize`,
                  borderWidth: inv,
                }}
              />
            ))}
            {selection.length === 1 && (
              <div
                data-handle="rotate"
                title="Girar"
                className="pointer-events-auto absolute rounded-full border border-ed-accent bg-white"
                style={{
                  width: 11 * inv,
                  height: 11 * inv,
                  left: box.width / 2 - 5.5 * inv,
                  top: -26 * inv,
                  cursor: "grab",
                  borderWidth: inv,
                }}
              />
            )}
            <div
              className="absolute whitespace-nowrap rounded bg-ed-accent px-1.5 py-0.5 text-white"
              style={{ fontSize: 10 * inv, top: -18 * inv, left: 0 }}
            >
              {single ? single.name : `${selection.length} selecionados`} ·{" "}
              {Math.round(box.width)}×{Math.round(box.height)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
