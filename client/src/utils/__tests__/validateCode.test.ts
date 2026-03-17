import { describe, it, expect } from '@jest/globals';
import { validateJSXSyntax, isIncompleteCode } from '../validateCode';

describe('validateJSXSyntax', () => {
  describe('valid code', () => {
    it('should validate simple JSX', () => {
      const code = '<div>Hello</div>';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate nested JSX', () => {
      const code = `
        <div>
          <span>Hello</span>
          <p>World</p>
        </div>
      `;
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
    });

    it('should validate self-closing tags', () => {
      const code = '<img src="test.png" />';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
    });

    it('should handle empty code', () => {
      const result = validateJSXSyntax('');
      expect(result.isValid).toBe(true);
    });

    it('should validate complete React component', () => {
      const code = `
        function App() {
          return (
            <div className="app">
              <h1>Title</h1>
              <button onClick={() => console.log('click')}>Click</button>
            </div>
          );
        }
      `;
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
    });

    it('should ignore content in strings', () => {
      const code = 'const html = "{ [ ( <div>";';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
    });

    it('should ignore content in single-line comments', () => {
      const code = `
        // { [ ( <div>
        const x = 1;
      `;
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
    });

    it('should ignore content in multi-line comments', () => {
      const code = `
        /*
         * { [ ( <div>this is a comment</div>
         */
        const x = 1;
      `;
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid code - unbalanced brackets', () => {
    it('should detect unclosed brace', () => {
      const code = 'const x = {';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('unclosed brace'))).toBe(true);
    });

    it('should detect unclosed bracket', () => {
      const code = 'const arr = [1, 2, 3';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('unclosed bracket'))).toBe(true);
    });

    it('should detect unclosed parenthesis', () => {
      const code = 'function test(';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('unclosed parenthesis'))).toBe(true);
    });

    it('should detect extra closing brace', () => {
      const code = 'const x = 1; }';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('extra closing brace'))).toBe(true);
    });
  });

  describe('invalid code - incomplete patterns', () => {
    it('should detect code ending with unclosed brace', () => {
      const code = 'const obj = {  ';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('unclosed brace'))).toBe(true);
    });

    it('should detect incomplete JSX tag', () => {
      const code = '<div className="test';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('incomplete JSX tag'))).toBe(true);
    });

    it('should detect incomplete arrow function', () => {
      const code = 'const handler = () =>';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('arrow function'))).toBe(true);
    });

    it('should detect code ending with interrupted JSX generation', () => {
      const code = `
        function App() {
          return (
            <div>
              <h1>Title</h1>
              <ul className="space-y-2 text-gray-700">
                <li>• <strong>开钻日期
      `;
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      // Should have multiple errors: unclosed parens, unclosed braces, etc.
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle escaped quotes in strings', () => {
      const code = 'const str = "He said \\"Hello\\"";';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
    });

    it('should handle template literals', () => {
      const code = 'const str = `Hello ${name}`;';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(true);
    });

    it('should detect unclosed string', () => {
      const code = 'const str = "Hello';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unclosed string'))).toBe(true);
    });

    it('should detect unclosed multi-line comment', () => {
      const code = '/* This is a comment';
      const result = validateJSXSyntax(code);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('multi-line comment'))).toBe(true);
    });
  });
});

describe('isIncompleteCode', () => {
  it('should return true for incomplete code', () => {
    expect(isIncompleteCode('const x = {')).toBe(true);
  });

  it('should return false for complete code', () => {
    expect(isIncompleteCode('const x = { a: 1 };')).toBe(false);
  });

  it('should return false for empty code', () => {
    expect(isIncompleteCode('')).toBe(false);
  });
});
