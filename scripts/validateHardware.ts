import { validateHardwareScenarios } from '../src/hardware/hardwareValidation';

const results = await validateHardwareScenarios();
let failed = false;

results.forEach((result) => {
  if (result.passed) {
    console.log(`✅ ${result.id}`);
    return;
  }

  failed = true;
  console.error(`❌ ${result.id} — esperado ${result.expected}, obtido ${result.actual}`);
});

if (failed) process.exit(1);
