// Independent implementation informed by OWASP MASTG (MASVS-RESILIENCE-2
// app integrity); no code copied.

#import "DITamperChecks.h"

#import <Security/Security.h>
#import <mach-o/dyld.h>
#import <mach-o/loader.h>
#import <string.h>

@implementation DITamperChecks

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

+ (void)runWithConfig:(NSDictionary *)config
              signals:(NSMutableArray<NSDictionary *> *)signals
              seenIds:(NSMutableSet<NSString *> *)seenIds
            completed:(BOOL *)completed
{
  if (config == nil || config.count == 0) {
    return;
  }

#if TARGET_OS_SIMULATOR
  // Simulator: App Store encryption and Team ID from keychain access groups
  // are not meaningful on the host Mac — skip by design (not incomplete).
  (void)signals;
  (void)seenIds;
  (void)completed;
  return;
#else

  NSArray *expectedTeamIds = config[@"expectedTeamIds"];
  if ([expectedTeamIds isKindOfClass:[NSArray class]] && expectedTeamIds.count == 0) {
    // Configured without a usable Team ID: the check cannot run.
    if (completed != NULL) {
      *completed = NO;
    }
  } else if ([expectedTeamIds isKindOfClass:[NSArray class]]) {
    @try {
      BOOL couldNotRun = NO;
      NSString *teamId = [self currentTeamIdCouldNotRun:&couldNotRun];
      if (couldNotRun) {
        if (completed != NULL) {
          *completed = NO;
        }
      } else if (teamId == nil || ![self teamId:teamId matchesExpected:expectedTeamIds]) {
        [self addSignalId:@"tamper_team_id_mismatch"
                 category:@"tamper"
              description:@"The app Team ID does not match an expected value"
                  signals:signals
                  seenIds:seenIds];
      }
    } @catch (__unused NSException *exception) {
      if (completed != NULL) {
        *completed = NO;
      }
    }
  }

  NSNumber *requireEncrypted = config[@"requireEncryptedBinary"];
  if ([requireEncrypted isKindOfClass:[NSNumber class]] && [requireEncrypted boolValue]) {
    @try {
      if ([self isMainExecutableDecryptedOrMissingEncryption]) {
        [self addSignalId:@"tamper_binary_decrypted"
                 category:@"tamper"
              description:@"The main executable does not appear to be encrypted"
                  signals:signals
                  seenIds:seenIds];
      }
    } @catch (__unused NSException *exception) {
      if (completed != NULL) {
        *completed = NO;
      }
    }
  }
#endif
}

#pragma mark - Team ID (keychain access group)

/*
 * Public-API Team ID lookup: a Keychain generic-password item's
 * kSecAttrAccessGroup is of the form "TEAMID.<app-id>". Adding (if needed)
 * and querying such an item, then reading that attribute, yields the Team
 * ID prefix without private APIs. Keychain APIs are not on Apple's
 * required-reason API list. The temporary item is deleted after the query.
 */
