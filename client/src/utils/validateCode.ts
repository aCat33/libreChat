/**
 * Validates code for common syntax issues that might occur
 * during streaming generation interruptions.
 * 
 * NOTE: This is NOT a full JSX/JS parser. It only detects
 * obvious signs of incomplete streaming generation.
 */
export function validateJSXSyntax(code: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!code || code.trim().length === 0) {
    return { isValid: true, errors: [] };
  }

  const trimmed = code.trim();

  // Check for incomplete code blocks (common streaming interruption signs at END of file)
  const incompletePatterns = [
    { pattern: /\{\s*$/, message: 'Code ends with an unclosed brace' },
    { pattern: /\(\s*$/, message: 'Code ends with an unclosed parenthesis' },
    { pattern: /\[\s*$/, message: 'Code ends with an unclosed bracket' },
    { pattern: /<\w+[^>]*$/, message: 'Code ends with an incomplete JSX tag' },
    { pattern: /=>\s*$/, message: 'Code ends with an incomplete arrow function' },
    { pattern: /function\s+\w+\s*\([^)]*$/, message: 'Code ends with an incomplete function declaration' },
    { pattern: /const\s+\w+\s*=\s*$/, message: 'Code ends with an incomplete assignment' },
  ];

  for (const { pattern, message } of incompletePatterns) {
    if (pattern.test(trimmed)) {
      errors.push(message);
    }
  }

  // Check for balanced braces, brackets, and parentheses (simple count-based approach)
  const counts = {
    braces: 0,      // { }
    brackets: 0,    // [ ]
    parens: 0,      // ( )
  };

  // Simple state machine to track if we're in a string or comment
  let inString = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let stringChar = '';

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1] || '';
    const prevChar = code[i - 1] || '';

    // Handle newlines (reset single-line comments)
    if (char === '\n') {
      inSingleLineComment = false;
    }

    // Skip if in comment
    if (inSingleLineComment || inMultiLineComment) {
      // Check for end of multi-line comment
      if (inMultiLineComment && char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        i++; // Skip the '/'
      }
      continue;
    }

    // Handle strings
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    // Skip if in string
    if (inString) {
      continue;
    }

    // Start of single-line comment
    if (char === '/' && nextChar === '/') {
      inSingleLineComment = true;
      i++; // Skip next char
      continue;
    }

    // Start of multi-line comment
    if (char === '/' && nextChar === '*') {
      inMultiLineComment = true;
      i++; // Skip next char
      continue;
    }

    // Count brackets/braces/parens
    if (char === '{') {
      counts.braces++;
    } else if (char === '}') {
      counts.braces--;
    } else if (char === '[') {
      counts.brackets++;
    } else if (char === ']') {
      counts.brackets--;
    } else if (char === '(') {
      counts.parens++;
    } else if (char === ')') {
      counts.parens--;
    }
  }

  // Check for unclosed strings
  if (inString) {
    errors.push('Unclosed string');
  }

  // Check for unclosed multi-line comment
  if (inMultiLineComment) {
    errors.push('Unclosed multi-line comment');
  }

  // Check for unbalanced brackets
  if (counts.braces > 0) {
    errors.push(`${counts.braces} unclosed brace(s) {`);
  } else if (counts.braces < 0) {
    errors.push(`${Math.abs(counts.braces)} extra closing brace(s) }`);
  }

  if (counts.brackets > 0) {
    errors.push(`${counts.brackets} unclosed bracket(s) [`);
  } else if (counts.brackets < 0) {
    errors.push(`${Math.abs(counts.brackets)} extra closing bracket(s) ]`);
  }

  if (counts.parens > 0) {
    errors.push(`${counts.parens} unclosed parenthesis(es) (`);
  } else if (counts.parens < 0) {
    errors.push(`${Math.abs(counts.parens)} extra closing parenthesis(es) )`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if code appears to be incomplete based on common streaming patterns
 */
export function isIncompleteCode(code: string): boolean {
  if (!code || code.trim().length === 0) {
    return false;
  }

  const { isValid } = validateJSXSyntax(code);
  return !isValid;
}
