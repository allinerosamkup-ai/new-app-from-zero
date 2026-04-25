const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const path = require('path');

const config = getDefaultConfig(__dirname);
const monorepoRoot = path.resolve(__dirname, '../..');
const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const blockPath = (...segments) =>
  new RegExp(`${path.resolve(...segments).split(/[\\/]+/).map(escapeRegex).join('[/\\\\]')}.*`);

config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

config.watchFolders = [path.resolve(monorepoRoot, 'node_modules')];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.blockList = exclusionList([
  blockPath(monorepoRoot, '.tmp'),
  blockPath(monorepoRoot, '.git'),
  blockPath(__dirname, 'android', '.gradle'),
  blockPath(__dirname, 'android', 'build'),
  blockPath(__dirname, 'android', 'app', 'build'),
  blockPath(__dirname, '.expo'),
  blockPath(monorepoRoot, 'apps', 'web', 'dist'),
  new RegExp(`${path.resolve(monorepoRoot, 'apps', 'web', 'public').split(/[\\/]+/).map(escapeRegex).join('[/\\\\]')}.*\\.apk$`),
  new RegExp(`${path.resolve(monorepoRoot, 'share').split(/[\\/]+/).map(escapeRegex).join('[/\\\\]')}.*\\.html$`),
  /[/\\]node_modules[/\\].*[/\\]android[/\\]build[/\\].*/,
  /[/\\]node_modules[/\\].*[/\\]\.gradle[/\\].*/,
]);

module.exports = config;
