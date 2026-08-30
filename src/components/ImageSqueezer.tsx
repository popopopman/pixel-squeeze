"use client";
/* eslint-disable @next/next/no-img-element -- Object URLs are local, user-selected browser files. */

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatBytes, outputDimensions } from "@/lib/image";

type Format = "image/webp" | "image/jpeg" | "image/png";
type Output = { blob: Blob; url: string; width: number; height: number };

const formats: {
  value: Format;
  label: string;
  extension: string;
  hint: string;
}[] = [
  {
    value: "image/webp",
    label: "WebP",
    extension: "webp",
    hint: "軽量・おすすめ",
  },
  { value: "image/jpeg", label: "JPEG", extension: "jpg", hint: "写真向け" },
  { value: "image/png", label: "PNG", extension: "png", hint: "透過を維持" },
];
const sizeOptions = [0, 2560, 1920, 1280, 800];

function Icon({ name }: { name: "spark" | "upload" | "download" | "close" }) {
  const paths = {
    spark: (
      <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Zm7 13 .8 3.2L23 19l-3.2.8L19 23l-.8-3.2L15 19l3.2-.8L19 15ZM5 15l.8 3.2L9 19l-3.2.8L5 23l-.8-3.2L1 19l3.2-.8L5 15Z" />
    ),
    upload: <path d="M12 16V3m0 0L7 8m5-5 5 5M4 14v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />,
    download: <path d="M12 3v13m0 0 5-5m-5 5-5-5M4 14v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={name === "spark" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

export default function ImageSqueezer() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const [format, setFormat] = useState<Format>("image/webp");
  const [quality, setQuality] = useState(82);
  const [longestSide, setLongestSide] = useState(1920);
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<"idle" | "processing" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!file || !sourceUrl) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const { width, height } = outputDimensions(
        image.naturalWidth,
        image.naturalHeight,
        longestSide,
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        setStatus("error");
        setMessage("このブラウザでは画像処理を開始できませんでした。");
        return;
      }
      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(image, 0, 0, width, height);
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
            return { blob, url, width, height };
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
  }, [file, format, longestSide, quality, sourceUrl]);

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

  function choose(nextFile?: File) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      setStatus("error");
      setMessage("画像ファイルを選択してください。");
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (output) URL.revokeObjectURL(output.url);
    setOutput(null);
    setOriginalSize({ width: 0, height: 0 });
    setFile(nextFile);
    setStatus("processing");
    setMessage("");
    const url = URL.createObjectURL(nextFile);
    setSourceUrl(url);
    const probe = new Image();
    probe.onload = () =>
      setOriginalSize({
        width: probe.naturalWidth,
        height: probe.naturalHeight,
      });
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

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    choose(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    choose(event.dataTransfer.files[0]);
  }

  function download() {
    if (!file || !output) return;
    const extension = formats.find((item) => item.value === format)?.extension ?? "webp";
    const filename = `${file.name.replace(/\.[^.]+$/, "")}-squeezed.${extension}`;
    const link = document.createElement("a");
    link.href = output.url;
    link.download = filename;
    link.click();
  }

  const reduction = output && file ? Math.round((1 - output.blob.size / file.size) * 100) : null;

  return (
    <main>
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <nav className="nav shell" aria-label="メインナビゲーション">
        <a className="brand" href="#top">
          <span className="brand-mark">
            <Icon name="spark" />
          </span>
          Pixel Squeeze
        </a>
        <span className="privacy">
          <span className="privacy-dot" />
          端末内で完結
        </span>
      </nav>

      <motion.section
        className="hero shell"
        id="top"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <p className="eyebrow">
          IMAGE OPTIMIZER <span>✦</span> NO UPLOADS
        </p>
        <h1>
          写真を、<em>軽やかに。</em>
        </h1>
        <p className="lead">
          画像を圧縮・リサイズ・変換。ファイルは一度もサーバーへ送られず、ブラウザの中だけで完了します。
        </p>
      </motion.section>

      <section className="workspace shell" aria-label="画像圧縮ツール">
        <motion.div
          className="panel source-panel"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }}
        >
          <div className="panel-heading">
            <span>01</span>
            <h2>画像を選ぶ</h2>
            {file && (
              <button className="icon-button" onClick={remove} aria-label="画像を取り除く">
                <Icon name="close" />
              </button>
            )}
          </div>
          {!file ? (
            <label
              className="dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onInput}
              />
              <span className="upload-icon">
                <Icon name="upload" />
              </span>
              <strong>画像をドラッグ＆ドロップ</strong>
              <span>またはクリックして選択</span>
              <small>JPEG / PNG / WebP</small>
            </label>
          ) : (
            <motion.div
              className="preview-card"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <img src={sourceUrl} alt="変換前のプレビュー" />
              <div className="image-meta">
                <strong>{file.name}</strong>
                <span>
                  {originalSize.width} × {originalSize.height}　·　
                  {formatBytes(file.size)}
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          className="panel settings-panel"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          <div className="panel-heading">
            <span>02</span>
            <h2>仕上がりを調整</h2>
          </div>
          <fieldset>
            <legend>出力形式</legend>
            <div className="format-grid">
              {formats.map((item) => (
                <button
                  key={item.value}
                  className={format === item.value ? "format active" : "format"}
                  onClick={() => {
                    setFormat(item.value);
                    setStatus("processing");
                  }}
                >
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>
              画質 <output>{quality}</output>
            </legend>
            <input
              className="range"
              type="range"
              min="35"
              max="100"
              value={quality}
              style={{
                ["--fill" as string]: `${((quality - 35) / 65) * 100}%`,
              }}
              onChange={(event) => {
                setQuality(Number(event.target.value));
                setStatus("processing");
              }}
            />
            <div className="range-labels">
              <span>軽い</span>
              <span>きれい</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>長辺の最大サイズ</legend>
            <div className="size-pills">
              {sizeOptions.map((size) => (
                <button
                  key={size}
                  className={longestSide === size ? "size-pill active" : "size-pill"}
                  onClick={() => {
                    setLongestSide(size);
                    setStatus("processing");
                  }}
                >
                  {size ? `${size}px` : "そのまま"}
                </button>
              ))}
            </div>
          </fieldset>
        </motion.div>

        <motion.div
          className="panel result-panel"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: "easeOut" }}
        >
          <div className="panel-heading">
            <span>03</span>
            <h2>ダウンロード</h2>
            <i className={status} />
          </div>
          <AnimatePresence mode="wait">
            {status === "processing" && (
              <motion.div
                key="processing"
                className="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="orb" />
                <strong>画像を最適化中...</strong>
                <p>まもなくプレビューを表示します</p>
              </motion.div>
            )}
            {status === "idle" && (
              <motion.div
                key="idle"
                className="empty-result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span>✦</span>
                <strong>ここに結果が届きます</strong>
                <p>画像を選ぶと、すぐに最適化を始めます。</p>
              </motion.div>
            )}
            {status === "error" && (
              <motion.div
                key="error"
                className="empty-result error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span>!</span>
                <strong>画像を処理できませんでした</strong>
                <p>{message}</p>
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
                <div className="result-preview">
                  <img src={output.url} alt="変換後のプレビュー" />
                </div>
                <div className="result-stats">
                  <div>
                    <span>サイズ</span>
                    <strong>{formatBytes(output.blob.size)}</strong>
                  </div>
                  <div>
                    <span>解像度</span>
                    <strong>
                      {output.width} × {output.height}
                    </strong>
                  </div>
                </div>
                <p className={reduction && reduction > 0 ? "saving" : "saving neutral"}>
                  {reduction && reduction > 0
                    ? `元の画像より ${reduction}% 軽くなりました`
                    : "設定を変えて好みのサイズに調整できます"}
                </p>
                <button className="download" onClick={download}>
                  <Icon name="download" />
                  ダウンロード
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <footer className="shell">
        <span>Pixel Squeeze</span>
        <p>画像はあなたのブラウザから外へ出ません。</p>
      </footer>
    </main>
  );
}
