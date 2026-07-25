import { readFile } from "node:fs/promises";

const input = process.argv[2] || "tests/golden-set.local.json";
const dataset = JSON.parse(await readFile(input, "utf8"));
const samples = Array.isArray(dataset) ? dataset : dataset.samples;
if (!Array.isArray(samples) || !samples.length) {
  throw new Error("黄金集必须包含非空 samples 数组");
}

const rows = samples.map((sample) => {
  const distance = levenshtein([...sample.reference], [...sample.prediction]);
  const cer = distance / Math.max(1, [...sample.reference].length);
  return {
    id: sample.id,
    writerId: sample.writerId,
    accuracy: 1 - cer,
    editsPer100: cer * 100,
    pageOrderOk: sample.pageOrderOk !== false,
    lostLines: Number(sample.lostLines || 0),
  };
});
const accuracies = rows.map((row) => row.accuracy).sort((a, b) => a - b);
const median = accuracies[Math.floor(accuracies.length / 2)];
const pass90 = rows.filter((row) => row.accuracy >= .9).length / rows.length;
const ordered = rows.every((row) => row.pageOrderOk && row.lostLines === 0);

console.log(JSON.stringify({
  samples: rows.length,
  writers: new Set(rows.map((row) => row.writerId)).size,
  medianAccuracy: Number(median.toFixed(4)),
  shareAtLeast90: Number(pass90.toFixed(4)),
  zeroPageOrLineLoss: ordered,
  launchGatePassed: median >= .93 && pass90 >= .8 && ordered,
}, null, 2));

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}
