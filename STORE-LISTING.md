# Chrome Web Store 上架材料

## 中文（简体）

**名称**：PrimoWords · 查词收藏  
**简短说明**：网页双击查英文单词，查看离线词卡、释义、音标与词频，并收藏到本机、PrimoWords 或欧路。  
**类别建议**：教育

**详细说明**

PrimoWords 帮你在阅读网页时查英文单词、查看词卡，并把想记住的词收藏起来。

- 双击英文单词，在原文旁打开查词卡；也可使用 Ctrl+双击、右键菜单或扩展页面手动查词。
- 优先查随扩展提供的离线词卡；没有词卡时查询 Bing Dictionary，查看释义和音标。
- 查看词卡级别、COCA/BNC 词频，并使用 Chrome 朗读单词。
- 收藏到当前浏览器、本机 PrimoWords 账号或已连接的欧路词本。
- 在本机收藏历史中搜索、按日期筛选、查看网页语境，导出 JSON、CSV 或 Anki TSV。

隐私说明：网页查词会处理你主动选中的单词。网页双击或右键查词时，网页地址和标题用于查词卡片及本机来源记录；双击还会读取所在句子。它们不会随查词发送给 PrimoWords 或 Bing。离线词卡没有匹配项时，扩展只把所选单词发送给 Bing Dictionary。登录及账号收藏会向配置的账号服务发送必要的账号凭据或收藏信息。选择欧路收藏时会向欧路发送单词；原句同步默认开启，可在扩展设置中关闭。本机收藏历史不会同步到开发者服务器。首次使用前，扩展会在界面中说明数据处理方式并要求明确同意。

## English

**Name**: PrimoWords · Dictionary and Saved Words  
**Short description**: Look up words on webpages, hear pronunciation, and save them locally, to PrimoWords, or Eudic.  
**Suggested category**: Education

**Detailed description**

PrimoWords helps you look up English words while reading webpages and save the words you want to remember.

- Double-click an English word to open a lookup card beside the text. Ctrl-double-click, the context menu, and manual lookup are also available.
- Search the bundled offline dictionary first. If there is no matching word card, look up definitions and phonetics in Bing Dictionary.
- Review word-card levels and COCA/BNC frequency, and hear words with Chrome text-to-speech.
- Save words to this browser, a PrimoWords account, or a connected Eudic wordbook.
- Search and filter local saved-word history by date, review webpage context, and export JSON, CSV, or Anki TSV.

Privacy: Lookup processes the English word you select. A webpage double-click or context-menu lookup reads the page URL and title; a double-click also reads the sentence. This source information is used for the lookup card and local source history, and is not sent to PrimoWords or Bing with the lookup. If the offline dictionary has no matching card, only the selected word is sent to Bing Dictionary. Sign-in and account saves send the necessary credentials or save details to the configured account service. When you choose Eudic, the word is sent to Eudic; sentence syncing is on by default and can be disabled in Settings. These services may process request time and IP address under their own privacy policies. Local saved-word history is not synced to the developer's server. The extension displays its data practices and asks for explicit consent before first use.

## Privacy Practices 与权限说明

**Single purpose**：帮助用户在网页阅读时查询英语单词，并将单词收藏到用户选择的目标位置。

**权限理由**

- `contextMenus`：提供右键查词入口。
- `storage`：保存本机收藏、来源历史、设置、账号登录令牌和欧路授权串。
- `offscreen`：在扩展本机解析 Bing Dictionary 返回的词典页面内容。
- `tts`：通过 Chrome TTS 朗读单词。
- 网页访问权限：在 HTTP/HTTPS 网页上响应用户主动的双击选词并显示查词入口；扩展不在后台收集浏览记录。
- 构建配置中的账号服务与 Bing 主机权限：分别用于登录/账号收藏和缺少离线词卡时的单词查词。
- 可选欧路主机权限：仅在用户连接欧路后用于同步单词及设置允许发送的网页原句。

**Remote code**：No。扩展执行逻辑、词典及处理代码随包发布；外部服务只提供按需请求的词典或账号数据，不提供可执行代码。

**用户数据类型建议**：账号邮箱/手机号与身份验证信息；用户选中的网页内容及网页 URL/标题；本机收藏和来源历史。CWS 表单应按实际数据流勾选，明确本机处理与第三方服务传输；不要仅按“上传到开发者服务器”判断是否属于处理。

可在 Dashboard 对照勾选个人身份信息、身份验证信息、网站内容、网页浏览活动等实际类别；账号标识/密码仅为登录服务所需，密码不在扩展中持久保存。

## 提交前检查

- 使用与 `v0.2.21` 对应的 GitHub Release ZIP；检查包内版本、隐私政策链接和构建配置。
- Store icon 使用 `src/icon.png`（128×128）。还需至少一张反映当前实际界面的商店截图（1280×800 或 640×400）；截图尚未制作。
- 将配置中的隐私政策地址设置为长期稳定、无需登录即可访问的公开页面，并确认内容覆盖本页列出的网页选词、本机历史和第三方服务数据流。当前地址虽可通过 HTTPS 访问，但页面未说明扩展特有的数据处理，提交前必须补齐或更换为扩展专用公开隐私政策。
- 在 Developer Dashboard 填写 single purpose、逐项权限理由、数据处理类型、Limited Use 声明和隐私政策 URL；隐私字段必须与实际扩展行为一致。
- 发布账号需要启用两步验证。首次提交前在 Dashboard 完成分发范围、支持信息和截图等必填项。
