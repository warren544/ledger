import "../src/lib/load-env.js";
import { runFrozenHoldout } from "../evals/holdout/evaluator.js";

const report = await runFrozenHoldout();
console.log(JSON.stringify(report, null, 2));
