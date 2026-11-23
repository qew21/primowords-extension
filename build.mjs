import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(projectRoot, 'src');
const wordPattern = /^[a-z]+(?:[.'-][a-z]+)*$/;
const environmentKeys = [
  'PRIMOWORDS_API_ORIGIN',
  'PRIMOWORDS_AUTH_TOKEN_ENDPOINT',
  'PRIMOWORDS_WORD_STUDY_ENDPOINT',
  'PRIMOWORDS_PRIVACY_POLICY_URL',
  'PRIMOWORDS_DICTIONARY_PATH',
];

export function parseDotEnv(content) {
  const values = {};
  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) throw new Error(`.env 第 ${index + 1} 行格式无效。`);
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value.includes('#')) {
      value = value.slice(0, value.indexOf('#')).trimEnd();
    }
    values[match[1]] = value;
  }
  return values;
}

export async function loadBuildEnvironment({ envPath = join(projectRoot, '.env'), environment = process.env } = {}) {
  let fileValues = {};
  try {
    fileValues = parseDotEnv(await readFile(envPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`无法读取构建配置文件：${error.message}`);
  }
  return Object.fromEntries(environmentKeys.map(key => [key, environment[key] ?? fileValues[key]]));
}

export function normalizeApiOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('API 地址缺失。请在 .env 中设置 PRIMOWORDS_API_ORIGIN。');
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('API 地址格式无效。');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('API 地址必须是无路径、无凭据、无查询参数的 HTTPS 源。');
  }
  return url.origin;
}

export function normalizeApiEndpoint(value, variableName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`接口路径缺失。请在 .env 中设置 ${variableName}。`);
  }
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    throw new Error(`${variableName} 必须是以单个斜杠开头的站内接口路径。`);
  }
  let url;
  try {
    url = new URL(candidate, 'https://primowords.invalid');
  } catch {
    throw new Error(`${variableName} 格式无效。`);
  }
  if (url.origin !== 'https://primowords.invalid' || url.search || url.hash || url.pathname !== candidate) {
    throw new Error(`${variableName} 必须是无查询参数和片段的站内接口路径。`);
  }
  return candidate;
}

export function normalizePrivacyPolicyUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('隐私政策地址缺失。请在 .env 中设置 PRIMOWORDS_PRIVACY_POLICY_URL。');
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('隐私政策地址格式无效。');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('隐私政策地址必须是无凭据、无查询参数的 HTTPS URL。');
  }
  return url.href;
}

function validRank(value) {
  return value === null || (Number.isSafeInteger(value) && value > 0);
}

export function validateDictionary(dictionary) {
  if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary) ||
      dictionary.version !== 3 || !dictionary.entries || typeof dictionary.entries !== 'object' ||
      Array.isArray(dictionary.entries)) {
    throw new Error('词典格式无效：需要 version 3 和 entries 对象。');
  }

  const entries = Object.entries(dictionary.entries);
  if (entries.length === 0) throw new Error('词典没有词条，拒绝生成不可用的扩展包。');

  for (const [word, entry] of entries) {
    if (!wordPattern.test(word) || word !== word.toLowerCase() || !Array.isArray(entry) || entry.length !== 7) {
      throw new Error(`词条格式无效：${word}`);
    }
    const [definition, phonetic, canonical, level, cocaRank, bncRank, documentedBase] = entry;
    if (typeof definition !== 'string' || typeof phonetic !== 'string' || typeof canonical !== 'string' ||
        (canonical !== '' && !wordPattern.test(canonical)) ||
        (level !== null && typeof level !== 'string') || !validRank(cocaRank) || !validRank(bncRank) ||
        typeof documentedBase !== 'string' || (documentedBase !== '' && !wordPattern.test(documentedBase))) {
      throw new Error(`词条字段无效：${word}`);
    }
  }
  return entries.length;
}

function noticePathFor(dictionaryPath) {
  if (!dictionaryPath.toLowerCase().endsWith('.json')) {
    throw new Error('词典文件必须使用 .json 扩展名。');
  }
  return dictionaryPath.slice(0, -'.json'.length) + '.LICENSE.txt';
}

