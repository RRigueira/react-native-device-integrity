#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Internal integrity checks. Runs off the main thread (except URL-scheme
 * queries) and delivers a NativeIntegrityReport-shaped dictionary.
 */
@interface DIIntegrityChecks : NSObject

+ (void)runWithCompletion:(void (^)(NSDictionary *report))completion;

@end

NS_ASSUME_NONNULL_END
