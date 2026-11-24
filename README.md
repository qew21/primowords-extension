# PrimoWords Chrome Extension

Manifest V3 扩展：阅读网页时查英文词、查看释义和词频、朗读，并把单词收藏到本机、PrimoWords 账号或欧路词本。支持收藏历史、JSON/CSV 导出和 Anki TSV。

源码和构建脚本采用 MIT 许可证。随包词典有单独的来源说明和 ECDICT 许可证；分发扩展时请保留这些文件。

## 构建

需要 Node.js 24 或更新版本，无需安装第三方 npm 依赖。

```powershell
Copy-Item .env.example .env
npm test
npm run build
```

构建产物位于 `build/`。在 Chrome 打开 `chrome://extensions`，启用开发者模式并加载该目录。构建使用 `.env` 配置账号服务、接口路径、隐私政策地址和词典路径；CI 从 `.env.example` 加载同一配置。

## 隐私

网页选词需要扩展访问当前网站。离线查词、本机收藏、历史记录和导出均在本机完成；账号收藏、必应查词及欧路同步按用户操作发送对应内容。欧路新词网页原句同步默认开启，可在扩展设置中关闭。详情见 [隐私说明](PRIVACY.md)。

首次使用时，扩展会先展示数据处理说明并要求确认；确认前不会启用网页查词、收藏、历史或账号功能。

## English

PrimoWords is a Manifest V3 Chrome extension for English lookup and vocabulary saving. Source and build scripts are MIT licensed. The bundled dictionary has separate provenance and ECDICT license notices; keep them when redistributing the extension. Build with Node.js 24 after copying `.env.example` to `.env`.
