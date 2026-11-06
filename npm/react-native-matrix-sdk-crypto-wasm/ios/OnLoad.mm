#import <Foundation/Foundation.h>
#import <ReactCommon/CxxTurboModuleUtils.h>

#import "MatrixSdkCryptoWasmModule.h"

@interface MatrixSdkCryptoWasmOnLoad : NSObject
@end

@implementation MatrixSdkCryptoWasmOnLoad

using namespace facebook::react;

+ (void)load
{
  registerCxxModuleToGlobalModuleMap(
      std::string(MatrixSdkCryptoWasmModule::kModuleName),
      [](std::shared_ptr<CallInvoker> jsInvoker) {
        return std::make_shared<MatrixSdkCryptoWasmModule>(jsInvoker);
      });
}

@end
