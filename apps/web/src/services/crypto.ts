/**
 * 使用浏览器原生 SubtleCrypto API 对字符串做 SHA-256 哈希。
 * 在登录/注册时对密码做哈希后再传输，避免明文密码在网络上传输。
 *
 * 注意：此措施需配合 HTTPS 使用才能保证完整的传输安全。
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
