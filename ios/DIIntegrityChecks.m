// Check set informed by IOSSecuritySuite and the OWASP MASTG; independent implementation.

#import "DIIntegrityChecks.h"
#import "DITamperChecks.h"

#import <UIKit/UIKit.h>
#import <mach-o/dyld.h>
#import <sys/sysctl.h>
#import <unistd.h>

@interface DIIntegrityChecks ()
+ (void)addSignalId:(NSString *)signalId
            category:(NSString *)category
         description:(NSString *)description
             signals:(NSMutableArray<NSDictionary *> *)signals
             seenIds:(NSMutableSet<NSString *> *)seenIds;
+ (BOOL)pathExists:(NSString *)path;
+ (BOOL)hasJailbreakFiles;
+ (BOOL)hasJailbreakURLSchemes;
+ (BOOL)hasJailbreakSymlinks;
+ (BOOL)isSystemWritable;
+ (BOOL)hasHookingLibraries;
+ (BOOL)hasDyldInsertLibraries;
+ (BOOL)isDebuggerAttached;
@end

@implementation DIIntegrityChecks

+ (void)addSignalId:(NSString *)signalId
            category:(NSString *)category
         description:(NSString *)description
             signals:(NSMutableArray<NSDictionary *> *)signals
             seenIds:(NSMutableSet<NSString *> *)seenIds
{
  if ([seenIds containsObject:signalId]) {
    return;
  }
  [seenIds addObject:signalId];
  [signals addObject:@{
    @"id" : signalId,
    @"category" : category,
    @"description" : description,
  }];
}

+ (NSDictionary *)buildReportWithSignals:(NSArray *)signals completed:(BOOL)completed
{
  NSMutableDictionary *report = [@{
    @"completed" : @(completed),
    @"signals" : signals,
  } mutableCopy];
  if (!completed) {
    report[@"reason"] = @"incomplete";
  }
  return [report copy];
}

+ (void)runWithIOSConfig:(NSDictionary *)iosConfig
              completion:(void (^)(NSDictionary *report))completion
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSMutableArray<NSDictionary *> *signals = [NSMutableArray array];
    NSMutableSet<NSString *> *seenIds = [NSMutableSet set];
    __block BOOL completed = YES;

#if TARGET_OS_SIMULATOR
    [self addSignalId:@"simulator"
             category:@"emulator"
          description:@"Running on the iOS Simulator"
              signals:signals
              seenIds:seenIds];
#endif

    // --- hooking_libraries (always) ---
    @try {
      if ([self hasHookingLibraries]) {
        [self addSignalId:@"hooking_libraries"
                 category:@"hooking"
              description:@"Suspicious dynamic libraries are loaded"
                  signals:signals
                  seenIds:seenIds];
      }
    } @catch (__unused NSException *exception) {
      completed = NO;
    }

    // --- debugger_attached (always) ---
    @try {
      if ([self isDebuggerAttached]) {
        [self addSignalId:@"debugger_attached"
                 category:@"debugger"
              description:@"A debugger is attached to the process"
                  signals:signals
                  seenIds:seenIds];
      }
    } @catch (__unused NSException *exception) {
      completed = NO;
    }

    // --- tamper checks (optional; skipped on Simulator by design) ---
    [DITamperChecks runWithConfig:iosConfig
                          signals:signals
                          seenIds:seenIds
                        completed:&completed];

#if TARGET_OS_SIMULATOR
    // Simulator: host Mac filesystem and Xcode-injected DYLD_INSERT_LIBRARIES
    // make jailbreak / dyld-insert checks meaningless — skip by design.
    // Skipped-by-design is not incomplete.
    completion([self buildReportWithSignals:[signals copy] completed:completed]);
