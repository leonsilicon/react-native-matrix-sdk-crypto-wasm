#include "wasm2c-trap.h"

#include <stdio.h>
#include <stdlib.h>

#include "wasm-rt-impl.h"

static WASM_RT_THREAD_LOCAL mxcw_trap_frame* current_frame = NULL;

void mxcw_trap_enter(mxcw_trap_frame* frame) {
  frame->code = WASM_RT_TRAP_NONE;
  frame->previous = current_frame;
  frame->saved_depth = wasm_rt_saved_call_stack_depth;
  frame->depth = wasm_rt_call_stack_depth;
  // wasm_rt_trap resets the depth to the saved value before calling the handler.
  wasm_rt_saved_call_stack_depth = wasm_rt_call_stack_depth;
  current_frame = frame;
}

void mxcw_trap_leave(mxcw_trap_frame* frame) {
  current_frame = frame->previous;
  wasm_rt_saved_call_stack_depth = frame->saved_depth;
  wasm_rt_call_stack_depth = frame->depth;
}

void mxcw_trap_handler(wasm_rt_trap_t code) {
  mxcw_trap_frame* frame = current_frame;
  if (frame == NULL) {
    // Only reachable if the module runs outside Bridge::invoke, which would be a bridge bug.
    fprintf(stderr, "react-native-matrix-sdk-crypto-wasm: wasm trap outside a call: %s\n", wasm_rt_strerror(code));
    abort();
  }
  frame->code = code;
  MXCW_LONGJMP(frame->buffer, 1);
}
