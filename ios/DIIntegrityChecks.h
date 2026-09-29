#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Internal integrity checks. Runs off the main thread (except URL-scheme
 * queries) and delivers a NativeIntegrityReport-shaped dictionary.
 *
 * @param iosConfig Optional parsed `ios` options. Keys:
 *   - expectedTeamIds: NSArray of NSString
 *   - requireEncryptedBinary: @YES
 *   Nil/empty ⇒ no tamper checks run (and the report is not incomplete).
 */
@interface DIIntegrityChecks : NSObject

+ (void)runWithIOSConfig:(nullable NSDictionary *)iosConfig
              completion:(void (^)(NSDictionary *report))completion;

@end

NS_ASSUME_NONNULL_END