#else
    @try {
      if ([self hasJailbreakFiles]) {
        [self addSignalId:@"jailbreak_files"
                 category:@"jailbreak"
              description:@"Unexpected system paths associated with jailbreaks were found"
                  signals:signals
                  seenIds:seenIds];
      }
    } @catch (__unused NSException *exception) {
      completed = NO;
    }

    @try {
      if ([self hasJailbreakSymlinks]) {
        [self addSignalId:@"jailbreak_symlinks"
                 category:@"jailbreak"
              description:@"Unexpected symbolic links were found in system locations"
                  signals:signals
                  seenIds:seenIds];
      }
    } @catch (__unused NSException *exception) {
      completed = NO;
    }

    @try {
      if ([self isSystemWritable]) {
        [self addSignalId:@"jailbreak_writable_system"
                 category:@"jailbreak"
              description:@"A normally read-only system location is writable"
                  signals:signals
                  seenIds:seenIds];
      }
    } @catch (__unused NSException *exception) {
      completed = NO;
    }

    @try {
      if ([self hasDyldInsertLibraries]) {
        [self addSignalId:@"hooking_dyld_insert"
                 category:@"hooking"
              description:@"DYLD_INSERT_LIBRARIES is set in the process environment"
                  signals:signals
                  seenIds:seenIds];
      }
    } @catch (__unused NSException *exception) {
      completed = NO;
    }

    // canOpenURL: must run on the main thread.
    // These schemes need LSApplicationQueriesSchemes (added by the Expo config
    // plugin in Phase 3 / documented for bare apps); without it canOpenURL
    // just returns NO.
    dispatch_async(dispatch_get_main_queue(), ^{
      @try {
        if ([self hasJailbreakURLSchemes]) {
          [self addSignalId:@"jailbreak_url_schemes"
                   category:@"jailbreak"
                description:@"Jailbreak-related URL schemes are registered"
                    signals:signals
                    seenIds:seenIds];
        }
      } @catch (__unused NSException *exception) {
        completed = NO;
      }

      completion([self buildReportWithSignals:[signals copy] completed:completed]);
    });
#endif
  });
}

#pragma mark - Individual checks

+ (BOOL)pathExists:(NSString *)path
{
  if ([[NSFileManager defaultManager] fileExistsAtPath:path]) {
    return YES;
  }
  const char *cPath = [path fileSystemRepresentation];
  if (cPath == NULL) {
    return NO;
  }
  return access(cPath, F_OK) == 0;
}

+ (BOOL)hasJailbreakFiles
{
  static NSArray<NSString *> *paths = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    paths = @[
      @"/Applications/Cydia.app",
      @"/Applications/Sileo.app",
      @"/Applications/Zebra.app",
      @"/Applications/Filza.app",
      @"/Applications/Installer.app",
      @"/Applications/Undecimus.app",
      @"/Applications/blackra1n.app",
      @"/Applications/FakeCarrier.app",
      @"/Applications/Icy.app",
      @"/Applications/IntelliScreen.app",
      @"/Applications/MxTube.app",
      @"/Applications/RockApp.app",
      @"/Applications/SBSettings.app",
      @"/Applications/WinterBoard.app",
      @"/Library/MobileSubstrate/MobileSubstrate.dylib",
      @"/Library/MobileSubstrate/DynamicLibraries",
      @"/usr/lib/libsubstrate.dylib",
      @"/usr/lib/substitute-inserter.dylib",
      @"/usr/lib/libhooker.dylib",
      @"/usr/lib/TweakInject",
      @"/usr/lib/libellekit.dylib",
      @"/usr/lib/ellekit/libinjector.dylib",
      @"/private/var/lib/apt",
      @"/private/var/lib/apt/",
      @"/private/var/lib/cydia",
      @"/private/var/mobile/Library/SBSettings/Themes",
      @"/private/var/stash",
      @"/private/var/tmp/cydia.log",
      @"/private/var/db/stash",
      @"/usr/sbin/sshd",
      @"/usr/bin/ssh",
      @"/usr/bin/sshd",
      @"/usr/libexec/cydia",
      @"/usr/libexec/sftp-server",
      @"/usr/libexec/ssh-keysign",
      @"/bin/bash",
      @"/etc/apt",
      @"/etc/ssh/sshd_config",
      @"/var/jb",
      @"/var/binpack",
      @"/var/checkra1n.dmg",
      @"/.bootstrapped",
      @"/.installed_unc0ver",
      @"/.cydia_no_stash",
      @"/jb/amfid_payload.dylib",
      @"/jb/jailbreakd.plist",
      @"/jb/libjailbreak.dylib",
      @"/chimera/jailbreakd.plist",
      @"/odyssey/jailbreakd.plist",
    ];
  });

  for (NSString *path in paths) {
    if ([self pathExists:path]) {
      return YES;
    }
  }
  return NO;
}

