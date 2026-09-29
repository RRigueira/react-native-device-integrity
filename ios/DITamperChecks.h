#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Independent implementation informed by OWASP MASTG (MASVS-RESILIENCE-2
 * app integrity); no code copied.
 *
 * Optional tamper checks driven by the `ios` options object. A check runs
 * only when its option is configured; unconfigured checks are skipped and
 * do not mark the report incomplete. On the Simulator, configured checks
 * are skipped by design (not incomplete).
 *
 * Config keys (all optional):
 * - expectedTeamIds: NSArray of NSString (non-empty ⇒ run team-id check)
 * - requireEncryptedBinary: @YES ⇒ run binary-encryption check
 */
@interface DITamperChecks : NSObject

+ (void)runWithConfig:(nullable NSDictionary *)config
              signals:(NSMutableArray<NSDictionary *> *)signals
              seenIds:(NSMutableSet<NSString *> *)seenIds
            completed:(BOOL *)completed;

@end

NS_ASSUME_NONNULL_END
