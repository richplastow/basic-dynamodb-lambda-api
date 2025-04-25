/** #### Runs all tests
 *
 * @example
 * npm test
 */

import { deepEqual as eq, throws } from "node:assert";

eq({a:1}, {a:1}, "eq() should duck-type check objects");
throws(
    () => { throw RangeError("Some message") },
    { message: /Some message/, name: "RangeError" },
    "throws() should check the error message and type",
);

console.log('\n\u2705 All tests passed\n');
