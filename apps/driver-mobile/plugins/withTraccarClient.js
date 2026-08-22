// Ownership: NIU Driver native build setup. Keep the Traccar Kotlin and iOS requirements reproducible during Expo prebuild.

const { withInfoPlist, withProjectBuildGradle } = require('expo/config-plugins');

const KOTLIN_METADATA_FLAG = '-Xskip-metadata-version-check';

function withTraccarClient(config) {
  config = withProjectBuildGradle(config, (project) => {
    if (project.modResults.language !== 'groovy' || project.modResults.contents.includes(KOTLIN_METADATA_FLAG)) {
      return project;
    }

    project.modResults.contents += `\nallprojects {\n    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {\n        compilerOptions {\n            freeCompilerArgs.add("${KOTLIN_METADATA_FLAG}")\n        }\n    }\n}\n`;
    return project;
  });

  return withInfoPlist(config, (ios) => {
    ios.modResults.NSLocationWhenInUseUsageDescription ??=
      'NIU Driver uses your location only while you are sharing an assigned trip with dispatch.';
    ios.modResults.NSLocationAlwaysAndWhenInUseUsageDescription ??=
      'NIU Driver uses your location only while you are sharing an assigned trip with dispatch.';
    ios.modResults.NSMotionUsageDescription ??=
      'NIU Driver uses motion signals to improve stop detection while a trip is actively shared.';

    const modes = ios.modResults.UIBackgroundModes ?? [];
    ios.modResults.UIBackgroundModes = modes.includes('location') ? modes : [...modes, 'location'];
    return ios;
  });
}

module.exports = withTraccarClient;
