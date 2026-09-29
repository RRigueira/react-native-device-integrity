#import "DeviceIntegrity.h"

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
  resolve(@{
    @"completed": @NO,
    @"reason": @"not_implemented",
    @"signals": @[],
  });
}

@end
