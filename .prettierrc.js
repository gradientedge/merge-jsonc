export default {
  // General formatting
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  useTabs: false,
  printWidth: 100,

  // Trailing commas configuration
  trailingComma: "es5", // Default for most files

  // Override for JSON and JSONC files
  overrides: [
    {
      files: ["*.json", "*.jsonc"],
      options: {
        trailingComma: "none", // No trailing commas in JSON/JSONC
        parser: "json",
      },
    },
  ],
};
