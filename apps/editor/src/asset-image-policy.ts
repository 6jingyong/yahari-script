/** Browser upload/generation policy. Built-in source art keeps its separate build policy. */
export const IMAGE_POLICY = Object.freeze({ inputBytes:10_000_000,inputDimension:8192,longestSide:768,
  quality:0.76,fallbackScale:0.8,fallbackQuality:0.65,maxDataUrlChars:900_000 });
export function fittedImageSize(width:number,height:number):{width:number;height:number} {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>IMAGE_POLICY.inputDimension||height>IMAGE_POLICY.inputDimension)
    throw new Error('图片每边须为 1–8192 像素。');
  const scale=Math.min(1,IMAGE_POLICY.longestSide/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export const IMAGE_HELP_HTML=`<h2>素材格式、尺寸与压缩</h2>
  <p>上传与 AI 图片使用同一处理规则。保存前可预览结果，建议另外保留原始高清文件。</p>
  <table><thead><tr><th>用途</th><th>建议尺寸 / 格式</th></tr></thead><tbody>
  <tr><td>角色立绘与动作</td><td>PNG / WebP 透明底；建议半身构图、512×384 或 768×576，动作保持相同画布、人物位置与比例，完整保留头发和手势</td></tr>
  <tr><td>场景背景</td><td>建议 768×576（4:3）；PNG、JPEG、WebP 均可</td></tr>
  <tr><td>舞台前景</td><td>768×576 透明 PNG / WebP；用来遮挡角色下半身</td></tr>
  <tr><td>内置动作图集</td><td>24 名角色统一半身像；单格和头像 512×384，4×2 图集 2048×768，腰线 y=372；编辑时拆成单张动作</td></tr>
  </tbody></table>
  <h3>默认处理</h3><ol>
  <li>手动文件须小于或等于 10 MB，每边不超过 8192 像素。支持 PNG、JPEG、WebP；SVG / GIF 不作为上传素材。</li>
  <li>最长边缩至 768 像素；保留比例，小图片保持原尺寸，透明底保留。图片不强制裁成 4:3。</li>
  <li>浏览器编码为 WebP，quality=0.76（质量参数，不代表压缩至原来的 76%）。</li>
  <li>若 data URL 超过 900,000 字符，再将宽高缩为 80%，以 WebP quality=0.65 重编码一次；仍超限则拒绝保存。</li>
  <li>浏览器若没有 WebP 编码能力会返回 PNG，大小限制继续生效。IndexedDB 按图片内容去重；素材包存二进制，导出不会再压缩一遍。</li></ol>
  <p>内置发行图的构建规则另为 WebP quality=88、method=6，保持裁切布局后的尺寸与透明通道；头像取相同动作页的常态格。默认人名采用完整的早期民间译名，旧名称也可搜索；本机调整和作品中的自定义昵称保留。立绘与场景预览下显示实际尺寸，动作图片悬停可查看尺寸。</p>
  <p>声音素材目前为程序合成的音效和音乐参数，不是 MP3/WAV 文件；在声音页调整音量、速度和波形。素材包来源、作者、许可需按真实情况保留。</p>`;
