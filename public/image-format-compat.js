(() => {
  "use strict";

  const MIME_BY_EXTENSION = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jfif: "image/jpeg",
    pjpeg: "image/jpeg",
    pjp: "image/jpeg",
    png: "image/png",
    apng: "image/apng",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    dib: "image/bmp",
    svg: "image/svg+xml",
    svgz: "image/svg+xml",
    avif: "image/avif",
    ico: "image/x-icon",
    cur: "image/x-icon",
    tif: "image/tiff",
    tiff: "image/tiff",
    heic: "image/heic",
    heif: "image/heif",
    jxl: "image/jxl"
  };

  const extensions = Object.keys(MIME_BY_EXTENSION);
  const IMAGE_ACCEPT = ["image/*", ...extensions.map((ext) => `.${ext}`)];
  const IMAGE_CONTEXT = /\b(imagem|imagens|image|images|foto|fotos|galeria|gallery|logo|banner|carrossel|carousel|produto|product)\b/i;
  const IMAGE_EXT_RE = new RegExp(`\\.(${extensions.join("|")})(?:\\b|$)`, "i");

  const splitAccept = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  function contextText(input) {
    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    return [
      input.name,
      input.id,
      input.getAttribute("aria-label"),
      input.getAttribute("title"),
      label?.textContent,
      input.closest("label")?.textContent,
      input.parentElement?.textContent?.slice(0, 220)
    ]
      .filter(Boolean)
      .join(" ");
  }

  function looksLikeImageInput(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return false;

    const accept = input.getAttribute("accept") || "";
    if (/image\//i.test(accept) || IMAGE_EXT_RE.test(accept)) return true;

    // Se o campo já declara formatos não-imagem (XLSX, XML, PDF etc.), não alteramos.
    if (accept.trim()) return false;

    return IMAGE_CONTEXT.test(contextText(input));
  }

  function patchImageInput(input) {
    if (!looksLikeImageInput(input)) return;

    const current = splitAccept(input.getAttribute("accept"));
    const keepNonImage = current.filter(
      (value) => !/^image\//i.test(value) && !IMAGE_EXT_RE.test(value)
    );
    const next = [...new Set([...keepNonImage, ...IMAGE_ACCEPT])].join(",");

    if (input.getAttribute("accept") !== next) {
      input.setAttribute("accept", next);
    }
  }

  function scan(root = document) {
    if (root instanceof HTMLInputElement && root.matches('input[type="file"]')) {
      patchImageInput(root);
    }
    root.querySelectorAll?.('input[type="file"]').forEach(patchImageInput);
  }

  function extensionFor(filename) {
    const match = /\.([a-z0-9]+)$/i.exec(filename || "");
    return match ? match[1].toLowerCase() : "";
  }

  function normalizeBlankMime(input) {
    if (!looksLikeImageInput(input) || !input.files?.length || typeof DataTransfer === "undefined") {
      return;
    }

    try {
      const transfer = new DataTransfer();
      let changed = false;

      for (const file of input.files) {
        const ext = extensionFor(file.name);
        const guessedType = MIME_BY_EXTENSION[ext];

        if (!file.type && guessedType) {
          transfer.items.add(
            new File([file], file.name, {
              type: guessedType,
              lastModified: file.lastModified
            })
          );
          changed = true;
        } else {
          transfer.items.add(file);
        }
      }

      if (changed) input.files = transfer.files;
    } catch (_) {
      // Alguns navegadores impedem substituir FileList; mantemos os arquivos originais.
    }
  }

  scan();

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        patchImageInput(record.target);
        continue;
      }

      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      }
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["accept", "type"]
  });

  // Garante que inputs criados dinamicamente pelo editor sejam ajustados antes de abrir o seletor.
  document.addEventListener("pointerdown", () => scan(), true);
  document.addEventListener(
    "focusin",
    (event) => {
      if (event.target instanceof HTMLInputElement) patchImageInput(event.target);
    },
    true
  );
  document.addEventListener(
    "change",
    (event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.type === "file") {
        patchImageInput(input);
        normalizeBlankMime(input);
      }
    },
    true
  );
})();
