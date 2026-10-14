# OpenRouter 生成的导入导出示例

2026-10-12 使用用户授权的 OpenRouter 连接、`cohere/north-mini-code:free` 生成。剧本台词由模型输出，演出形象由验收脚本绑定到内置成步堂/真宵；人物名字和故事为原创。

| 作品 | 类型 | 场景/台词 | 作品包 | 原始 JSON | 成功请求 token |
| --- | --- | --- | --- | --- | --- |
| 旧书中的空白页 | 书店日常 | 2 场 / 14 句 | [bookshop.yahari](bookshop.yahari) | [JSON](bookshop.yahari-project.json) | 1,336 |
| 未知之信 | 轻悬疑 | 2 场 / 14 句 | [last-train.yahari](last-train.yahari) | [JSON](last-train.yahari-project.json) | 1,103 |
| 后台大搜索 | 后台喜剧 | 2 场 / 12 句 | [rehearsal.yahari](rehearsal.yahari) | [JSON](rehearsal.yahari-project.json) | 1,238 |

在编辑器「目录 → 导入项目」选择上述文件，确认预览后打开。`.yahari` 文件来自浏览器实际导出；两种文件的章节、人物、场景、台词与编译结果已比对一致。可导入后修改台词、动作或人物形象。

三份成功请求合计 3,677 token，返回费用均为 0。详见 [generation-report.json](generation-report.json)，该统计不含失败/重试请求。密钥不在这些文件中。

生成脚本 `scripts/generate-openrouter-examples.mjs` 从标准输入读取 Key，仅请求指定免费模型，验证后再保存作品；`scripts/check-openrouter-examples.mjs` 验证原始 JSON 和真实导出包。
