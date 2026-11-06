#!/usr/bin/env node
import { testHermes } from "#test-hermes";

process.exitCode = await testHermes();