export async function buildExtension({ dictionaryPath, apiOrigin, authTokenEndpoint, wordStudyEndpoint, privacyPolicyUrl, outputDir }) {
  if (typeof dictionaryPath !== 'string' || !dictionaryPath.trim()) {
    throw new Error('词典路径缺失。请在 .env 中设置 PRIMOWORDS_DICTIONARY_PATH。');
  }
  const normalizedApiOrigin = normalizeApiOrigin(apiOrigin);
  const apiEndpoints = {
    authToken: normalizeApiEndpoint(authTokenEndpoint, 'PRIMOWORDS_AUTH_TOKEN_ENDPOINT'),
    wordStudy: normalizeApiEndpoint(wordStudyEndpoint, 'PRIMOWORDS_WORD_STUDY_ENDPOINT'),
  };
  const normalizedPrivacyPolicyUrl = normalizePrivacyPolicyUrl(privacyPolicyUrl);
  const resolvedDictionary = isAbsolute(dictionaryPath) ? resolve(dictionaryPath) : resolve(projectRoot, dictionaryPath);
  const resolvedNotice = noticePathFor(resolvedDictionary);
  const resolvedOutput = resolve(outputDir ?? join(projectRoot, 'build'));
  if (resolvedOutput === projectRoot || resolvedOutput === sourceRoot || resolvedOutput.startsWith(`${sourceRoot}${sep}`)) {
    throw new Error('构建输出目录不能覆盖项目源码。');
  }

  let dictionary;
  try {
    dictionary = JSON.parse(await readFile(resolvedDictionary, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取词典 JSON：${error.message}`);
  }
  const wordCount = validateDictionary(dictionary);

  let dictionaryNotice;
  try {
    dictionaryNotice = await readFile(resolvedNotice, 'utf8');
  } catch {
    throw new Error(`缺少词典来源与授权说明：${resolvedNotice}`);
  }
  if (!dictionaryNotice.trim()) throw new Error('词典来源与授权说明为空，拒绝生成扩展包。');

  const ecdictLicensePath = join(projectRoot, 'data', 'ECDICT-LICENSE.txt');
  let ecdictLicense;
  try {
    ecdictLicense = await readFile(ecdictLicensePath, 'utf8');
    if (!ecdictLicense.trim()) throw new Error('ECDICT 许可证文件为空。');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const manifestPath = join(sourceRoot, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  if (manifest.manifest_version !== 3) throw new Error('扩展 manifest 必须使用 Manifest V3。');
  if (typeof packageJson.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(packageJson.version)) {
    throw new Error('package.json 版本必须是 Chrome 扩展支持的数字格式。');
  }
  if (manifest.version !== packageJson.version) {
    throw new Error('Chrome 扩展版本与 package.json 不一致，请同步更新版本号。');
  }
  manifest.host_permissions = [`${normalizedApiOrigin}/*`, 'https://www.bing.com/*'];

  await mkdir(resolvedOutput, { recursive: true });
  for (const name of await readdir(sourceRoot)) {
    if (name === 'manifest.json' || name === 'README.md') continue;
    await cp(join(sourceRoot, name), join(resolvedOutput, name), { recursive: true });
  }
  await Promise.all([
    writeFile(join(resolvedOutput, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(join(resolvedOutput, 'dictionary.json'), `${JSON.stringify(dictionary)}\n`),
    writeFile(join(resolvedOutput, 'config.js'), [
      `export const API_ORIGIN = ${JSON.stringify(normalizedApiOrigin)};`,
      `export const API_ENDPOINTS = Object.freeze(${JSON.stringify(apiEndpoints)});`,
      `export const PRIVACY_POLICY_URL = ${JSON.stringify(normalizedPrivacyPolicyUrl)};`,
      '',
    ].join('\n')),
    writeFile(join(resolvedOutput, 'dictionary.LICENSE.txt'), dictionaryNotice),
    cp(join(projectRoot, 'LICENSE'), join(resolvedOutput, 'LICENSE')),
    cp(join(projectRoot, 'PRIVACY.md'), join(resolvedOutput, 'PRIVACY.md')),
    ...(ecdictLicense ? [cp(ecdictLicensePath, join(resolvedOutput, 'ECDICT-LICENSE.txt'))] : []),
  ]);
  return { outputDir: resolvedOutput, wordCount };
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--dictionary', '--out'].includes(key)) {
      throw new Error(`无法识别参数：${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`参数缺少值：${key}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const environment = await loadBuildEnvironment();
    const result = await buildExtension({
      dictionaryPath: args['--dictionary'] ?? environment.PRIMOWORDS_DICTIONARY_PATH,
      apiOrigin: environment.PRIMOWORDS_API_ORIGIN,
      authTokenEndpoint: environment.PRIMOWORDS_AUTH_TOKEN_ENDPOINT,
      wordStudyEndpoint: environment.PRIMOWORDS_WORD_STUDY_ENDPOINT,
      privacyPolicyUrl: environment.PRIMOWORDS_PRIVACY_POLICY_URL,
      outputDir: args['--out'] ?? join(projectRoot, 'build'),
    });
    console.info(`扩展已生成：${result.outputDir}（${result.wordCount.toLocaleString()} 个词条）`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
