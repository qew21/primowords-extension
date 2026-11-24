import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildExtension,
  loadBuildEnvironment,
  normalizeApiEndpoint,
  normalizeApiOrigin,
  parseDotEnv,
  validateDictionary,
} from '../build.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(projectRoot, 'test', 'fixtures', 'dictionary.sample.json');

test('API origin accepts only a clean HTTPS origin', () => {
  assert.equal(normalizeApiOrigin('https://example.org/'), 'https://example.org');
  assert.throws(() => normalizeApiOrigin('http://example.org'), /HTTPS/);
  assert.throws(() => normalizeApiOrigin('https://example.org/api'), /HTTPS/);
  assert.throws(() => normalizeApiOrigin('https://user:pass@example.org'), /HTTPS/);
});

test('API endpoints must be safe relative paths', () => {
  assert.equal(normalizeApiEndpoint('/alpha', 'TEST_ENDPOINT'), '/alpha');
  assert.throws(() => normalizeApiEndpoint('https://example.org/alpha', 'TEST_ENDPOINT'), /站内接口路径/);
  assert.throws(() => normalizeApiEndpoint('//example.org/alpha', 'TEST_ENDPOINT'), /站内接口路径/);
  assert.throws(() => normalizeApiEndpoint('/alpha?next=external', 'TEST_ENDPOINT'), /查询参数和片段/);
});

test('.env parsing supports quoted values and process environment overrides', async () => {
  const parsed = parseDotEnv('A=one\nB="two words"\n# ignored\n');
  assert.deepEqual(parsed, { A: 'one', B: 'two words' });
  const envPath = join(projectRoot, 'test', 'fixtures', 'build.test.env');
  await writeFile(envPath, 'PRIMOWORDS_API_ORIGIN=https://file.example\nPRIMOWORDS_DICTIONARY_PATH=./data.json\n');
  try {
    const environment = await loadBuildEnvironment({
      envPath,
      environment: { PRIMOWORDS_API_ORIGIN: 'https://ci.example' },
    });
    assert.equal(environment.PRIMOWORDS_API_ORIGIN, 'https://ci.example');
    assert.equal(environment.PRIMOWORDS_DICTIONARY_PATH, './data.json');
  } finally {
    await rm(envPath, { force: true });
  }
});

test('service host and account API paths are configured only in the sample env file', async () => {
  const allowed = new Set([
    '.env',
    '.env.example',
    join('data', 'dictionary.json'),
  ]);
  const sampleConfig = parseDotEnv(await readFile(join(projectRoot, '.env.example'), 'utf8'));
  const serviceHost = new URL(sampleConfig.PRIMOWORDS_API_ORIGIN).origin;
  const authEndpoint = sampleConfig.PRIMOWORDS_AUTH_TOKEN_ENDPOINT;
  const studyEndpoint = sampleConfig.PRIMOWORDS_WORD_STUDY_ENDPOINT;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'build') await visit(path);
        continue;
      }
      const relative = path.slice(projectRoot.length + 1);
      if (allowed.has(relative) || entry.name.endsWith('.png')) continue;
      const content = await readFile(path, 'utf8');
      assert.ok(!content.includes(serviceHost), `${relative} must read the service host from build configuration`);
      assert.ok(!content.includes(authEndpoint), `${relative} must read the auth endpoint from build configuration`);
      assert.ok(!content.includes(studyEndpoint), `${relative} must read the study endpoint from build configuration`);
    }
  }
  await visit(projectRoot);
});

test('dictionary validation rejects missing and malformed data visibly', () => {
  assert.throws(() => validateDictionary({ version: 3, entries: {} }), /没有词条/);
  assert.throws(() => validateDictionary({ version: 2, entries: { word: [] } }), /version 3/);
  assert.throws(() => validateDictionary({
    version: 3,
    entries: { word: ['definition', '', '', null, 0, null, ''] },
  }), /字段无效/);
});

test('valid version 3 dictionary is counted', async () => {
  const dictionary = JSON.parse(await readFile(fixture, 'utf8'));
  assert.equal(validateDictionary(dictionary), 1);
});

test('build refuses a dictionary without its license notice', async () => {
  const inputDir = await mkdtemp(join(tmpdir(), 'primowords-extension-data-'));
  const outputDir = join(inputDir, 'output');
  const dictionaryPath = join(inputDir, 'dictionary.json');
  try {
    await writeFile(dictionaryPath, await readFile(fixture));
    await assert.rejects(buildExtension({
      dictionaryPath,
      apiOrigin: 'https://example.org',
      authTokenEndpoint: '/auth',
      wordStudyEndpoint: '/words',
      privacyPolicyUrl: 'https://example.org/privacy',
      outputDir,
  }), /缺少词典来源与授权说明/);
  } finally {
    await rm(inputDir, { recursive: true, force: true });
  }
});

test('standalone build writes manifest, runtime files, data and license notice', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'primowords-extension-build-'));
  try {
    const result = await buildExtension({
      dictionaryPath: fixture,
      apiOrigin: 'https://example.org',
      authTokenEndpoint: '/auth',
      wordStudyEndpoint: '/words',
      privacyPolicyUrl: 'https://example.org/privacy',
      outputDir,
    });
    const manifest = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8'));
    const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
    const dictionary = JSON.parse(await readFile(join(outputDir, 'dictionary.json'), 'utf8'));
    assert.equal(result.wordCount, 1);
    assert.equal(manifest.version, packageJson.version);
    assert.equal(manifest.host_permissions[0], 'https://example.org/*');
    assert.ok(manifest.host_permissions.includes('https://www.bing.com/*'));
    assert.equal(dictionary.version, 3);
    const config = await readFile(join(outputDir, 'config.js'), 'utf8');
    assert.match(config, /https:\/\/example\.org/);
    assert.match(config, /"authToken":"\/auth"/);
    assert.match(config, /"wordStudy":"\/words"/);
    assert.match(config, /PRIVACY_POLICY_URL/);
    assert.match(await readFile(join(outputDir, 'dictionary.LICENSE.txt'), 'utf8'), /Synthetic test fixture/);
    const requiredFiles = [
      manifest.background.service_worker,
      manifest.action.default_icon['16'],
      manifest.action.default_icon['32'],
      ...Object.values(manifest.icons),
      ...manifest.content_scripts.flatMap(script => script.js),
      ...manifest.web_accessible_resources.flatMap(resource => resource.resources),
    ];
    for (const file of new Set(requiredFiles)) await access(join(outputDir, file));
    assert.ok((await readFile(join(outputDir, 'background.js'), 'utf8')).length > 0);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
