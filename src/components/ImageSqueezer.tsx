"use client";
/* eslint-disable @next/next/no-img-element -- Object URLs are local, user-selected browser files. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
import { cropRect, formatBytes, outputDimensions } from "@/lib/image";

type Format = "image/webp" | "image/jpeg" | "image/png";
type Output = { blob: Blob; url: string; width: number; height: number };
type Focus = { x: number; y: number };

const formats: { value: Format; label: string; extension: string }[] = [
  { value: "image/webp", label: "WebP", extension: "webp" },
  { value: "image/jpeg", label: "JPEG", extension: "jpg" },
  { value: "image/png", label: "PNG", extension: "png" },
];

const templates = [
  { id: "instagram-feed", label: "Instagram", detail: "縦型フィード", width: 1080, height: 1350 },
  { id: "instagram-story", label: "Instagram", detail: "ストーリーズ", width: 1080, height: 1920 },
  { id: "x-post", label: "X", detail: "横長ポスト", width: 1600, height: 900 },
  { id: "line-square", label: "LINE", detail: "スクエア投稿", width: 1040, height: 1040 },
  { id: "youtube-thumb", label: "YouTube", detail: "サムネイル", width: 1280, height: 720 },
] as const;

const aspectOptions = [
  { label: "自由", ratio: undefined },
  { label: "1:1", ratio: 1 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 },
];
const longestOptions = [0, 2560, 1920, 1280, 800];

function Icon({ name }: { name: "mark" | "upload" | "download" | "close" | "crop" | "reset" }) {
  const paths = {
    mark: (
      <path d="M2 7.5 7.5 2 12 6.5 16.5 2 22 7.5 16.5 13 12 8.5 7.5 13 2 7.5Zm0 9 5.5-5.5L12 15.5l4.5-4.5L22 16.5 16.5 22 12 17.5 7.5 22 2 16.5Z" />
    ),
    upload: <path d="M12 16V3m0 0L7 8m5-5 5 5M4 14v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />,
    download: <path d="M12 3v13m0 0 5-5m-5 5-5-5M4 14v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    crop: <path d="M7 3v11a3 3 0 0 0 3 3h11M17 21V10a3 3 0 0 0-3-3H3M7 3H3m4 0v4m10 10v4m0-4h4" />,
    reset: <path d="M4 9V4m0 0h5M4.7 4.7A8 8 0 1 1 4 15m0 0v5m0-5h5" />,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={name === "mark" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export default function ImageSqueezer() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const [format, setFormat] = useState<Format>("image/webp");
  const [quality, setQuality] = useState(82);
  const [longestSide, setLongestSide] = useState(1920);
  const [templateId, setTemplateId] = useState("");
  const [aspectRatio, setAspectRatio] = useState<number | undefined>();
  const [focus, setFocus] = useState<Focus>({ x: 0.5, y: 0.5 });
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStart = useRef<{ x: number; y: number; focus: Focus } | null>(null);
  const reduceMotion = useReducedMotion();

  const selectedTemplate = templates.find((item) => item.id === templateId);
  const activeRatio = selectedTemplate
    ? selectedTemplate.width / selectedTemplate.height
    : aspectRatio;
  const previewRatio =
    activeRatio ??
    (originalSize.width && originalSize.height ? originalSize.width / originalSize.height : 4 / 3);

  useEffect(() => {
    if (!file || !sourceUrl) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const crop = cropRect(image.naturalWidth, image.naturalHeight, activeRatio, focus.x, focus.y);
      const dimensions = selectedTemplate
        ? { width: selectedTemplate.width, height: selectedTemplate.height }
        : outputDimensions(crop.width, crop.height, longestSide);
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) {
        setStatus("error");
        setMessage("このブラウザでは画像処理を開始できませんでした。");
        return;
      }
      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, dimensions.width, dimensions.height);
      }
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        dimensions.width,
        dimensions.height,
      );
      canvas.toBlob(
        (blob) => {
          if (cancelled) return;
          if (!blob) {
            setStatus("error");
            setMessage("変換に失敗しました。別の形式でお試しください。");
            return;
          }
          const url = URL.createObjectURL(blob);
          setOutput((previous) => {
            if (previous) URL.revokeObjectURL(previous.url);
            return { blob, url, ...dimensions };
          });
          setStatus("ready");
        },
        format,
        quality / 100,
      );
    };
    image.onerror = () => {
      if (!cancelled) {
        setStatus("error");
        setMessage("この画像は読み込めませんでした。JPEG、PNG、WebPをお試しください。");
      }
    };
    image.src = sourceUrl;
    return () => {
      cancelled = true;
    };
  }, [activeRatio, file, focus, format, longestSide, quality, selectedTemplate, sourceUrl]);

  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    },
    [sourceUrl],
  );
  useEffect(
    () => () => {
      if (output) URL.revokeObjectURL(output.url);
    },
    [output],
  );

  function processing() {
    if (file) setStatus("processing");
  }

  function choose(nextFile?: File) {
    if (!nextFile) return;
    if (!/image\/(jpeg|png|webp)/.test(nextFile.type)) {
      setStatus("error");
      setMessage("JPEG、PNG、WebPの画像を選択してください。");
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (output) URL.revokeObjectURL(output.url);
    const url = URL.createObjectURL(nextFile);
    setOutput(null);
    setOriginalSize({ width: 0, height: 0 });
    setFocus({ x: 0.5, y: 0.5 });
    setFile(nextFile);
    setSourceUrl(url);
    setStatus("processing");
    setMessage("");
    const probe = new Image();
    probe.onload = () =>
      setOriginalSize({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = url;
  }

  function remove() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (output) URL.revokeObjectURL(output.url);
    setFile(null);
    setSourceUrl("");
    setOutput(null);
    setOriginalSize({ width: 0, height: 0 });
    setStatus("idle");
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectTemplate(id: string) {
    const next = templates.find((item) => item.id === id);
    if (!next || id === templateId) return;
    setTemplateId(id);
    setFocus({ x: 0.5, y: 0.5 });
    processing();
  }

  function selectAspect(nextRatio: number | undefined) {
    if (nextRatio === activeRatio && !templateId) return;
    setTemplateId("");
    setAspectRatio(nextRatio);
    setFocus({ x: 0.5, y: 0.5 });
    processing();
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    choose(event.target.files?.[0]);
  }
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    choose(event.dataTransfer.files[0]);
  }

  function beginCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!file || !activeRatio) return;
    dragStart.current = { x: event.clientX, y: event.clientY, focus };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsCropping(true);
  }

  function moveCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setFocus({
      x: clamp(dragStart.current.focus.x - (event.clientX - dragStart.current.x) / bounds.width),
      y: clamp(dragStart.current.focus.y - (event.clientY - dragStart.current.y) / bounds.height),
    });
    processing();
  }

  function endCrop() {
    dragStart.current = null;
    setIsCropping(false);
  }

  function download() {
    if (!file || !output) return;
    const extension = formats.find((item) => item.value === format)?.extension ?? "webp";
    const base = file.name.replace(/\.[^.]+$/, "");
    const suffix = selectedTemplate ? `-${selectedTemplate.id}` : "-squeezed";
    const link = document.createElement("a");
    link.href = output.url;
    link.download = `${base}${suffix}.${extension}`;
    link.click();
  }

  const reduction = output && file ? Math.round((1 - output.blob.size / file.size) * 100) : null;

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="メインナビゲーション">
        <a className="wordmark" href="#top">
          <span>
            <Icon name="mark" />
          </span>
          PIXEL SQUEEZE
        </a>
        <p>
          <i />
          LOCAL PROCESSING
        </p>
      </nav>

      <header className="masthead" id="top">
        <p className="kicker">IMAGE PREPARATION TOOL — 01</p>
        <h1>
          画像を、
          <br />
          <em>ちょうどよく。</em>
        </h1>
        <p className="intro">
          圧縮、用途別サイズ、切り抜きまで。画像はあなたのブラウザから出ません。
        </p>
      </header>

      <section className="workbench" aria-label="画像の変換とトリミング">
        <motion.section
          className="image-station"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
        >
          <div className="station-title">
            <span>01</span>
            <h2>画像を置く</h2>
            {file && (
              <button type="button" className="plain-action" onClick={remove}>
                <Icon name="close" />
                取り除く
              </button>
            )}
          </div>
          {!file ? (
            <label
              className="drop-target"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onInput}
              />
              <span className="drop-symbol">
                <Icon name="upload" />
              </span>
              <strong>画像をドラッグ＆ドロップ</strong>
              <span>またはクリックして選択</span>
              <small>JPEG / PNG / WebP　最大処理は端末内で行われます</small>
            </label>
          ) : (
            <div className="crop-workspace">
              <div
                className={isCropping ? "crop-frame grabbing" : "crop-frame"}
                style={{ aspectRatio: previewRatio }}
                onPointerDown={beginCrop}
                onPointerMove={moveCrop}
                onPointerUp={endCrop}
                onPointerCancel={endCrop}
              >
                <motion.img
                  key={`${sourceUrl}-${activeRatio}`}
                  src={sourceUrl}
                  alt="切り抜き範囲のプレビュー"
                  draggable={false}
                  style={{ objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }}
                  initial={reduceMotion ? false : { opacity: 0.2, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.24 }}
                />
                <span className="crop-lines" aria-hidden="true" />
                {activeRatio && (
                  <span className="crop-note">
                    <Icon name="crop" />
                    ドラッグで位置を調整
                  </span>
                )}
              </div>
              <div className="file-line">
                <strong>{file.name}</strong>
                <span>
                  {originalSize.width} × {originalSize.height}　/　{formatBytes(file.size)}
                </span>
              </div>
            </div>
          )}
        </motion.section>

        <motion.aside
          className="control-station"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.08 }}
        >
          <div className="station-title">
            <span>02</span>
            <h2>切り抜きと出力</h2>
          </div>
          <fieldset>
            <legend>アスペクト比</legend>
            <div className="ratio-list">
              {aspectOptions.map((item) => (
                <button
                  type="button"
                  key={item.label}
                  className={
                    !templateId && activeRatio === item.ratio
                      ? "ratio-choice active"
                      : "ratio-choice"
                  }
                  onClick={() => selectAspect(item.ratio)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          {file && activeRatio && (
            <fieldset className="position-control">
              <legend>
                切り抜き位置{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFocus({ x: 0.5, y: 0.5 });
                    processing();
                  }}
                  aria-label="切り抜き位置を中央に戻す"
                >
                  <Icon name="reset" />
                  中央へ
                </button>
              </legend>
              <label>
                横
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(focus.x * 100)}
                  onChange={(event) => {
                    setFocus((current) => ({ ...current, x: Number(event.target.value) / 100 }));
                    processing();
                  }}
                />
              </label>
              <label>
                縦
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(focus.y * 100)}
                  onChange={(event) => {
                    setFocus((current) => ({ ...current, y: Number(event.target.value) / 100 }));
                    processing();
                  }}
                />
              </label>
            </fieldset>
          )}
          <fieldset>
            <legend>ファイル形式</legend>
            <div className="format-list">
              {formats.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={format === item.value ? "format-choice active" : "format-choice"}
                  onClick={() => {
                    if (format !== item.value) {
                      setFormat(item.value);
                      processing();
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>
              画質 <output>{quality}</output>
            </legend>
            <input
              className="quality-range"
              type="range"
              min="35"
              max="100"
              value={quality}
              style={{ ["--range-progress" as string]: `${((quality - 35) / 65) * 100}%` }}
              onChange={(event) => {
                setQuality(Number(event.target.value));
                processing();
              }}
            />
          </fieldset>
          {!selectedTemplate && (
            <fieldset>
              <legend>長辺の最大サイズ</legend>
              <div className="size-list">
                {longestOptions.map((size) => (
                  <button
                    type="button"
                    key={size}
                    className={longestSide === size ? "size-choice active" : "size-choice"}
                    onClick={() => {
                      if (longestSide !== size) {
                        setLongestSide(size);
                        processing();
                      }
                    }}
                  >
                    {size ? `${size}px` : "そのまま"}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {selectedTemplate && (
            <p className="target-note">
              このテンプレートは{" "}
              <strong>
                {selectedTemplate.width} × {selectedTemplate.height}px
              </strong>{" "}
              で書き出します。
            </p>
          )}
        </motion.aside>

        <motion.section
          className="template-station"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.16 }}
        >
          <div className="station-title">
            <span>PRESET</span>
            <h2>用途を選ぶ</h2>
            <p>選ぶだけで、サイズと比率を揃えます。</p>
          </div>
          <div className="template-list">
            {templates.map((item) => (
              <button
                type="button"
                key={item.id}
                className={templateId === item.id ? "template-choice active" : "template-choice"}
                onClick={() => selectTemplate(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
                <small>
                  {item.width} × {item.height}
                </small>
              </button>
            ))}
          </div>
        </motion.section>

        <section className="result-station" aria-live="polite">
          <div className="station-title">
            <span>03</span>
            <h2>書き出す</h2>
            <i className={status} />
          </div>
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                className="result-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span>READY</span>
                <p>画像を選ぶと、ここに最適化後の結果が届きます。</p>
              </motion.div>
            )}
            {status === "processing" && (
              <motion.div
                key="processing"
                className="result-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="processing-rule" />
                <p>処理しています。プレビューを作成中です。</p>
              </motion.div>
            )}
            {status === "error" && (
              <motion.div
                key="error"
                className="result-empty error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span>ERROR</span>
                <p role="alert">{message}</p>
              </motion.div>
            )}
            {status === "ready" && output && (
              <motion.div
                key="ready"
                className="result-ready"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="export-preview">
                  <img src={output.url} alt="変換後のプレビュー" />
                </div>
                <dl>
                  <div>
                    <dt>サイズ</dt>
                    <dd>{formatBytes(output.blob.size)}</dd>
                  </div>
                  <div>
                    <dt>解像度</dt>
                    <dd>
                      {output.width} × {output.height}
                    </dd>
                  </div>
                  <div>
                    <dt>形式</dt>
                    <dd>{format.split("/")[1].toUpperCase()}</dd>
                  </div>
                </dl>
                <p className={reduction && reduction > 0 ? "saving-line" : "saving-line neutral"}>
                  {reduction && reduction > 0
                    ? `元の画像より ${reduction}% 軽くなりました。`
                    : "この設定で書き出せます。"}
                </p>
                <button type="button" className="download-button" onClick={download}>
                  <Icon name="download" />
                  ダウンロード
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </section>

      <footer>
        <span>PIXEL SQUEEZE</span>
        <p>NO UPLOADS. NO ACCOUNTS. JUST LOCAL PIXELS.</p>
      </footer>
    </main>
  );
}
