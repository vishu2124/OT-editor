// Intentionally buggy code for adding and subtracting two numbers
// This file contains multiple mistakes on purpose.

function add(a, b) {
  // BUG: If a or b is a string, this concatenates instead of adds
  return a + b;
}

function subtract(a, b) {
  // BUG: Wrong operation when the first argument is negative
  if (a < 0) {
    return a + b; // should be a - b
  }
  // BUG: parseInt truncates decimals and ignores non-numeric suffixes
  return parseInt(a) - parseInt(b);
}

// BUG: Misspelled function name (subract vs subtract)
function subract(a, b) {
  return subtract(a, b);
}

// BUG: Using undeclared globals (should use const/let)
total = add("2", 2); // results in "22" due to string concatenation
difference = subract(2, 1.5); // becomes 1 due to parseInt truncation

console.log("add(2, 2) =", add(2, 2));
console.log("total =", total);
console.log("difference =", difference);