+ (nullable NSString *)currentTeamIdCouldNotRun:(BOOL *)couldNotRun
{
  if (couldNotRun != NULL) {
    *couldNotRun = NO;
  }

  NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];
  if (bundleId.length == 0) {
    bundleId = @"unknown";
  }
  NSString *service =
      [NSString stringWithFormat:@"%@.deviceintegrity.teamid", bundleId];

  NSDictionary *query = @{
    (__bridge id)kSecClass : (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService : service,
    (__bridge id)kSecReturnAttributes : @YES,
  };

  CFTypeRef result = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);

  if (status == errSecItemNotFound) {
    NSDictionary *add = @{
      (__bridge id)kSecClass : (__bridge id)kSecClassGenericPassword,
      (__bridge id)kSecAttrService : service,
      (__bridge id)kSecAttrAccessible :
          (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
      (__bridge id)kSecValueData : [@"di" dataUsingEncoding:NSUTF8StringEncoding],
    };
    status = SecItemAdd((__bridge CFDictionaryRef)add, NULL);
    if (status != errSecSuccess) {
      if (couldNotRun != NULL) {
        *couldNotRun = YES;
      }
      return nil;
    }
    result = NULL;
    status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
  }

  if (status != errSecSuccess || result == NULL) {
    if (couldNotRun != NULL) {
      *couldNotRun = YES;
    }
    [self deleteTeamIdItemWithService:service];
    return nil;
  }

  NSDictionary *attrs = (__bridge_transfer NSDictionary *)result;
  NSString *accessGroup = attrs[(__bridge id)kSecAttrAccessGroup];

  [self deleteTeamIdItemWithService:service];

  if (![accessGroup isKindOfClass:[NSString class]] || accessGroup.length == 0) {
    if (couldNotRun != NULL) {
      *couldNotRun = YES;
    }
    return nil;
  }

  NSRange dot = [accessGroup rangeOfString:@"."];
  if (dot.location == NSNotFound || dot.location == 0) {
    if (couldNotRun != NULL) {
      *couldNotRun = YES;
    }
    return nil;
  }

  NSString *prefix = [[accessGroup substringToIndex:dot.location]
      stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  if (prefix.length == 0) {
    if (couldNotRun != NULL) {
      *couldNotRun = YES;
    }
    return nil;
  }
  return prefix;
}

+ (void)deleteTeamIdItemWithService:(NSString *)service
{
  NSDictionary *del = @{
    (__bridge id)kSecClass : (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService : service,
  };
  SecItemDelete((__bridge CFDictionaryRef)del);
}

+ (BOOL)teamId:(NSString *)teamId matchesExpected:(NSArray *)expectedTeamIds
{
  for (id raw in expectedTeamIds) {
    if (![raw isKindOfClass:[NSString class]]) {
      continue;
    }
    NSString *expected = [(NSString *)raw
        stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (expected.length == 0) {
      continue;
    }
    // Team IDs are uppercase alphanumerics; compare case-sensitively.
    if ([teamId isEqualToString:expected]) {
      return YES;
    }
  }
  return NO;
}

#pragma mark - Binary encryption (LC_ENCRYPTION_INFO)

+ (const struct mach_header *)mainExecutableHeader
{
  NSString *execPath = [[NSBundle mainBundle] executablePath];
  const char *execPathC = execPath.fileSystemRepresentation;

  // Prefer image 0 when its path matches the main bundle executable.
  const char *image0Name = _dyld_get_image_name(0);
  if (image0Name != NULL && execPathC != NULL && strcmp(image0Name, execPathC) == 0) {
    return _dyld_get_image_header(0);
  }

  // Otherwise find the MH_EXECUTE image (or path match).
  uint32_t count = _dyld_image_count();
  for (uint32_t i = 0; i < count; i++) {
    const struct mach_header *header = _dyld_get_image_header(i);
    if (header == NULL) {
      continue;
    }
    if (header->filetype == MH_EXECUTE) {
      return header;
    }
    const char *name = _dyld_get_image_name(i);
    if (name != NULL && execPathC != NULL && strcmp(name, execPathC) == 0) {
      return header;
    }
  }

  // Last resort: image 0 is conventionally the main executable.
  return _dyld_get_image_header(0);
}

+ (BOOL)isMainExecutableDecryptedOrMissingEncryption
{
  const struct mach_header *header = [self mainExecutableHeader];
  if (header == NULL) {
    // Cannot inspect — treat as incomplete via exception path; return NO here
    // and let the caller mark incomplete only on throw. Missing header means
    // we could not run the check.
    @throw [NSException exceptionWithName:@"DITamperChecksException"
                                   reason:@"main executable header unavailable"
                                 userInfo:nil];
  }

  BOOL is64 = (header->magic == MH_MAGIC_64 || header->magic == MH_CIGAM_64);
  BOOL is32 = (header->magic == MH_MAGIC || header->magic == MH_CIGAM);
  if (!is64 && !is32) {
    @throw [NSException exceptionWithName:@"DITamperChecksException"
                                   reason:@"unrecognized mach-o magic"
                                 userInfo:nil];
  }

  uint32_t ncmds = 0;
  const struct load_command *cmd = NULL;

  if (is64) {
    const struct mach_header_64 *h64 = (const struct mach_header_64 *)header;
    ncmds = h64->ncmds;
    cmd = (const struct load_command *)(h64 + 1);
  } else {
    ncmds = header->ncmds;
    cmd = (const struct load_command *)(header + 1);
  }

  BOOL found = NO;
  for (uint32_t i = 0; i < ncmds; i++) {
    if (cmd->cmdsize == 0) {
      break;
    }
    if (cmd->cmd == LC_ENCRYPTION_INFO_64) {
      const struct encryption_info_command_64 *enc =
          (const struct encryption_info_command_64 *)cmd;
      found = YES;
      if (enc->cryptid == 0) {
        return YES;
      }
    } else if (cmd->cmd == LC_ENCRYPTION_INFO) {
      const struct encryption_info_command *enc =
          (const struct encryption_info_command *)cmd;
      found = YES;
      if (enc->cryptid == 0) {
        return YES;
      }
    }
    cmd = (const struct load_command *)((const uint8_t *)cmd + cmd->cmdsize);
  }

  // Missing encryption load command ⇒ treat as decrypted / not encrypted.
  return !found;
}

@end
