<template>
  <!-- 证书导出对话框 -->
  <el-dialog
    v-model="visible"
    title="区块链存证证书"
    width="720px"
    :before-close="handleClose"
    class="cert-dialog"
    @opened="onDialogOpened"
  >
    <!-- 证书正文：外层可滚动，内层 cert-page 为完整证书用于展示与导出 -->
    <div class="cert-wrapper">
      <div ref="certPageRef" class="cert-page">
        <!-- 顶部标题栏 -->
        <div class="cert-header">
          <div class="cert-logo">⛓</div>
          <div class="cert-title-block">
            <div class="cert-title">区块链存证证书</div>
            <div class="cert-subtitle">Blockchain Copyright Certificate · ConfChain</div>
          </div>
          <div class="cert-seal">CERTIFIED</div>
        </div>

        <div class="cert-divider" />

        <!-- 声明文本 -->
        <p class="cert-declare">
          兹证明以下学术论文已在 <strong>ConfChain 联盟区块链</strong> 上完成版权存证，
          该存证记录具有时间戳、不可篡改等技术保证，可作为版权归属的电子凭证。
        </p>

        <!-- 稿件信息 -->
        <div class="cert-section">
          <div class="cert-field">
            <span class="cert-label">论文标题</span>
            <span class="cert-value cert-title-val">{{ paper.title }}</span>
          </div>
          <div class="cert-field" v-if="paper.keywords">
            <span class="cert-label">关&emsp;&emsp;键&emsp;&emsp;词</span>
            <span class="cert-value">{{ paper.keywords }}</span>
          </div>
        </div>

        <div class="cert-divider-dashed" />

        <!-- 存证技术信息 -->
        <div class="cert-section">
          <div class="cert-field">
            <span class="cert-label">文件哈希（SHA-256）</span>
            <span class="cert-value cert-mono">{{ paper.fileHash }}</span>
          </div>
          <div class="cert-field">
            <span class="cert-label">链上交易哈希（TxHash）</span>
            <span class="cert-value cert-mono">{{ paper.txHash }}</span>
          </div>
          <div class="cert-field">
            <span class="cert-label">区&emsp;&emsp;&emsp;&emsp;块&emsp;&emsp;高&emsp;&emsp;度</span>
            <span class="cert-value">{{ paper.blockHeight ?? '-' }}</span>
          </div>
          <div class="cert-field">
            <span class="cert-label">存&emsp;&emsp;&emsp;&emsp;证&emsp;&emsp;时&emsp;&emsp;间</span>
            <span class="cert-value">{{ certifiedAtText }}</span>
          </div>
          <div class="cert-field" v-if="paper.certifySimulated">
            <span class="cert-label">链上状态</span>
            <span class="cert-value" style="color:#e6a23c;font-weight:600">模拟存证（链节点不可达时自动降级，数据本地有效）</span>
          </div>
        </div>

        <!-- 底部：QR码 + 验证说明（用 img 显示二维码便于弹窗与 PDF 中都能正确展示） -->
        <div class="cert-footer">
          <div class="cert-qr-block">
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              class="cert-qr-img"
              alt="验证二维码"
              width="120"
              height="120"
            />
            <div class="cert-qr-tip">扫码验证真伪</div>
          </div>
          <div class="cert-verify-block">
            <div class="cert-verify-title">如何验证本证书</div>
            <ol class="cert-verify-steps">
              <li>扫描左侧二维码，或访问：</li>
              <li><span class="cert-verify-url">{{ verifyUrl }}</span></li>
              <li>在页面中输入 SHA-256 哈希值或上传原始文件</li>
              <li>系统将自动比对区块链上的存证记录</li>
            </ol>
            <div class="cert-notice">
              本证书由 ConfChain 系统自动生成，有效性以区块链链上记录为准。
            </div>
          </div>
        </div>

        <!-- 底部签章 -->
        <div class="cert-bottom">
          <div class="cert-chain-name">ConfChain 学术会议版权存证平台</div>
          <div class="cert-gen-time">证书生成时间：{{ generatedAt }}</div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" :loading="pdfLoading" @click="debouncedDownloadPdf">
        下载 PDF
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import debounce from "lodash-es/debounce";
import QRCode from "qrcode";
import { computed, ref } from "vue";

interface PaperCertInfo {
  title: string;
  keywords: string;
  fileHash: string | null;
  txHash: string | null;
  blockHeight: number | null;
  certifiedAt: string | null;
  certifySimulated?: boolean | null;
}

