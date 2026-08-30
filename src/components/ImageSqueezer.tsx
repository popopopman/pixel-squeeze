"use client";
/* eslint-disable @next/next/no-img-element -- Object URLs are local, user-selected browser files. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import JsBarcode from "jsbarcode";
import { FileDown } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { cropRect, formatBytes, outputDimensions } from "@/lib/image";

type Format = "image/webp" | "image/jpeg" | "image/png";
type Output = { blob: Blob; url: string; width: number; height: number };
type Focus = { x: number; y: number };

const formats: { value: Format; label: string; extension: string }[] = [
  { value: "image/webp", label: "WebP", extension: "webp" },
  { value: "image/jpeg", label: "JPEG", extension: "jpg" },
  { value: "image/png", label: "PNG", extension: "png" },
];

// 公開先ごとに必要な完成サイズをここへ固定値として集約する。
// 外部サービスの仕様は変わり得るため、変更時はこの一覧とテスト対象の UI を一緒に見直す。
const templates = [
  { id: "instagram-feed", label: "Instagram", detail: "縦型フィード", width: 1080, height: 1350 },
  { id: "instagram-story", label: "Instagram", detail: "ストーリーズ", width: 1080, height: 1920 },
  { id: "x-post", label: "X", detail: "横長ポスト", width: 1600, height: 900 },
  { id: "line-square", label: "LINE", detail: "スクエア投稿", width: 1040, height: 1040 },
  { id: "youtube-thumb", label: "YouTube", detail: "サムネイル", width: 1280, height: 720 },
] as const;

// テンプレートを選ばない場合だけ使う、手動トリミング用の比率一覧。
const aspectOptions = [
  { label: "自由", ratio: undefined },
  { label: "1:1", ratio: 1 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 },
];
// 0 は「リサイズしない」を表す。画像を拡大しない判定は outputDimensions 側で担保する。
const longestOptions = [0, 2560, 1920, 1280, 800];

// GitHub Actions がビルド時に NEXT_PUBLIC_GIT_SHA へデプロイ対象の SHA を注入する。
// Next.js の public 環境変数は静的出力へ埋め込まれるため、公開ページのバーコードは
// 実際に配信されたリビジョンを表す。ローカル開発時だけ判別用の値へフォールバックする。
const barcodeValue = `GIT-${process.env.NEXT_PUBLIC_GIT_SHA?.slice(0, 12) ?? "LOCAL-DEV"}`;

const choice =
  "min-h-8 border border-[#aebcff] px-2 text-[0.68rem] font-semibold text-[#1010ee] transition-colors hover:border-[#1010ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1010ee]";
const activeChoice = "border-[#1010ee] bg-[#1010ee] text-white hover:border-[#1010ee]";

function Icon({ name }: { name: "mark" | "upload" | "close" | "crop" | "reset" }) {
  const paths = {
    mark: (
      <path d="M2 7.5 7.5 2 12 6.5 16.5 2 22 7.5 16.5 13 12 8.5 7.5 13 2 7.5Zm0 9 5.5-5.5L12 15.5l4.5-4.5L22 16.5 16.5 22 12 17.5 7.5 22 2 16.5Z" />
    ),
    upload: <path d="M12 16V3m0 0L7 8m5-5 5 5M4 14v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />,
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

function Barcode() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // JsBarcode は対象 SVG の子要素を直接生成するため、React が内容を管理しない空の SVG を渡す。
    // CODE128 は英数字とハイフンをそのまま扱えるので、Git の短縮 SHA を示す用途に適している。
    // 文字列は SVG の下にも表示するため、displayValue は無効にして重複を避ける。
    JsBarcode(svgRef.current, barcodeValue, {
      background: "#ffffff",
      displayValue: false,
      format: "CODE128",
      height: 34,
      lineColor: "#1010ee",
      margin: 0,
      width: 1.25,
    });
  }, []);

  return (
    <figure className="m-0 hidden border border-[#1010ee] p-1.5 text-[#1010ee] sm:block">
      <svg
        ref={svgRef}
        className="block w-[190px] max-w-full"
        role="img"
        aria-label={`Code 128 barcode: ${barcodeValue}`}
      />
      <figcaption className="mt-0.5 text-center text-[0.49rem] font-bold tracking-[0.15em]">
        {barcodeValue}
      </figcaption>
    </figure>
  );
}

function PanelTitle({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex min-h-6 items-baseline gap-3">
      <span className="text-[0.66rem] font-extrabold tracking-[0.14em] text-[#1010ee]">
        {index}
      </span>
      <h2 className="m-0 text-[0.98rem] font-extrabold tracking-[-0.04em] text-[#1010ee]">
        {title}
      </h2>
      {children}
    </div>
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

  // テンプレート優先: 選択中は登録済みの完成サイズ・比率を使い、未選択時は手動比率を使う。
  const selectedTemplate = templates.find((item) => item.id === templateId);
  const activeRatio = selectedTemplate
    ? selectedTemplate.width / selectedTemplate.height
    : aspectRatio;
  const previewRatio =
    activeRatio ??
    (originalSize.width && originalSize.height ? originalSize.width / originalSize.height : 4 / 3);

  // 入力画像か出力設定が変わるたびに、ブラウザ内 Canvas で次のプレビュー Blob を作る。
  // 送信 API は使わず、この effect と Canvas API だけで完結させるため画像は端末外へ出ない。
  useEffect(() => {
    if (!file || !sourceUrl) return;
    // Image.onload と canvas.toBlob は非同期。素早く設定を変えた場合に古い処理結果で
    // 状態を上書きしないよう、cleanup でこの処理だけを無効化する。
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      // 元画像上の切り抜き範囲と、完成画像のピクセル数を別々に決定する。
      // テンプレートは必ず指定寸法、手動設定は長辺の上限に収める。
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
      // JPEG は透明度を持てない。透明領域を黒くせず、白で塗ってから描画する。
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
      // toBlob の結果を Object URL にして img の src とダウンロードの両方に利用する。
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
            // 設定変更ごとに URL を作り直すので、前の Blob URL を即時解放してメモリを増やさない。
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

  // ファイルの差し替えやコンポーネント破棄でも URL を解放する。
  // ここで source と output を別々に扱うことで、プレビュー表示中の URL を早く消しすぎない。
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
    // Canvas のエンコード対象を明示的に限定し、対応外形式は読み込み前に止める。
    if (!/image\/(jpeg|png|webp)/.test(nextFile.type)) {
      setStatus("error");
      setMessage("JPEG、PNG、WebPの画像を選択してください。");
      return;
    }
    // 差し替え前の Object URL はもう参照されないので、次の URL を作る前に解放する。
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
    // 変換 effect とは別に元の寸法を読む。これはファイル情報表示だけに使い、変換を待たせない。
    const probe = new Image();
    probe.onload = () =>
      setOriginalSize({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = url;
  }
  function remove() {
    // UI 状態とネイティブ file input の値を両方リセットする。
    // input.value も空にしないと、同じファイルを続けて選び直したときに change が発火しない。
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
    // 比率が変わるため、前の構図を引き継がず中央から再スタートする。
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
  function beginCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!file || !activeRatio) return;
    // 開始地点と開始時の焦点をセットで保持し、移動量から絶対的な焦点を再計算する。
    // Pointer Capture により、ポインターが枠外へ出てもドラッグ終了までイベントを受け取れる。
    dragStart.current = { x: event.clientX, y: event.clientY, focus };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsCropping(true);
  }
  function moveCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setFocus({
      // 画像を右へドラッグしたときは表示する画像の位置を左へずらすため、移動量を引く。
      // clamp により、切り抜き範囲が元画像の外へ出ることはない。
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
    // テンプレート利用時は完成用途がファイル名からも分かるようにする。
    const suffix = selectedTemplate ? `-${selectedTemplate.id}` : "-squeezed";
    const link = document.createElement("a");
    link.href = output.url;
    link.download = `${base}${suffix}.${extension}`;
    link.click();
  }

  const reduction = output && file ? Math.round((1 - output.blob.size / file.size) * 100) : null;
  const statusLabel =
    status === "ready"
      ? "READY"
      : status === "processing"
        ? "PROCESSING"
        : status === "error"
          ? "ERROR"
          : "STANDBY";

  return (
    <main className="min-w-80 bg-[#eef0ff] font-['Noto_Sans_JP'] text-[#1010ee] antialiased">
      <header className="mx-auto w-[min(1220px,calc(100%_-_2.7rem))] border-b border-[#1010ee]">
        <div className="flex min-h-[74px] items-center gap-4">
          <a
            className="inline-flex shrink-0 items-center gap-2 text-[0.8rem] font-extrabold tracking-[-0.04em] text-[#1010ee] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1010ee]"
            href="https://popopopman.github.io/"
          >
            <span className="grid size-9 place-items-center bg-[#1010ee] text-white">
              <Icon name="mark" />
            </span>
            PIXEL SQUEEZE
          </a>
          <p className="m-0 hidden min-w-0 flex-1 text-[0.69rem] font-semibold tracking-[-0.03em] text-[#1010ee] lg:block">
            Browser image preparation / local-only export system
          </p>
          <Barcode />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-t border-[#aebcff] py-2 text-[0.58rem] font-bold tracking-[0.1em] text-[#1010ee]">
          <span>IMAGE PREPARATION TOOL / 01</span>
          <span>JPEG · PNG · WEBP</span>
          <span>CLIENT-SIDE PROCESSING</span>
          <span className="text-[#ee00e8]">STATUS / {statusLabel}</span>
        </div>
      </header>

      <section
        className="mx-auto grid w-[min(1220px,calc(100%_-_2.7rem))] border-b border-[#1010ee] lg:grid-cols-[minmax(0,7fr)_minmax(360px,5fr)]"
        aria-label="画像の変換とトリミング"
      >
        <motion.section
          className="min-w-0 border-b border-[#aebcff] py-7 lg:border-r lg:py-9 lg:pr-9"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
        >
          <PanelTitle index="01" title="画像を置く">
            {file && (
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1.5 border-b border-[#aebcff] pb-0.5 text-[0.68rem] font-bold text-[#1010ee] hover:border-[#1010ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1010ee]"
                onClick={remove}
              >
                <Icon name="close" />
                取り除く
              </button>
            )}
          </PanelTitle>
          {!file ? (
            <label
              className="grid min-h-[390px] cursor-pointer place-content-center justify-items-center gap-2.5 border border-dashed border-[#1010ee] bg-[#1010ee] bg-[linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] p-6 text-center [background-size:24px_24px] hover:bg-[#0808c8] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1010ee] sm:min-h-[430px]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                choose(event.dataTransfer.files[0]);
              }}
            >
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0])}
              />
              <span className="grid size-12 place-items-center bg-white text-[#1010ee]">
                <Icon name="upload" />
              </span>
              <strong className="mt-1 text-[0.96rem] font-extrabold tracking-[-0.04em] text-white">
                画像をドラッグ＆ドロップ
              </strong>
              <span className="text-[0.76rem] font-medium text-white">またはクリックして選択</span>
              <small className="mt-3 max-w-64 text-[0.63rem] leading-5 text-white">
                MAX LOCAL PROCESSING / JPEG · PNG · WEBP
              </small>
            </label>
          ) : (
            <div className="min-h-[390px] sm:min-h-[430px]">
              <div
                className={`relative grid w-full max-h-[500px] touch-none place-items-center overflow-hidden bg-[#e9ebff] ${isCropping ? "cursor-grabbing" : "cursor-grab"}`}
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
                  className="size-full select-none object-cover"
                  draggable={false}
                  style={{ objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }}
                  initial={reduceMotion ? false : { opacity: 0.2, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.24 }}
                />
                <div
                  className="pointer-events-none absolute inset-0 border border-white/80"
                  aria-hidden="true"
                >
                  <span className="absolute inset-y-0 left-1/3 w-px bg-white/80" />
                  <span className="absolute inset-y-0 left-2/3 w-px bg-white/80" />
                  <span className="absolute inset-x-0 top-1/3 h-px bg-white/80" />
                  <span className="absolute inset-x-0 top-2/3 h-px bg-white/80" />
                </div>
                {activeRatio && (
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 bg-[#1010ee] px-2 py-1.5 text-[0.62rem] font-bold text-white">
                    <Icon name="crop" />
                    DRAG TO POSITION
                  </span>
                )}
              </div>
              <div className="flex justify-between gap-4 border-b border-[#aebcff] pt-3 text-[0.67rem] text-[#1010ee]">
                <strong className="max-w-[55%] overflow-hidden pb-3 text-[0.72rem] font-bold text-[#1010ee] text-ellipsis whitespace-nowrap">
                  {file.name}
                </strong>
                <span className="pb-3 whitespace-nowrap">
                  {originalSize.width} × {originalSize.height} / {formatBytes(file.size)}
                </span>
              </div>
            </div>
          )}
        </motion.section>

        <motion.aside
          className="min-w-0 border-b border-[#aebcff] py-7 lg:py-9 lg:pl-9"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.08 }}
        >
          <PanelTitle index="02" title="切り抜きと出力" />
          <fieldset className="m-0 border-0 border-t border-[#aebcff] py-4 first:border-t-0 first:pt-0">
            <legend className="mb-3 text-[0.66rem] font-bold tracking-[0.08em] text-[#1010ee]">
              アスペクト比
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {aspectOptions.map((item) => (
                <button
                  type="button"
                  key={item.label}
                  className={`${choice} ${!templateId && activeRatio === item.ratio ? activeChoice : ""}`}
                  onClick={() => selectAspect(item.ratio)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          {file && activeRatio && (
            <fieldset className="m-0 border-0 border-t border-[#aebcff] py-4">
              <legend className="mb-3 flex items-center justify-between text-[0.66rem] font-bold tracking-[0.08em] text-[#1010ee]">
                切り抜き位置{" "}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[0.65rem] font-bold text-[#ee00e8] hover:text-[#1010ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1010ee]"
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
              <label className="mt-2 grid grid-cols-[20px_1fr] items-center gap-2 text-[0.65rem] font-semibold text-[#1010ee]">
                横
                <input
                  className="w-full accent-[#1010ee]"
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
              <label className="mt-2 grid grid-cols-[20px_1fr] items-center gap-2 text-[0.65rem] font-semibold text-[#1010ee]">
                縦
                <input
                  className="w-full accent-[#1010ee]"
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
          <fieldset className="m-0 border-0 border-t border-[#aebcff] py-4">
            <legend className="mb-3 text-[0.66rem] font-bold tracking-[0.08em] text-[#1010ee]">
              ファイル形式
            </legend>
            <div className="flex flex-wrap">
              {formats.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={`${choice} min-w-[70px] -mr-px ${format === item.value ? activeChoice : ""}`}
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
          <fieldset className="m-0 border-0 border-y border-[#aebcff] py-4">
            <legend className="mb-3 flex justify-between text-[0.66rem] font-bold tracking-[0.08em] text-[#1010ee]">
              画質 <output className="text-[#ee00e8]">{quality}</output>
            </legend>
            <input
              className="w-full accent-[#1010ee]"
              type="range"
              min="35"
              max="100"
              value={quality}
              onChange={(event) => {
                setQuality(Number(event.target.value));
                processing();
              }}
            />
          </fieldset>
          {!selectedTemplate && (
            <fieldset className="m-0 border-0 border-b border-[#aebcff] py-4">
              <legend className="mb-3 text-[0.66rem] font-bold tracking-[0.08em] text-[#1010ee]">
                長辺の最大サイズ
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {longestOptions.map((size) => (
                  <button
                    type="button"
                    key={size}
                    className={`${choice} ${longestSide === size ? activeChoice : ""}`}
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
            <p className="m-0 border-b border-[#aebcff] py-4 text-[0.73rem] leading-6 text-[#1010ee]">
              TARGET OUTPUT /{" "}
              <strong className="font-extrabold text-[#ee00e8]">
                {selectedTemplate.width} × {selectedTemplate.height}px
              </strong>
            </p>
          )}
        </motion.aside>

        <motion.section
          className="col-span-full border-b border-[#1010ee] py-7 lg:py-9"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.16 }}
        >
          <PanelTitle index="PRESET" title="用途を選ぶ">
            <p className="ml-auto hidden text-[0.67rem] font-bold tracking-[0.1em] text-[#ec00e8] sm:block">
              SIZE + ASPECT / ONE CLICK
            </p>
          </PanelTitle>
          <div className="grid grid-cols-2 border border-[#aebcff] sm:grid-cols-3 lg:grid-cols-5">
            {templates.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`grid min-h-[106px] content-between gap-2 border-b border-r border-[#aebcff] p-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1010ee] sm:[&:nth-child(3n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(3n)]:border-r lg:[&:nth-child(5n)]:border-r-0 ${templateId === item.id ? "!bg-[#1010ee] !text-white hover:!bg-[#0808c8]" : "bg-[#eef0ff] text-[#1010ee] hover:bg-[#e3e6ff]"}`}
                onClick={() => selectTemplate(item.id)}
              >
                <strong className="text-[0.78rem] font-extrabold">{item.label}</strong>
                <span className="text-[0.68rem] font-medium">{item.detail}</span>
                <small className={templateId === item.id ? "!text-[#dfdfff]" : "text-[#1010ee]"}>
                  {item.width} × {item.height}
                </small>
              </button>
            ))}
          </div>
        </motion.section>

        <section className="col-span-full py-7 lg:py-9" aria-live="polite">
          <PanelTitle index="03" title="書き出す">
            <span
              className={`ml-auto size-2 ${status === "ready" ? "bg-[#1010ee]" : status === "error" ? "bg-[#ee00e8]" : "bg-[#aebcff]"}`}
            />
          </PanelTitle>
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                className="flex min-h-[130px] items-center gap-7 border-t border-[#aebcff] py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="min-w-[70px] text-[0.7rem] font-extrabold tracking-[0.14em] text-[#1010ee]">
                  STANDBY
                </span>
                <p className="m-0 text-[0.8rem] leading-6 text-[#1010ee]">
                  画像を選ぶと、ここに最適化後の結果が届きます。
                </p>
              </motion.div>
            )}
            {status === "processing" && (
              <motion.div
                key="processing"
                className="flex min-h-[130px] items-center gap-7 border-t border-[#aebcff] py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  className="block h-0.5 w-[70px] bg-[#ee00e8]"
                  animate={reduceMotion ? undefined : { scaleX: [1, 0.25, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                />
                <p className="m-0 text-[0.8rem] leading-6 text-[#1010ee]">
                  処理しています。プレビューを作成中です。
                </p>
              </motion.div>
            )}
            {status === "error" && (
              <motion.div
                key="error"
                className="flex min-h-[130px] items-center gap-7 border-t border-[#aebcff] py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="min-w-[70px] text-[0.7rem] font-extrabold tracking-[0.14em] text-[#ee00e8]">
                  ERROR
                </span>
                <p className="m-0 text-[0.8rem] leading-6 text-[#1010ee]" role="alert">
                  {message}
                </p>
              </motion.div>
            )}
            {status === "ready" && output && (
              <motion.div
                key="ready"
                className="grid gap-4 border-t border-[#aebcff] pt-5 sm:grid-cols-[130px_minmax(0,1fr)_auto] sm:items-center sm:gap-7"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="h-[110px] overflow-hidden bg-[#e9ebff] sm:row-span-2">
                  <img
                    className="size-full object-cover"
                    src={output.url}
                    alt="変換後のプレビュー"
                  />
                </div>
                <dl className="m-0 flex flex-wrap gap-x-7 gap-y-3">
                  <div>
                    <dt className="mb-1 text-[0.59rem] font-bold tracking-[0.08em] text-[#1010ee]">
                      SIZE
                    </dt>
                    <dd className="m-0 text-[0.76rem] font-extrabold text-[#1010ee]">
                      {formatBytes(output.blob.size)}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-[0.59rem] font-bold tracking-[0.08em] text-[#1010ee]">
                      RESOLUTION
                    </dt>
                    <dd className="m-0 text-[0.76rem] font-extrabold text-[#1010ee]">
                      {output.width} × {output.height}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-[0.59rem] font-bold tracking-[0.08em] text-[#1010ee]">
                      FORMAT
                    </dt>
                    <dd className="m-0 text-[0.76rem] font-extrabold text-[#1010ee]">
                      {format.split("/")[1].toUpperCase()}
                    </dd>
                  </div>
                </dl>
                <p
                  className={`m-0 text-[0.71rem] font-bold ${reduction && reduction > 0 ? "text-[#ee00e8]" : "text-[#1010ee]"}`}
                >
                  {reduction && reduction > 0
                    ? `元の画像より ${reduction}% 軽くなりました。`
                    : "この設定で書き出せます。"}
                </p>
                <button
                  type="button"
                  className="inline-flex min-h-[51px] items-center justify-center gap-2 bg-[#1010ee] px-4 text-[0.76rem] font-extrabold text-white transition-colors hover:bg-[#0808c8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1010ee] sm:col-start-3 sm:row-span-2"
                  onClick={download}
                >
                  <FileDown
                    aria-hidden="true"
                    className="size-[1.15rem] shrink-0"
                    strokeWidth={2.25}
                  />
                  ダウンロード
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </section>

      <footer className="mt-7 bg-[#1010ee] bg-[linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] px-[max(1.35rem,calc((100%_-_1220px)/2))] py-5 text-[0.63rem] font-bold tracking-[0.1em] text-white [background-size:48px_48px]">
        PIXEL SQUEEZE / NO UPLOADS / NO ACCOUNTS / LOCAL PIXELS
      </footer>
    </main>
  );
}
