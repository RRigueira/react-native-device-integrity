// Dev-only: embed Frida Gadget in the example app to exercise hooking
// detection (scenario A05) on a stock iPhone. Off unless FRIDA_GADGET=1 is
// set when running prebuild. Never ship a build made with it.
//
//   FRIDA_GADGET=1 yarn example expo prebuild --platform ios
//
// The gadget is read from example/frida/FridaGadget.dylib (gitignored) or
// from FRIDA_GADGET_PATH. Device builds only: the simulator is untouched.
const fs = require('node:fs');
const path = require('node:path');
const {
  IOSConfig,
  createRunOncePlugin,
  withDangerousMod,
  withXcodeProject,
} = require('expo/config-plugins');

const GADGET = 'FridaGadget.dylib';
const CONFIG = 'FridaGadget.config';
const FOLDER = 'FridaGadget';
const PHASE_NAME = '[Frida] Embed Frida Gadget';
const LDFLAGS_DEVICE = '"OTHER_LDFLAGS[sdk=iphoneos*]"';

// Start the app normally; the gadget still listens for `frida -U Gadget`.
// code_signing "required": on a stock iPhone with no debugger attached, iOS
// kills the process (SIGTRAP inside FridaGadget.dylib) as soon as the gadget
// tries to patch code. Required mode never writes to code pages; the trade-off
// is that Interceptor is unavailable unless the app is launched under LLDB.
const GADGET_CONFIG = {
  interaction: {
    type: 'listen',
    address: '127.0.0.1',
    port: 27042,
    on_load: 'resume',
  },
  code_signing: 'required',
};

function isEnabled() {
  return process.env.FRIDA_GADGET === '1';
}

function gadgetSource(projectRoot) {
  return (
    process.env.FRIDA_GADGET_PATH ?? path.join(projectRoot, 'frida', GADGET)
  );
}

const withGadgetFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest;
      const source = gadgetSource(projectRoot);
      if (!fs.existsSync(source)) {
        throw new Error(
          `FRIDA_GADGET=1 but ${source} does not exist. Download ` +
            'frida-gadget-<version>-ios-universal.dylib.xz from ' +
            'https://github.com/frida/frida/releases, unpack it and save it ' +
            `as example/frida/${GADGET} (or set FRIDA_GADGET_PATH).`
        );
      }
      const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const dir = path.join(platformProjectRoot, projectName, FOLDER);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(source, path.join(dir, GADGET));
      fs.writeFileSync(
        path.join(dir, CONFIG),
        `${JSON.stringify(GADGET_CONFIG, null, 2)}\n`
      );
      runWithoutDebugger(platformProjectRoot, projectName);
      return cfg;
    },
  ]);

// Xcode's Run would otherwise attach LLDB, which (1) stalls launch while it
// loads symbols for the 40 MB gadget, (2) raises debugger_attached, and (3)
// injects Xcode's view-debugging dylib via DYLD_INSERT_LIBRARIES
// (hooking_dyld_insert). Release also bundles the JS, so no Metro is needed.
function runWithoutDebugger(platformProjectRoot, projectName) {
  const scheme = path.join(
    platformProjectRoot,
    `${projectName}.xcodeproj`,
    'xcshareddata',
    'xcschemes',
    `${projectName}.xcscheme`
  );
  if (!fs.existsSync(scheme)) return;
  const xml = fs
    .readFileSync(scheme, 'utf8')
    .replace(/<LaunchAction\b[^>]*>/, (tag) =>
      tag
        .replace(
          /buildConfiguration = "[^"]*"/,
          'buildConfiguration = "Release"'
        )
        .replace(
          /selectedDebuggerIdentifier = "[^"]*"/,
          'selectedDebuggerIdentifier = ""'
        )
        .replace(
          /selectedLauncherIdentifier = "[^"]*"/,
          'selectedLauncherIdentifier = "Xcode.IDEFoundation.Launcher.PosixSpawn"'
        )
    );
  fs.writeFileSync(scheme, xml);
}

function embedScript(folder) {
  return [
    'set -e',
    'if [ "$PLATFORM_NAME" != "iphoneos" ]; then exit 0; fi',
    `SRC="$PROJECT_DIR/${folder}"`,
    'DST="$TARGET_BUILD_DIR/$FRAMEWORKS_FOLDER_PATH"',
    'mkdir -p "$DST"',
    `cp -f "$SRC/${GADGET}" "$DST/${GADGET}"`,
    // Gadget looks for its config one level above Frameworks (the .app root).
    `cp -f "$SRC/${CONFIG}" "$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/${CONFIG}"`,
    'if [ "$CODE_SIGNING_ALLOWED" != "NO" ] && [ -n "$EXPANDED_CODE_SIGN_IDENTITY" ]; then',
    `  codesign --force --sign "$EXPANDED_CODE_SIGN_IDENTITY" --timestamp=none "$DST/${GADGET}"`,
    'fi',
  ].join('\\n'); // pbxproj stores script newlines as \n escapes
}

const withGadgetProject = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      cfg.modRequest.projectRoot
    );
    const folder = `${projectName}/${FOLDER}`;
    const { uuid: targetId, target } =
      IOSConfig.XcodeUtils.getApplicationNativeTarget({
        project,
        projectName,
      });

    // Link the gadget on device builds so dyld loads it at launch.
    const configList =
      project.pbxXCConfigurationList()[target.buildConfigurationList];
    const configs = project.pbxXCBuildConfigurationSection();
    for (const { value } of configList.buildConfigurations) {
      const settings = configs[value].buildSettings;
      const base = settings.OTHER_LDFLAGS ?? ['"$(inherited)"'];
      const flags = (Array.isArray(base) ? base : [base]).filter(
        (flag) => !String(flag).includes(GADGET)
      );
      settings[LDFLAGS_DEVICE] = [
        ...flags,
        `"\\"$(PROJECT_DIR)/${folder}/${GADGET}\\""`,
      ];
    }

    // Copy + sign the gadget into Frameworks/ (idempotent across prebuilds).
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const exists = Object.values(phases).some(
      (phase) =>
        typeof phase === 'object' && String(phase.name).includes(PHASE_NAME)
    );
    if (!exists) {
      project.addBuildPhase(
        [],
        'PBXShellScriptBuildPhase',
        PHASE_NAME,
        targetId,
        {
          shellPath: '/bin/sh',
          shellScript: embedScript(folder),
          inputPaths: [
            `"$(PROJECT_DIR)/${folder}/${GADGET}"`,
            `"$(PROJECT_DIR)/${folder}/${CONFIG}"`,
          ],
          outputPaths: [
            `"$(TARGET_BUILD_DIR)/$(FRAMEWORKS_FOLDER_PATH)/${GADGET}"`,
          ],
        }
      );
    }
    return cfg;
  });

const withFridaGadget = (config) => {
  if (!isEnabled()) return config;
  return withGadgetProject(withGadgetFiles(config));
};

module.exports = createRunOncePlugin(withFridaGadget, 'with-frida-gadget');
