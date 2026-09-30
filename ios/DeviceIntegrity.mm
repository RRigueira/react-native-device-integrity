#import "DeviceIntegrity.h"
#import "DIIntegrityChecks.h"

@implementation DeviceIntegrity

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeDeviceIntegritySpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"DeviceIntegrity";
}

/**
 * Defensively parse options[@"ios"]. Wrong types / empty arrays ⇒ not
 * configured (check does not run, report is not incomplete).
 */
static NSDictionary *DIParseIOSConfig(NSDictionary *options)
{
  if (![options isKindOfClass:[NSDictionary class]]) {
    return nil;
  }

  id iosRaw = options[@"ios"];
  if (![iosRaw isKindOfClass:[NSDictionary class]]) {
    return nil;
  }
  NSDictionary *ios = (NSDictionary *)iosRaw;
  NSMutableDictionary *config = [NSMutableDictionary dictionary];

  id teamIdsRaw = ios[@"expectedTeamIds"];
  if ([teamIdsRaw isKindOfClass:[NSArray class]]) {
    NSMutableArray<NSString *> *valid = [NSMutableArray array];
    for (id item in (NSArray *)teamIdsRaw) {
      if (![item isKindOfClass:[NSString class]]) {
        continue;
      }
      NSString *trimmed = [(NSString *)item
          stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
      if (trimmed.length > 0) {
        [valid addObject:trimmed];
      }
    }
    // Keep an empty list when values were given but none are usable, so the
    // check reports incomplete instead of silently not running.
    if (valid.count > 0 || ((NSArray *)teamIdsRaw).count > 0) {
      config[@"expectedTeamIds"] = [valid copy];
    }
  }

  id requireEncRaw = ios[@"requireEncryptedBinary"];
  if ([requireEncRaw isKindOfClass:[NSNumber class]] &&
      [(NSNumber *)requireEncRaw boolValue]) {
    config[@"requireEncryptedBinary"] = @YES;
  }

  if (config.count == 0) {
    return nil;
  }
  return [config copy];
}

- (void)checkIntegrity:(NSDictionary *)options
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  @try {
    NSDictionary *iosConfig = DIParseIOSConfig(options);
    [DIIntegrityChecks runWithIOSConfig:iosConfig
                             completion:^(NSDictionary *report) {
                               resolve(report);
                             }];
  } @catch (NSException *exception) {
    reject(@"E_INTEGRITY", exception.reason ?: @"Unexpected integrity check failure", nil);
  }
}

@end
