const text = 'A'.repeat(15700000);
for (const pattern of [
  /(?<![A-Za-z0-9_-])AAAA[A-Za-z0-9_-]{6,}:APA91b[A-Za-z0-9_-]{32,}/g,
  /(?<![A-Za-z0-9_-])AAAA[A-Za-z0-9_-]+:APA91b[A-Za-z0-9_-]+/g,
  /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{16,}={0,2}(?![A-Za-z0-9_+/-])/g,
  /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]+={0,2}(?![A-Za-z0-9_+/-])/g,
]) {
  const start = Date.now();
  try {
    console.log(
      pattern.source,
      [...text.matchAll(pattern)].length,
      Date.now() - start
    );
  } catch (error) {
    console.log(pattern.source, error.name, error.message);
  }
}
