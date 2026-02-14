"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Download,
  X
} from "lucide-react";
import QRCode from "react-qr-code";
import { LinkItem, ColorClasses } from "../types";

interface LinksTabProps {
  copiedId: string | null;
  copyToClipboard: (linkId: string, text: string) => void;
  getColorClasses: (color: string) => ColorClasses;
  LINKS: LinkItem[];
}

export default function LinksTab({
  copiedId,
  copyToClipboard,
  getColorClasses,
  LINKS,
}: LinksTabProps) {
  const [selectedQrLink, setSelectedQrLink] = useState<LinkItem | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQrCode = () => {
    if (!selectedQrLink) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const qrSvg = qrRef.current?.querySelector("svg");

    if (!ctx || !qrSvg) return;

    // Set canvas dimensions
    const width = 600;
    const height = 800;
    canvas.width = width;
    canvas.height = height;

    // Draw background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0f766e"); // teal-700
    gradient.addColorStop(1, "#134e4a"); // teal-900
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw header text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AGAPE '26", width / 2, 100);

    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#ccfbf1"; // teal-100
    ctx.fillText("Singles Weekend", width / 2, 140);

    // Draw white card for QR
    const cardSize = 400;
    const cardX = (width - cardSize) / 2;
    const cardY = 200;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardSize, cardSize, 24);
    ctx.fill();

    // Draw QR Code
    const svgData = new XMLSerializer().serializeToString(qrSvg);
    const img = new Image();
    img.onload = () => {
      // Draw QR centered in card
      const qrSize = 320;
      const qrX = cardX + (cardSize - qrSize) / 2;
      const qrY = cardY + (cardSize - qrSize) / 2;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Draw footer text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(selectedQrLink.title, width / 2, cardY + cardSize + 60);

      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#99f6e4"; // teal-200
      ctx.fillText("Scan to access", width / 2, cardY + cardSize + 90);

      // Trigger download
      const link = document.createElement("a");
      link.download = `agape26-${selectedQrLink.id}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-lg bg-teal-100">
              <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
            </div>
            Event Links
          </h2>
          <p className="text-slate-500 mb-4 sm:mb-6 text-sm sm:text-base">
            Copy and share these links with attendees, vendors, and team members.
          </p>

          <div className="space-y-3 sm:space-y-4">
            {LINKS.map((link) => {
              const colors = getColorClasses(link.color);
              const fullUrl =
                typeof window !== "undefined"
                  ? `${window.location.origin}${link.path}`
                  : link.path;

              return (
                <div
                  key={link.id}
                  className={`p-3 sm:p-4 rounded-lg sm:rounded-xl ${colors.bg} border ${colors.border} transition-all hover:shadow-md`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${colors.iconBg} w-fit`}>
                      <link.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-slate-900 font-semibold text-base sm:text-lg">{link.title}</h3>
                          <p className="text-slate-500 text-xs sm:text-sm mt-1">{link.description}</p>
                        </div>
                      </div>

                      <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row sm:items-center gap-2 bg-white/70 rounded-lg p-2 border border-slate-200">
                        <code className="text-xs text-slate-600 flex-1 truncate">
                          {fullUrl}
                        </code>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => setSelectedQrLink(link)}
                            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white text-slate-600 border border-slate-200 text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors`}
                            title="Show QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">QR Code</span>
                          </button>
                          <button
                            onClick={() =>
                              copyToClipboard(link.id, `${link.shareText}\n${fullUrl}`)
                            }
                            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg ${colors.iconBg} ${colors.text} text-xs sm:text-sm font-medium hover:opacity-80 transition-opacity`}
                          >
                            {copiedId === link.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                Copy
                              </>
                            )}
                          </button>
                          <a
                            href={link.path}
                            target="_blank"
                            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs sm:text-sm font-medium hover:bg-slate-200 transition-colors`}
                          >
                            <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Open
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {selectedQrLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900">QR Code</h3>
                <button
                  onClick={() => setSelectedQrLink(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center gap-6">
                <div className="text-center">
                  <h4 className="text-xl font-bold text-slate-900 mb-1">{selectedQrLink.title}</h4>
                  <p className="text-slate-500 text-sm">Scan to access</p>
                </div>

                <div
                  ref={qrRef}
                  className="bg-white p-4 rounded-xl border-2 border-slate-100 shadow-sm"
                >
                  <QRCode
                    value={
                      typeof window !== "undefined"
                        ? `${window.location.origin}${selectedQrLink.path}`
                        : selectedQrLink.path
                    }
                    size={200}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox={`0 0 256 256`}
                  />
                </div>

                <button
                  onClick={downloadQrCode}
                  className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
                >
                  <Download className="w-5 h-5" />
                  Download Image
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
