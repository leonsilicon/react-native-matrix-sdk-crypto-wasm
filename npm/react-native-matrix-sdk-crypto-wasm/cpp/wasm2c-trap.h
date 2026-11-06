// Traps for the wasm2c module, without signals or a global jmp_buf.
//
// wasm2c's runtime reports a trap (a Rust panic's `unreachable`, an out-of-bounds access, a
// call-stack overflow) by calling WASM_RT_TRAP_HANDLER, which the build defines as
// mxcw_trap_handler. Every call from JavaScript into the module enters a frame first; the
// handler long-jumps back to the innermost one. Calls nest (export -> import -> export), so
// frames form a stack, and leaving a frame restores wasm2c's call-depth counters even when a
// C++ exception from a JavaScript import unwinds through the module.

#pragma once

#include <setjmp.h>
#include <stdint.h>

#include "wasm-rt.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct mxcw_trap_frame {
  jmp_buf buffer;
  wasm_rt_trap_t code;
  struct mxcw_trap_frame* previous;
  uint32_t saved_depth;
  uint32_t depth;
} mxcw_trap_frame;

void mxcw_trap_enter(mxcw_trap_frame* frame);
void mxcw_trap_leave(mxcw_trap_frame* frame);
WASM_RT_NO_RETURN void mxcw_trap_handler(wasm_rt_trap_t code);

#ifdef __cplusplus
}
#endif

// _setjmp/_longjmp skip saving the signal mask, which costs a syscall per call into the module.
#if defined(_WIN32)
#define MXCW_SETJMP(buffer) setjmp(buffer)
#define MXCW_LONGJMP(buffer, value) longjmp(buffer, value)
#else
#define MXCW_SETJMP(buffer) _setjmp(buffer)
#define MXCW_LONGJMP(buffer, value) _longjmp(buffer, value)
#endif