const props = defineProps<{
  modelValue: boolean;
  paper: PaperCertInfo;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const certPageRef = ref<HTMLElement>();
const qrDataUrl = ref<string>("");
const pdfLoading = ref(false);

// 证书中的验证链接：优先使用环境变量（便于局域网扫码），否则用当前访问地址
const verifyUrl = computed(() => {
  const base =
    (import.meta.env.VITE_VERIFY_BASE_URL as string)?.trim() ||
    window.location.origin;
  return `${base.replace(/\/$/, "")}/verify?fileHash=${props.paper.fileHash ?? ""}`;
});

const certifiedAtText = computed(() => {
  if (!props.paper.certifiedAt) return "-";
  return new Date(props.paper.certifiedAt).toLocaleString("zh-CN");
});

const generatedAt = computed(() => new Date().toLocaleString("zh-CN"));

async function renderQrCode() {
  if (!props.paper.fileHash) return;
  try {
    qrDataUrl.value = await QRCode.toDataURL(verifyUrl.value, {
      width: 120,
      margin: 1,
      color: { dark: "#1a1f2e", light: "#ffffff" },
    });
  } catch {
    qrDataUrl.value = "";
  }
}

/** 弹窗完全打开后再渲染二维码，避免首次打开不显示；先清空再生成避免显示上一份稿件的码 */
function onDialogOpened() {
  qrDataUrl.value = "";
  renderQrCode();
}

/** 防抖：防止连续点击导出 PDF */
const debouncedDownloadPdf = debounce(function doDownload() {
  downloadPdf();
}, 600, { leading: true, trailing: false });

function handleClose() {
  visible.value = false;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").slice(0, 80) || "证书";
}

async function downloadPdf() {
  const el = certPageRef.value;
  if (!el) return;
  pdfLoading.value = true;
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollY: 0,
      scrollX: 0,
    });
    const imgW = canvas.width;
    const imgH = canvas.height;
    const pdf = new jsPDF({
      orientation: imgW > imgH ? "landscape" : "portrait",
      unit: "px",
      format: [imgW, imgH],
    });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
    const fileName = `区块链存证证书_${sanitizeFileName(props.paper.title)}.pdf`;
    pdf.save(fileName);
  } finally {
    pdfLoading.value = false;
  }
}
</script>

<style scoped>
.cert-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.cert-wrapper {
  padding: 0;
  overflow: auto;
  max-height: 75vh;
  min-height: 400px;
}

.cert-page {
  width: 100%;
  min-width: 620px;
  padding: 40px 48px;
  background: #fff;
  border-top: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
  box-sizing: border-box;
}

.cert-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.cert-logo {
  font-size: 40px;
  line-height: 1;
}

.cert-title-block {
  flex: 1;
}

.cert-title {
  font-size: 26px;
  font-weight: 800;
  color: #1a1f2e;
  letter-spacing: 2px;
}

.cert-subtitle {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
  letter-spacing: 1px;
}

.cert-seal {
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  background: #1a1f2e;
  padding: 6px 14px;
  border-radius: 4px;
  letter-spacing: 2px;
}

.cert-divider {
  height: 2px;
  background: linear-gradient(90deg, #1a1f2e, #409eff, #1a1f2e);
  margin: 0 0 18px;
}

.cert-divider-dashed {
  border-top: 1px dashed #dcdfe6;
  margin: 14px 0;
}

.cert-declare {
  font-size: 13px;
  color: #303133;
  line-height: 1.8;
  text-align: justify;
  background: #f5f7ff;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 18px;
  border-left: 4px solid #409eff;
}

.cert-section {
  margin-bottom: 4px;
}

.cert-field {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
  gap: 12px;
}

.cert-label {
  font-size: 12px;
  color: #909399;
  min-width: 170px;
  white-space: nowrap;
  padding-top: 1px;
}

.cert-value {
  font-size: 13px;
  color: #303133;
  word-break: break-all;
  flex: 1;
  line-height: 1.6;
}

.cert-title-val {
  font-weight: 700;
  font-size: 15px;
  color: #1a1f2e;
}

.cert-mono {
  font-family: "Courier New", monospace;
  font-size: 11px;
  color: #303133;
}

.cert-footer {
  display: flex;
  gap: 24px;
  margin-top: 20px;
  align-items: flex-start;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.cert-qr-block {
  text-align: center;
  min-width: 130px;
}

.cert-qr-img {
  display: block;
  width: 120px;
  height: 120px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  object-fit: contain;
}

.cert-qr-tip {
  font-size: 11px;
  color: #909399;
  margin-top: 6px;
}

.cert-verify-block {
  flex: 1;
}

.cert-verify-title {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 8px;
}

.cert-verify-steps {
  font-size: 12px;
  color: #606266;
  line-height: 2;
  padding-left: 16px;
}

.cert-verify-url {
  font-family: monospace;
  font-size: 11px;
  color: #409eff;
  word-break: break-all;
}

.cert-notice {
  font-size: 11px;
  color: #909399;
  margin-top: 10px;
  line-height: 1.5;
}

.cert-bottom {
  margin-top: 24px;
  padding-top: 14px;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cert-chain-name {
  font-size: 13px;
  font-weight: 700;
  color: #1a1f2e;
}

.cert-gen-time {
  font-size: 11px;
  color: #909399;
}
</style>
