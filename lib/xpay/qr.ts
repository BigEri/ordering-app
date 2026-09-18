import QRCode from "qrcode";

export async function xpayQrDataUrl(payUrl: string): Promise<string> {
  return QRCode.toDataURL(payUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#111111", light: "#ffffff" },
  });
}
