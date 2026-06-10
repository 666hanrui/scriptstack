const fs = require('fs');
const path = require('path');

const replaceInFile = (file, replacer) => {
  const fullPath = path.join('/Users/hanrui/rerust/geoworld-frontend/src', file);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf-8');
  content = replacer(content);
  fs.writeFileSync(fullPath, content);
};

// EarthViewer
replaceInFile('components3d/EarthViewer.tsx', c => {
  if (!c.includes('import { useState, Suspense } from')) {
    c = `import { useState, Suspense } from 'react';\n` + c;
  }
  return c;
});

// Challenge
replaceInFile('pages/Challenge/index.tsx', c => {
  if (!c.includes('import { useState } from')) {
    c = `import { useState } from 'react';\n` + c;
  }
  c = c.replace(/const \[searchParams\] = useSearchParams\(\);/, '');
  c = c.replace(/setScore\(s => s \+ 10\)/, 'setScore((s: number) => s + 10)');
  return c;
});

// AITeacher
replaceInFile('pages/AITeacher/index.tsx', c => {
  c = c.replace(/const \[searchParams\] = useSearchParams\(\);/, 'const searchParams = useSearchParams()[0];');
  return c;
});
