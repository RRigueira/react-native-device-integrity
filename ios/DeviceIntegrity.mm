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

- (void)checkIntegrity:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  @try {
    [DIIntegrityChecks runWithCompletion:^(NSDictionary *report) {
      resolve(report);
    }];
  } @catch (NSException *exception) {
    reject(@"E_INTEGRITY", exception.reason ?: @"Unexpected integrity check failure", nil);
  }
}

@end
