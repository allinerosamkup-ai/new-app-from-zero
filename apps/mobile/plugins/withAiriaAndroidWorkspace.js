const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

function withExplicitAndroidEntryFile(config) {
  return withAppBuildGradle(config, (pluginConfig) => {
    const resolvedEntryFileLine =
      'entryFile = file(["node", "-e", "require(\'expo/scripts/resolveAppEntry\')", projectRoot, "android", "absolute"].execute(null, rootDir).text.trim())';
    const explicitEntryFileLine = 'entryFile = file("$projectRoot/index.js")';
    const reactNativePathBlock = [
      'def airiaWorkspaceReactNativeDir = file("$rootDir/../../../node_modules/react-native")',
      'def airiaLocalReactNativeDir = file("$rootDir/../node_modules/react-native")',
      'ext.REACT_NATIVE_NODE_MODULES_DIR = airiaWorkspaceReactNativeDir.exists() ? airiaWorkspaceReactNativeDir.absolutePath : airiaLocalReactNativeDir.absolutePath',
    ].join('\n');

    pluginConfig.modResults.contents = pluginConfig.modResults.contents.replace(
      resolvedEntryFileLine,
      explicitEntryFileLine,
    );

    if (!pluginConfig.modResults.contents.includes('airiaWorkspaceReactNativeDir')) {
      pluginConfig.modResults.contents = pluginConfig.modResults.contents.replace(
        /\nreact \{\n/,
        `\n${reactNativePathBlock}\n\nreact {\n`,
      );
    }

    return pluginConfig;
  });
}

function withWorkspaceReactNativePath(config) {
  return withProjectBuildGradle(config, (pluginConfig) => {
    const reactNativePathLine =
      '        REACT_NATIVE_NODE_MODULES_DIR = file("$rootDir/../../../node_modules/react-native").exists() ? file("$rootDir/../../../node_modules/react-native").absolutePath : file("$rootDir/../node_modules/react-native").absolutePath';
    const rootExtBlock = [
      'ext {',
      '    REACT_NATIVE_NODE_MODULES_DIR = file("$rootDir/../../../node_modules/react-native").exists()',
      '        ? file("$rootDir/../../../node_modules/react-native").absolutePath',
      '        : file("$rootDir/../node_modules/react-native").absolutePath',
      '}',
    ].join('\n');

    if (!pluginConfig.modResults.contents.includes('REACT_NATIVE_NODE_MODULES_DIR')) {
      pluginConfig.modResults.contents = pluginConfig.modResults.contents.replace(
        /(\s+ext \{\n)/,
        `$1${reactNativePathLine}\n`,
      );

      pluginConfig.modResults.contents = pluginConfig.modResults.contents.replace(
        /\nallprojects \{\n/,
        `\n${rootExtBlock}\n\nallprojects {\n`,
      );
    }

    return pluginConfig;
  });
}

module.exports = function withAiriaAndroidWorkspace(config) {
  config = withWorkspaceReactNativePath(config);
  config = withExplicitAndroidEntryFile(config);
  return config;
};