+ (BOOL)hasJailbreakURLSchemes
{
  // Requires LSApplicationQueriesSchemes entries; without them canOpenURL
  // returns NO even when the target app is installed.
  static NSArray<NSString *> *schemes = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    schemes = @[
      @"cydia://",
      @"sileo://",
      @"zbra://",
      @"filza://",
      @"undecimus://",
      @"activator://",
    ];
  });

  UIApplication *app = [UIApplication sharedApplication];
  for (NSString *scheme in schemes) {
    NSURL *url = [NSURL URLWithString:scheme];
    if (url != nil && [app canOpenURL:url]) {
      return YES;
    }
  }
  return NO;
}

+ (BOOL)hasJailbreakSymlinks
{
  static NSArray<NSString *> *paths = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    paths = @[
      @"/Applications",
      @"/Library/Ringtones",
      @"/Library/Wallpaper",
      @"/usr/arm-apple-darwin9",
      @"/usr/include",
      @"/usr/libexec",
      @"/usr/share",
    ];
  });

  NSFileManager *fm = [NSFileManager defaultManager];
  for (NSString *path in paths) {
    NSError *error = nil;
    NSString *destination =
        [fm destinationOfSymbolicLinkAtPath:path error:&error];
    if (destination != nil) {
      return YES;
    }
  }
  return NO;
}

+ (BOOL)isSystemWritable
{
  NSString *probeName =
      [NSString stringWithFormat:@"di_integrity_%@", [[NSUUID UUID] UUIDString]];
  NSString *probePath = [@"/private/" stringByAppendingPathComponent:probeName];
  const char *cPath = [probePath fileSystemRepresentation];
  if (cPath == NULL) {
    return NO;
  }

  FILE *file = fopen(cPath, "w");
  if (file == NULL) {
    return NO;
  }
  fputs("x", file);
  fclose(file);
  unlink(cPath);
  return YES;
}

+ (BOOL)hasHookingLibraries
{
  static NSArray<NSString *> *needles = nil;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    needles = @[
      @"frida",
      @"fridagadget",
      @"cynject",
      @"libcycript",
      @"mobilesubstrate",
      @"substrateloader",
      @"substrateinserter",
      @"substitute",
      @"libhooker",
      @"ellekit",
      @"tweakinject",
      @"sslkillswitch",
      @"revealserver",
      @"systemhook",
    ];
  });

  uint32_t count = _dyld_image_count();
  for (uint32_t i = 0; i < count; i++) {
    const char *imageName = _dyld_get_image_name(i);
    if (imageName == NULL) {
      continue;
    }
    NSString *name =
        [[NSString stringWithUTF8String:imageName] lowercaseString];
    if (name == nil) {
      continue;
    }
    for (NSString *needle in needles) {
      if ([name rangeOfString:needle].location != NSNotFound) {
        return YES;
      }
    }
  }
  return NO;
}

+ (BOOL)hasDyldInsertLibraries
{
  const char *value = getenv("DYLD_INSERT_LIBRARIES");
  if (value == NULL) {
    return NO;
  }
  return value[0] != '\0';
}

+ (BOOL)isDebuggerAttached
{
  int mib[4] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()};
  struct kinfo_proc info;
  memset(&info, 0, sizeof(info));
  size_t size = sizeof(info);

  if (sysctl(mib, 4, &info, &size, NULL, 0) != 0) {
    return NO;
  }
  return (info.kp_proc.p_flag & P_TRACED) != 0;
}

@end
