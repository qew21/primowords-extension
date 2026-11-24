/* global chrome */
(() => {
  const STORAGE_KEY = 'uiLanguage';
  const messages = {
    'PrimoWords': 'PrimoWords',
    'PrimoWords · 查词收藏': 'PrimoWords · Dictionary',
    'PrimoWords 查词收藏': 'PrimoWords dictionary and saved words',
    'PrimoWords 设置': 'PrimoWords settings',
    '设置 · PrimoWords': 'Settings · PrimoWords',
    '收藏历史 · PrimoWords': 'Saved words · PrimoWords',
    '查词 · PrimoWords': 'Look up · PrimoWords',
    'PrimoWords · 查词': 'PrimoWords · Look up',
    'PrimoWords词典解析': 'PrimoWords dictionary parser',
    '查词': 'Look up',
    '收藏': 'Saved words',
    '设置': 'Settings',
    '收藏历史': 'Saved words',
    '主导航': 'Main navigation',
    '设置分页': 'Settings sections',
    'WORD WORKSPACE': 'WORD WORKSPACE',
    'PRIVACY NOTICE': 'PRIVACY NOTICE',
    '使用 PrimoWords 前，请确认数据处理方式': 'Review how data is handled before using PrimoWords',
    '只有在你主动查词或使用收藏功能时，扩展才会处理以下信息。请阅读后勾选同意，才能继续使用。': 'The extension handles the information below only when you actively look up or save a word. Read this notice and check the box to continue.',
    '网页查词与本机记录': 'Web lookup and local records',
    '你主动双击查词或使用右键查词时，扩展读取所选英文单词，并优先查询随扩展提供的离线词典。': 'When you double-click a word or choose lookup from the context menu, the extension reads that English word and checks its bundled offline dictionary first.',
    '网页双击或使用右键查词时，扩展读取当前网页地址和标题；双击还会读取包含所选词的句子，用于查词卡片及本机收藏来源记录。这些来源不会随查词发送给 PrimoWords。': 'When you double-click a word or use the context menu on a webpage, the extension reads the page URL and title. A double-click also reads the sentence containing the word. This information is used for the lookup card and local save history, and is not sent to PrimoWords with a lookup.',
    '离线词典没有词卡时，扩展会把所选单词发送给 Bing Dictionary 查询释义和音标；不会发送网页地址、标题或句子。': 'If the offline dictionary has no word card, the selected word is sent to Bing Dictionary for definitions and phonetics. The page URL, title, and sentence are not sent.',
    '本机收藏、历史、网页来源和句子保存在当前 Chrome 配置中，不会同步到开发者服务器。': 'Saved words, history, webpage sources, and sentences stay in this Chrome profile and are not synced to the developer’s server.',
    '收藏去向与其他功能': 'Save destinations and other features',
    '登录时，邮箱或手机号及密码通过 HTTPS 发送给配置的账号服务；密码不保存在扩展中。登录令牌保存在本机，并随账号操作发送给服务以完成验证；收藏到账号时会发送单词和收藏操作。': 'When you sign in, your email address or phone number and password are sent over HTTPS to the configured account service. The extension does not store your password. The sign-in token is stored locally and sent with account actions for authentication; saving to your account sends the word and save action.',
    '连接欧路后，只有在你选择欧路收藏时才会发送单词；网页句子同步默认开启，可在设置中关闭。欧路授权串保存在本机，并在欧路同步时发送给欧路服务用于验证。': 'After connecting Eudic, the word is sent only when you choose Eudic as the save destination. Webpage sentences are included by default and can be turned off in Settings. Your Eudic authorization token is stored locally and sent to Eudic for authentication when syncing.',
    'Bing Dictionary、账号服务和欧路也可能按各自隐私政策处理请求时间、IP 地址等必要的网络连接信息。': 'Bing Dictionary, the account service, and Eudic may also process necessary connection details, such as request time and IP address, under their respective privacy policies.',
    '朗读和 Chrome 本地翻译只在你主动使用时调用浏览器或设备能力；扩展不会因此把朗读文本或译文发送给 PrimoWords。': 'Speech and Chrome on-device translation use browser or device features only when you request them. The extension does not send the spoken text or translation to PrimoWords for these features.',
    '导出的 JSON、CSV 和 Anki TSV 文件只在你主动导出时下载到本机。': 'JSON, CSV, and Anki TSV files are downloaded to this device only when you choose to export them.',
    '查看账号服务隐私政策': 'Read the account service privacy policy',
    '我已阅读并同意以上数据处理方式': 'I have read and agree to the data practices above',
    '同意并继续': 'Agree and continue',
    '重试读取': 'Retry',
    '正在读取隐私确认状态…': 'Checking privacy consent…',
    '无法读取隐私确认状态，请重试。': 'Could not read privacy consent. Try again.',
    '隐私政策地址无效，请重新加载扩展后重试。': 'The privacy policy URL is invalid. Reload the extension and try again.',
    '无法读取隐私设置，请重试。': 'Could not read privacy settings. Try again.',
    '无法保存同意状态，请重试。': 'Could not save your consent. Try again.',
    '查清楚，再决定要不要收藏。': 'Look it up, then decide whether to save it.',
    '优先查询项目词卡与离线词典；没有匹配词卡时自动切换到必应词典。': 'Search project word cards and the offline dictionary first. If there is no matching card, look up the word in Bing Dictionary.',
    '优先查询项目词卡与离线词典；没有词卡时自动切换到必应词典。': 'Search project word cards and the offline dictionary first. If there is no matching card, look up the word in Bing Dictionary.',
    '查找英文单词': 'Look up an English word',
    '输入单词，例如 command': 'Enter a word, for example command',
    '阅读网页时，按住 Ctrl 双击正文单词可直接查词。': 'While reading a webpage, hold Ctrl and double-click a word to look it up.',
    '在网页上双击单词，也可以直接在原文旁查词。': 'Double-click a word on a webpage to look it up beside the text.',
    '本地词卡优先': 'Offline word cards first',
    '设置收藏去向': 'Set a save destination',
    '正在打开页面…': 'Opening page…',
    '重新加载': 'Reload',
    '查词收藏': 'Dictionary and saved words',
    '本地词卡优先，收藏去向由你选择': 'Offline word cards first. Choose where to save words.',
    'WEB DICTIONARY': 'WEB DICTIONARY',
    'YOUR WORD LIBRARY': 'YOUR WORD LIBRARY',
    'YOUR READING WORKSPACE': 'YOUR READING WORKSPACE',
    '收藏去向集中管理，网页查词方式单独设置；修改后会自动保存。': 'Manage save destinations here. Set webpage lookup behavior separately. Changes are saved automatically.',
    '把查词和收藏调成顺手的样子。': 'Make lookup and saving work the way you like.',
    '打开收藏历史': 'Open saved words',
    '按单词或日期找回收藏，查看释义和网页语境，也可以导出或整理记录。': 'Find saved words by word or date, review definitions and webpage context, and export or organize your records.',
    '来源记录保存在本机': 'Sources are stored on this device',
    '收藏分类': 'Saved word collections',
    '收藏历史页首分页': 'Saved words top pagination',
    '收藏历史分页': 'Saved words pagination',
    'PrimoWords 账号': 'PrimoWords account',
    '仅本机': 'This device only',
    '欧路词典': 'Eudic',
    '导入 JSON': 'Import JSON',
    '欧路词本': 'Eudic wordbook',
    '筛选收藏': 'Filter saved words',
    '单词支持完整匹配和前缀搜索，日期可以缩小范围。': 'Search by a full word or prefix, and optionally narrow the date range.',
    '清除筛选': 'Clear filters',
    '单词': 'Word',
    '输入单词或开头字母': 'Enter a word or prefix',
    '开始日期': 'From date',
    '结束日期': 'To date',
    '导出筛选结果': 'Export filtered results',
    '上一页': 'Previous',
    '下一页': 'Next',
    '删除收藏？': 'Delete saved word?',
    '取消': 'Cancel',
    '删除收藏': 'Delete saved word',
    '例句和译文': 'Example and translation',
    '从必应词典选例句': 'Choose an example from Bing Dictionary',
    '中文译文': 'Chinese translation',
    '用 Chrome 翻译': 'Translate with Chrome',
    '保存': 'Save',
    '导入仅本机收藏': 'Import device-only saved words',
    '导入': 'Import',
    'PrimoWords、欧路或本机': 'PrimoWords, Eudic, or this device',
    '查词方式': 'Lookup behavior',
    '网页操作与手动查询': 'Webpage controls and manual lookup',
    '查看、筛选与导出记录': 'View, filter, and export records',
    '设置项目': 'Settings',
    '管理新词默认保存位置。连接 PrimoWords 账号可同步词卡内单词；连接欧路可存入指定词本，也可只保存到本机。': 'Manage where new words are saved. Connect a PrimoWords account to sync words with cards, or connect Eudic to save words to a selected wordbook. You can also save words on this device only.',
    '连接账号后，同步有 PrimoWords 词卡的收藏': 'Connect your account to sync words with a PrimoWords card',
    '正在读取状态': 'Loading status',
    '登录你的PrimoWords 账号': 'Sign in to PrimoWords',
    '登录后可将有 PrimoWords 词卡的收藏同步到账号。': 'Sign in to sync saved words that have a PrimoWords card.',
    '邮箱或手机号': 'Email or phone number',
    '密码': 'Password',
    '输入密码': 'Enter password',
    '登录 PrimoWords': 'Sign in to PrimoWords',
    '当前登录账号': 'Signed-in account',
    'PrimoWords 词卡收藏会与此账号关联。': 'PrimoWords word card saves are linked to this account.',
    '退出登录': 'Sign out',
    '正在读取登录状态…': 'Checking sign-in status…',
    '清除本机登录记录': 'Clear saved sign-in on this device',
    '已登录时，查词卡片会显示昵称。登录状态会保存在这台浏览器中，退出后才会清除。': 'When signed in, your nickname appears on lookup cards. Your sign-in stays in this browser until you sign out.',
    '收藏去向': 'Save destinations',
    '选择新词的默认保存位置。每次查词后仍可按单词情况决定是否收藏。': 'Choose where new words are saved by default. You can decide whether to save each word after looking it up.',
    '默认收藏去向': 'Default save destination',
    '智能选择会将有词卡的单词同步到 PrimoWords 账号，其他单词保存到本机。连接欧路后，也可设为默认去向。': 'Smart routing syncs words with a PrimoWords card to your account and saves other words on this device. Once connected, Eudic can also be the default destination.',
    '新收藏保存到': 'Save new words to',
    '智能选择': 'Smart routing',
    '收藏时直接加入指定的欧路单词本': 'Save directly to a selected Eudic wordbook',
    '尚未连接': 'Not connected',
    'OpenAPI 授权串': 'OpenAPI authorization token',
    '获取授权串': 'Get authorization token',
    '粘贴欧路 NIS 授权串': 'Paste your Eudic NIS token',
    '读取词本': 'Load wordbooks',
    '选择目标词本': 'Choose a wordbook',
    '保存并设为默认': 'Save and set as default',
    '添加欧路新词时发送网页原句（最多 600 个字符）': 'Send the webpage sentence when adding a new Eudic word (up to 600 characters)',
    '断开欧路连接': 'Disconnect Eudic',
    '导出与 Anki 制卡': 'Export and Anki cards',
    '在收藏历史导出 JSON、CSV 或 Anki TSV；这里设置 TSV 卡片格式。': 'Export JSON, CSV, or Anki TSV from saved words. Configure the TSV card format here.',
    'Anki 导出': 'Anki export',
    '从收藏历史导出带释义与语境的 TSV 卡片': 'Export TSV cards with definitions and context from saved words',
    '按需导出': 'Export when needed',
    '导出卡片格式': 'Card export format',
    '基础卡片（单词 / 完整背面）': 'Basic card (word / full back)',
    '独立字段（适用于自定义笔记类型）': 'Separate fields (for custom note types)',
    '前往收藏历史导出 TSV': 'Export TSV from saved words',
    '网页查词': 'Webpage lookup',
    '选词之后，释义、发音和收藏都在当前阅读流程里完成。': 'Look up definitions, hear pronunciation, and save words without leaving your reading flow.',
    '双击英文单词': 'Double-click an English word',
    '按住 Ctrl 双击正文中的单词可直接查词；普通双击后点击鼠标旁的圆形PrimoWords 图标，也可以使用右键菜单。': 'Hold Ctrl and double-click a word in the page to look it up. You can also double-click and then select the round PrimoWords icon beside the pointer, or use the context menu.',
    '查看单词卡片': 'Review the word card',
    '查词卡片会显示释义、级别、词频和发音入口。': 'The lookup card shows definitions, level, frequency, and pronunciation.',
    '阅读后再决定收藏': 'Decide whether to save after reading',
    '有项目词卡的单词可同步到PrimoWords；其他单词可存到本机或已连接的欧路词本。': 'Words with project cards can sync to PrimoWords. Other words can be saved on this device or to a connected Eudic wordbook.',
    '部分网站会限制扩展访问。遇到这种情况，可以手动输入单词继续查词。': 'Some websites restrict extension access. If that happens, enter a word manually to look it up.',
    '打开手动查词': 'Open manual lookup',
    '界面语言': 'Interface language',
    '选择扩展界面语言；自动模式会跟随浏览器语言。': 'Choose the extension language. Automatic mode follows your browser language.',
    '显示语言': 'Display language',
    '界面语言已保存。': 'Interface language saved.',
    '{title} · PrimoWords': '{title} · PrimoWords',
    '已连接 · {bookName}': 'Connected · {bookName}',
    '欧路词本 · {bookName}': 'Eudic wordbook · {bookName}',
    '界面语言设置无效，请重新选择。': 'The interface language setting is invalid. Choose a language again.',
    '无法读取界面语言设置。': 'Could not read the interface language setting.',
    '自动（跟随浏览器）': 'Automatic (follow browser)',
    '简体中文': 'Simplified Chinese',
    'English': 'English',
    'PrimoWords 查词': 'PrimoWords lookup',
    '朗读单词': 'Speak word',
    '朗读 {word}': 'Speak {word}',
    '关闭查词': 'Close lookup',
    '收藏到 PrimoWords': 'Save to PrimoWords',
    '前往设置登录': 'Sign in in Settings',
    '暂无词频数据': 'No frequency data',
    '正在收藏…': 'Saving…',
    '已收藏': 'Saved',
    '收藏到本地': 'Save on this device',
    '已收藏到本地': 'Saved on this device',
    '收藏到欧路': 'Save to Eudic',
    '已收藏到欧路': 'Saved to Eudic',
    '已收藏到 PrimoWords': 'Saved to PrimoWords',
    '正在查词…': 'Looking up…',
    '正在查必应词典…': 'Looking up in Bing Dictionary…',
    '离线词典暂无释义。': 'No definition is available in the offline dictionary.',
    '离线词典': 'Offline dictionary',
    '必应词典': 'Bing Dictionary',
    '例句': 'Examples',
    '本地': 'this device',
    '收藏到{destination}': 'Save to {destination}',
    '将收藏词条：{word}{level}': 'Will save entry: {word}{level}',
    '（{level}）': ' ({level})',
    '已收藏到{destination}': 'Saved to {destination}',
    '用PrimoWords 查词': 'Look up with PrimoWords',
    '用PrimoWords 查词：{word}': 'Look up “{word}” with PrimoWords',
    '英': 'UK',
    '美': 'US',
    '删除': 'Delete',
    '删除收藏 {word}': 'Delete saved word {word}',
    '{word} · {action}': '{word} · {action}',
    '暂无释义': 'No definition available',
    '正在读取释义…': 'Loading definition…',
    '必应词典例句': 'Bing Dictionary example',
    '编辑译文': 'Edit translation',
    '翻译原句': 'Translate sentence',
    '添加例句': 'Add an example',
    '例句来源': 'Example source',
    '网页原句': 'Webpage sentence',
    '这条收藏没有网页原句。': 'This saved word has no webpage sentence.',
    '正在从必应词典查找双语例句…': 'Finding bilingual examples in Bing Dictionary…',
    '选择一条例句。': 'Choose an example.',
    '必应词典没有找到可用的双语例句。': 'Bing Dictionary found no bilingual examples.',
    '当前浏览器不支持 Chrome 本地翻译，可直接填写译文。': 'Chrome on this browser does not support on-device translation. You can enter a translation instead.',
    '正在检查英中语言包…': 'Checking English–Chinese translation support…',
    '首次使用需要下载英中语言包，点击翻译开始。': 'The English–Chinese language pack must be downloaded before first use. Click Translate to start.',
    '此设备或英中语言对暂不支持 Chrome 本地翻译，可直接填写译文。': 'This device or the English–Chinese language pair does not support Chrome on-device translation. You can enter a translation instead.',
    '无法检查 Chrome 本地翻译是否可用，仍可重试或直接填写译文。': 'Could not check Chrome on-device translation availability. Retry or enter a translation instead.',
    'Chrome 未允许开始下载英中语言包，请重新点击翻译按钮。': 'Chrome did not allow the English–Chinese language pack download. Click Translate again to retry.',
    'Chrome 本地翻译已取消，可重试或直接填写译文。': 'Chrome on-device translation was canceled. Retry or enter a translation instead.',
    'Chrome 本地翻译执行失败，可重试或直接填写译文。': 'Chrome on-device translation failed. Retry or enter a translation instead.',
    '英中语言包下载或启动失败，请检查网络后重试，或直接填写译文。': 'The English–Chinese language pack could not be downloaded or started. Check your connection and retry, or enter a translation instead.',
    '正在准备 Chrome 本地翻译…': 'Preparing Chrome on-device translation…',
    '正在准备英中语言包 · {percent}%': 'Preparing the English–Chinese language pack · {percent}%',
    '正在翻译…': 'Translating…',
    '可核对译文后保存。': 'Review the translation, then save.',
    'Chrome 本地翻译暂不可用，可重试或直接填写译文。': 'Chrome on-device translation is unavailable. Try again or enter a translation.',
    '正在保存…': 'Saving…',
    '无法连接PrimoWords 扩展，请刷新网页后重试。': 'Could not connect to PrimoWords. Refresh the page and try again.',
    '未收到PrimoWords 扩展的响应，请重试。': 'No response from PrimoWords. Try again.',
    '无法连接PrimoWords 服务，请检查网络后重试。': 'Could not connect to PrimoWords. Check your connection and try again.',
    'PrimoWords 服务拒绝了请求，请检查输入后重试。': 'PrimoWords rejected the request. Check your input and try again.',
    '登录已失效，请重新登录。': 'Your sign-in has expired. Sign in again.',
    '邮箱、手机号或密码有误。': 'The email, phone number, or password is incorrect.',
    '此账号没有收藏权限，请在PrimoWords App 中查看。': 'This account cannot save words. Check your access in the PrimoWords app.',
    '操作过于频繁，请稍后重试。': 'Too many requests. Try again later.',
    'PrimoWords 服务返回了无法识别的响应。': 'PrimoWords returned an unrecognized response.',
    '状态读取失败': 'Could not load status',
    '正在退出': 'Signing out',
    '正在登录': 'Signing in',
    '已登录': 'Signed in',
    '未登录': 'Not signed in',
    '请输入邮箱或手机号。': 'Enter your email or phone number.',
    '登录响应缺少账号或会话信息。': 'The sign-in response is missing account or session information.',
    '已登录。返回网页即可收藏。': 'Signed in. Return to a webpage to save words.',
    '已退出登录。': 'Signed out.',
    '无法清除登录状态，请重试。': 'Could not clear the sign-in. Try again.',
    '无法读取登录状态，请重新打开设置。': 'Could not read sign-in status. Reopen Settings.',
    '请先连接欧路词典。': 'Connect Eudic first.',
    '已保存设置。': 'Settings saved.',
    '已保存欧路语境设置。': 'Eudic context setting saved.',
    '请粘贴欧路 OpenAPI 授权页的 NIS 授权串。': 'Paste the NIS token from the Eudic OpenAPI authorization page.',
    '请先填写欧路授权串。': 'Enter your Eudic authorization token first.',
    '正在读取欧路词本…': 'Loading Eudic wordbooks…',
    '请允许扩展访问欧路后重试。': 'Allow this extension to access Eudic, then try again.',
    '欧路没有返回英文词本，请先在欧路创建词本。': 'Eudic returned no English wordbooks. Create one in Eudic first.',
    '请选择要收藏到的词本。': 'Choose a wordbook to save to.',
    '欧路已连接并设为默认收藏目标。': 'Eudic is connected and set as the default destination.',
    '已断开欧路连接。': 'Eudic disconnected.',
    '没有符合筛选条件的收藏。': 'No saved words match these filters.',
    '这里还没有收藏记录。': 'There are no saved words here yet.',
    '开始日期不能晚于结束日期。': 'The start date must be on or before the end date.',
    '显示保存在当前浏览器的词，登录后也不会上传。': 'Words saved in this browser. They are never uploaded, even when you sign in.',
    '显示从这台设备收藏到欧路的本机记录。': 'Words saved to Eudic from this device.',
    '显示当前账号从这台设备收藏到 PrimoWords 的词。网页和句子来源只保存在本机。': 'Words saved to PrimoWords from this device. Webpage and sentence sources stay on this device.',
    '正在读取本机历史…': 'Loading saved words from this device…',
    '登录后可查看此账号在本机的收藏记录。': 'Sign in to view this account’s saved words on this device.',
    '可在设置中连接欧路词本。': 'Connect an Eudic wordbook in Settings.',
    '无法打开设置，请点击工具栏的PrimoWords 图标。': 'Could not open Settings. Click the PrimoWords toolbar icon.',
    '正在准备导出…': 'Preparing export…',
    '没有可导出的收藏，请刷新后重试。': 'No saved words are available to export. Refresh and try again.',
    '正在读取文件…': 'Reading file…',
    '文件不是有效的 JSON，请重新选择。': 'This is not a valid JSON file. Choose another file.',
    '正在导入本机收藏…': 'Importing saved words to this device…',
    '这些单词已存在，未新增记录。': 'These words already exist. No records were added.',
    '已收藏「{word}」的例句和译文。': 'Saved the example and translation for “{word}”.',
    '已删除「{word}」的收藏。': 'Deleted the saved word “{word}”.',
    '将取消PrimoWords App 中「{word}」的收藏，并移除本机记录。': 'This will remove “{word}” from PrimoWords and delete its local record.',
    '只删除「{word}」的本机记录，欧路词本仍保留该词。': 'This will delete only the local record for “{word}”. The word will remain in Eudic.',
    '将在此浏览器中移除「{word}」的收藏记录。': 'This will remove the saved record for “{word}” from this browser.',
    '已保存「{word}」的例句和译文。': 'Saved the example and translation for “{word}”.',
    '无法显示本机收藏历史。请刷新后重试。 {error}': 'Could not display saved words on this device. Refresh and try again. {error}',
    '无法导出收藏，请重试。 {error}': 'Could not export saved words. Try again. {error}',
    '导入失败，请重试。 {error}': 'Import failed. Try again. {error}',
    '已发起 {count} 条收藏的 {format} 下载。其中 {untranslated} 条已有原句，尚无译文。': 'Started a {format} download for {count} saved {itemWord}. Original sentences without translations: {untranslated}.',
    '{word} 的例句和译文': 'Examples and translations for {word}',
    '收藏分类或账号已变更，请关闭后重新打开。': 'The collection or account changed. Close and reopen this dialog.',
    '第 {index} 条收藏格式无效，请检查文件后重试。': 'Saved word {index} has an invalid format. Check the file and try again.',
    '导出本栏 {count} 条': 'Export {count} {itemWord} in this collection',
    '{page} / {pages} 页 · {count} 条': 'Saved entries: {count} · page {page} of {pages}',
    '文件有 {total} 条，预计新增 {additions} 条，跳过重复记录 {duplicates} 条。': 'File entries: {total}. New: {additions}. Duplicates skipped: {duplicates}.',
    '另有 {count} 条': '{count} more',
    '已导入 {count} 条本机收藏。': 'Imported {count} {itemWord} to this device.',
    '已发起 {count} 条收藏的 {format} 下载。': 'Started a {format} download for {count} saved {itemWord}.',
    '其中 {count} 条已有原句，尚无译文。': '{count} items have an original sentence but no translation.',
    '无法连接PrimoWords 扩展，请刷新后重试。': 'Could not connect to PrimoWords. Refresh and try again.',
    '正在打开查词…': 'Opening lookup…',
    '正在打开收藏历史…': 'Opening saved words…',
    '正在打开设置…': 'Opening Settings…',
    '正在打开{page}…': 'Opening {page}…',
    '页面未能打开，请重新加载扩展后重试。': 'Could not open the page. Reload the extension and try again.',
    '自动': 'Automatic',
    '大学英语四级': 'CET-4',
    '大学英语六级': 'CET-6',
    '四级': 'CET-4',
    '六级': 'CET-6',
    '考研': 'Postgraduate exam',
    '托福': 'TOEFL',
    '雅思': 'IELTS',
    '专四': 'TEM-4',
    '专八': 'TEM-8',
    '高中': 'High school',
    '初中': 'Middle school',
    'PrimoWords 登录记录格式无效，请在设置中清除后重新登录。': 'The saved PrimoWords sign-in is invalid. Clear it in Settings and sign in again.',
    '收藏数据库事务已中止，请重试。': 'The saved words database transaction was aborted. Try again.',
    '旧版收藏格式无效，原记录已保留。': 'The legacy saved words format is invalid. The original records were kept.',
    '旧版收藏中存在无效记录，原记录已保留。': 'The legacy saved words contain an invalid record. The original records were kept.',
    '该收藏已在其他页面变更，请关闭窗口后重新打开。': 'This saved word changed in another page. Close and reopen this window.',
    '例句或译文格式无效。': 'The example or translation format is invalid.',
    '请选择由PrimoWords 扩展导出的 JSON 收藏文件。': 'Choose a JSON file exported by the PrimoWords extension.',
    '此文件包含其他收藏目标的记录。请选择「仅本机收藏」导出的文件。': 'This file contains records for other destinations. Choose a file exported from device-only saved words.',
    '无法连接欧路，请检查网络和扩展授权后重试。': 'Could not connect to Eudic. Check your connection and extension permissions, then try again.',
    '欧路授权无效，请在设置中重新连接。': 'The Eudic authorization is invalid. Reconnect in Settings.',
    '欧路暂时拒绝请求，请稍后重试。': 'Eudic temporarily rejected the request. Try again later.',
    '欧路未返回有效的词本列表，请重试。': 'Eudic did not return a valid wordbook list. Try again.',
    '欧路未返回有效的词条状态，请重试。': 'Eudic did not return a valid word status. Try again.',
    '欧路词本编号无效，请在设置中重新连接。': 'The Eudic wordbook ID is invalid. Reconnect in Settings.',
    '该词已在欧路收藏，保留了欧路已有的语境。': 'This word is already saved in Eudic. Its existing context was kept.',
    '收藏配置无效，请重新打开扩展设置。': 'The save destination settings are invalid. Reopen extension Settings.',
    '必应词典未返回可用词条。': 'Bing Dictionary returned no usable entry.',
    '必应词典未返回可用释义。': 'Bing Dictionary returned no usable definition.',
    '请输入或选中一个英文单词。': 'Enter or select an English word.',
    '暂时无法连接必应词典，请检查网络后重试。': 'Could not connect to Bing Dictionary. Check your connection and try again.',
    '只能朗读一个英文单词。': 'Only one English word can be spoken at a time.',
    '当前浏览器不支持 Chrome 英文朗读。': 'This browser does not support Chrome text-to-speech.',
    '朗读未完成，请检查系统英文语音后重试。': 'Speech did not finish. Check that an English voice is available and try again.',
    '无法播放单词，请检查系统英文语音后重试。': 'Could not play the word. Check that an English voice is available and try again.',
    '无法读取离线词典，请重新加载PrimoWords 扩展。': 'Could not read the offline dictionary. Reload the PrimoWords extension.',
    '该词已有PrimoWords 词卡或可查的原形词卡。': 'This word already has a PrimoWords card or a lookupable base-form card.',
    '无法启动必应词典查询，请重新加载扩展后重试。': 'Could not start Bing Dictionary lookup. Reload the extension and try again.',
    '必应词典未返回查询结果，请重试。': 'Bing Dictionary returned no lookup result. Try again.',
    '离线词典缺少对应的原形词卡，请重新加载或更新扩展。': 'The offline dictionary is missing the matching base-form card. Reload or update the extension.',
    '登录状态已变化，请重新确认。': 'Your sign-in changed. Confirm the action again.',
    '登录已失效，请前往设置重新登录。': 'Your sign-in has expired. Sign in again in Settings.',
    '服务端暂不支持收藏这个词，请更新扩展词表后重试。': 'The service does not support saving this word yet. Update the extension word list and try again.',
    '未收到预期的收藏确认，请在PrimoWords App 中核对。': 'The expected save confirmation was not received. Check the PrimoWords app.',
    '词已收藏到 PrimoWords，但本机历史写入失败。请重试补记。': 'The word was saved to PrimoWords, but its local history could not be recorded. Try recording it again.',
    '账号已切换，收藏已记在原账号。': 'The account changed. The word was saved to the previous account.',
    '欧路词本已切换，请重新确认。': 'The Eudic wordbook changed. Confirm the action again.',
    '已收藏到欧路，但本机历史写入失败，请重试补记。': 'The word was saved to Eudic, but its local history could not be recorded. Try recording it again.',
    '该欧路词本或词条已变更，请刷新后重试。': 'The Eudic wordbook or entry changed. Refresh and try again.',
    '收藏词条无效，请刷新历史。': 'The saved word is invalid. Refresh the saved words page.',
    '登录状态已变化，请重新登录后重试。': 'Your sign-in changed. Sign in again and retry.',
    '未收到PrimoWords 的取消收藏确认，请重试。': 'No confirmation was received from PrimoWords. Try removing the saved word again.',
    '已从PrimoWords 取消收藏，本机记录移除失败，请重试。': 'The word was removed from PrimoWords, but its local record could not be deleted. Try again.',
    '无法删除本机收藏，请重试。': 'Could not delete this device-only saved word. Try again.',
    '释义查询超出批量范围。': 'The definition lookup exceeds the batch limit.',
    '请在收藏历史页面选择例句。': 'Choose an example from the saved words page.',
    '请先在设置中连接欧路词本。': 'Connect an Eudic wordbook in Settings first.',
    '默认收藏目标已变化，请重新确认。': 'The default save destination changed. Confirm the action again.',
    '请在收藏历史页面删除。': 'Delete this word from the saved words page.',
    '无法识别的PrimoWords操作。': 'Unrecognized PrimoWords operation.',
    'PrimoWords 服务暂不可用（HTTP {status}），请稍后重试。': 'PrimoWords is temporarily unavailable (HTTP {status}). Try again later.',
    '欧路请求失败（HTTP {status}），请重试。': 'Eudic request failed (HTTP {status}). Try again.',
    '必应词典暂不可用（HTTP {status}），请稍后重试。': 'Bing Dictionary is temporarily unavailable (HTTP {status}). Try again later.',
    '无法写入本机收藏，请重试。 {error}': 'Could not save this word on this device. Try again. {error}',
    '无法准备本机收藏数据库，请刷新后重试。 {error}': 'Could not prepare the saved words database on this device. Refresh and try again. {error}',
  };

  const patterns = [
    [/^第 (\d+) 条收藏格式无效，请检查文件后重试。$/, match => `Saved word ${match[1]} has an invalid format. Check the file and try again.`],
    [/^欧路请求失败（HTTP (\d+)），请重试。$/, match => `Eudic request failed (HTTP ${match[1]}). Try again.`],
    [/^必应词典暂不可用（HTTP (\d+)），请稍后重试。$/, match => `Bing Dictionary is temporarily unavailable (HTTP ${match[1]}). Try again later.`],
    [/^PrimoWords 服务暂不可用（HTTP (\d+)），请稍后重试。$/, match => `PrimoWords is temporarily unavailable (HTTP ${match[1]}). Try again later.`],
    [/^无法写入本机收藏，请重试。 (.+)$/, match => `Could not save this word on this device. Try again. ${t(match[1])}`],
    [/^无法准备本机收藏数据库，请刷新后重试。 (.+)$/, match => `Could not prepare the saved words database on this device. Refresh and try again. ${t(match[1])}`],
  ];

  let preference = 'auto';
  let locale = resolveSystemLocale();
  let loadError = '';
  const listeners = new Set();
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const observedAttributes = ['title', 'placeholder', 'aria-label', 'aria-description', 'alt'];
  const contentSelector = '[data-i18n-skip], .definition, .history-definition, .sentence-text, .sentence-translation, .dictionary-senses, .example-pair, .history-record blockquote, .history-source-title, .card-nickname, #identity, #sentence-choices, #import-preview, #eudic-book, #eudic-history-book';

  function resolveSystemLocale() {
    const language = chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || 'zh-CN';
    return /^en(?:-|$)/i.test(language) ? 'en' : 'zh-CN';
  }

  function normalizePreference(value) {
    return value === 'en' || value === 'zh-CN' || value === 'auto' ? value : null;
  }

  function t(source, values) {
    let localized = locale === 'en' && Object.hasOwn(messages, source) ? messages[source] : source;
    if (locale === 'en' && localized === source) {
      for (const [pattern, replacement] of patterns) {
        const match = source.match(pattern);
        if (match) {
          localized = replacement(match);
          break;
        }
      }
    }
    if (!values) return localized;
    return localized.replace(/\{([a-zA-Z]+)\}/g, (match, key) => {
      if (!Object.hasOwn(values, key)) return match;
      return String(values[key]);
    });
  }

  function translatedText(node) {
    const original = originalText.get(node) ?? node.nodeValue;
    const source = typeof original === 'string' ? original : original.source;
    const values = typeof original === 'string' ? undefined : original.values;
    if (source == null) return;
    if (!originalText.has(node)) originalText.set(node, original);
    const leading = source.match(/^\s*/)?.[0] ?? '';
    const trailing = source.match(/\s*$/)?.[0] ?? '';
    const content = source.slice(leading.length, source.length - trailing.length || undefined);
    const replacement = t(content, values);
    const value = `${leading}${replacement}${trailing}`;
    if (node.nodeValue !== value) node.nodeValue = value;
  }

  function translatedAttributes(element) {
    if (element.matches?.(contentSelector)) return;
    let originals = originalAttributes.get(element);
    if (!originals) {
      originals = new Map();
      originalAttributes.set(element, originals);
    }
    for (const name of observedAttributes) {
      if (!element.hasAttribute(name)) continue;
      if (!originals.has(name)) originals.set(name, element.getAttribute(name));
      const original = originals.get(name);
      const source = typeof original === 'string' ? original : original.source;
      const values = typeof original === 'string' ? undefined : original.values;
      const value = t(source, values);
      if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }
  }

  function localize(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translatedText(root);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE) translatedAttributes(root);
    const documentRoot = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
    if (documentRoot?.nodeType === Node.ELEMENT_NODE && documentRoot.tagName === 'HTML') {
      documentRoot.lang = locale;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        return parent?.closest(`script, style, textarea, input, ${contentSelector}`) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) translatedText(node);
    if (root.querySelectorAll) {
      for (const element of root.querySelectorAll(observedAttributes.map(name => `[${name}]`).join(','))) {
        translatedAttributes(element);
      }
    }
  }

  function setText(node, source, values) {
    const text = document.createTextNode('');
    node.replaceChildren(text);
    originalText.set(text, values ? { source, values } : source);
    translatedText(text);
  }

  function setAttribute(element, name, source, values) {
    let originals = originalAttributes.get(element);
    if (!originals) {
      originals = new Map();
      originalAttributes.set(element, originals);
    }
    originals.set(name, values ? { source, values } : source);
    element.setAttribute(name, t(source, values));
  }

  function publish() {
    if (globalThis.document?.documentElement && location.protocol === 'chrome-extension:') localize(document);
    for (const listener of listeners) listener({ preference, locale, error: loadError });
  }

  async function setPreference(value) {
    const normalized = normalizePreference(value);
    if (!normalized) throw new Error('Unsupported interface language.');
    if (!await globalThis.primowordsPrivacyConsent?.hasConsent()) {
      throw new Error('请先阅读并同意PrimoWords 的数据处理说明。');
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    preference = normalized;
    locale = normalized === 'auto' ? resolveSystemLocale() : normalized;
    loadError = '';
    publish();
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener({ preference, locale, error: loadError });
    return () => listeners.delete(listener);
  }

  async function getContentState() {
    const accepted = await globalThis.primowordsPrivacyConsent?.hasConsent();
    if (!accepted) return { accepted: false, preference: 'auto' };
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (!Object.hasOwn(result, STORAGE_KEY)) return { accepted: true, preference: 'auto' };
    const value = normalizePreference(result[STORAGE_KEY]);
    if (!value) throw new Error('界面语言设置无效，请重新选择。');
    return { accepted: true, preference: value };
  }

  function applyContentState(state) {
    if (typeof state?.accepted !== 'boolean') throw new Error('无法读取隐私确认状态。');
    const value = state.accepted ? normalizePreference(state.preference) : 'auto';
    if (!value) throw new Error('界面语言设置无效，请重新选择。');
    preference = value;
    locale = value === 'auto' ? resolveSystemLocale() : value;
    loadError = '';
    publish();
    return state.accepted;
  }

  globalThis.primowordsI18n = {
    t, localize, setText, setAttribute, subscribe, setPreference,
    getPreference: () => preference, getLocale: () => locale,
    getContentState, applyContentState,
  };

  if (globalThis.document && location.protocol === 'chrome-extension:') {
    const start = () => localize(document);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') translatedText(record.target);
        else if (record.type === 'attributes') translatedAttributes(record.target);
        else for (const node of record.addedNodes) localize(node);
      }
    });
    observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: observedAttributes,
    });
  }

  async function loadPreference() {
    try {
      if (location.protocol !== 'chrome-extension:') {
        const response = await chrome.runtime.sendMessage({ type: 'content-ui-state' });
        if (response?.error) throw new Error(response.error);
        if (!response?.value) throw new Error('无法读取界面语言设置。');
        applyContentState(response.value);
        return;
      }
      if (!await globalThis.primowordsPrivacyConsent?.hasConsent()) {
        preference = 'auto';
        locale = resolveSystemLocale();
        loadError = '';
        publish();
        return;
      }
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (!Object.hasOwn(result, STORAGE_KEY)) {
        preference = 'auto';
        locale = resolveSystemLocale();
        loadError = '';
        return publish();
      }
      const value = normalizePreference(result[STORAGE_KEY]);
      if (!value) {
        loadError = '界面语言设置无效，请重新选择。';
        return publish();
      }
      preference = value;
      locale = value === 'auto' ? resolveSystemLocale() : value;
      loadError = '';
      publish();
    } catch (error) {
      loadError = error?.message || '无法读取界面语言设置。';
      publish();
    }
  }

  chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local' || (!changes[STORAGE_KEY] && !changes[globalThis.primowordsPrivacyConsent?.STORAGE_KEY])) return;
    void loadPreference();
  });
  void loadPreference();

})();
