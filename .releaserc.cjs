module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
      },
    ],
    [
      "@semantic-release/npm",
      {
        // keep npmPublish true to publish to npm,
        // but we are NOT using @semantic-release/git so package.json
        // won't be committed back to the repo.
        npmPublish: true,
      },
    ],
    "@semantic-release/github",
  ],
};
