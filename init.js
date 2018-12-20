#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const arg = require("arg");
const chalk = require("chalk");

const PACKAGE_FILENAME = "package.json";

const packagePath = path.join(process.cwd(), PACKAGE_FILENAME);

const args = arg({
  "--force": Boolean,
  "-f": "--force",

  "--preset": String,
  "-p": "--preset"
});

if (!args["--preset"]) {
  console.error(
    chalk`{bold.red △  ERROR!} {underline --preset} was not specified - please specify one or figure out why your preset doesn't supply one.`
  );
  process.exit(2);
}

function hasModule(name) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(name);
    return true;
  } catch (err) {
    return false;
  }
}

const hasGitHooks = hasModule("@zeit/git-hooks");

const packageFileContents = (() => {
  try {
    return fs.readFileSync(packagePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(
        chalk`{red.bold △  ERROR!} No ${PACKAGE_FILENAME} was found in the current directory.`
      );
      process.exit(1);
    }

    throw err;
  }
})();

const pkg = JSON.parse(packageFileContents);

if (pkg.eslintConfig) {
  if (args["--force"]) {
    console.warn(
      chalk`{bold.yellow △  WARNING!} {underline --force} being used; overwriting the eslintConfig in {underline ${packagePath}}`
    );
  } else {
    console.error(
      chalk`{bold.red △  ERROR!} Terminating; cowardly refusing to overwrite existing eslintConfig in {underline ${packagePath}}`
    );
    console.error(
      chalk`          Re-run with {underline --force} if you want to overwrite the existing eslintConfig.`
    );
    process.exit(1);
  }
}

const eslintConfig = {
  extends: [`@zeit/eslint-config-${args["--preset"]}`]
};

pkg.eslintConfig = eslintConfig;

if (pkg.scripts && pkg.scripts.lint) {
  console.error(
    chalk`{yellow.bold △  WARNING!} Cowardly refusing to overwrite existing {underline lint} script in {underline ${packagePath}}`
  );
} else {
  console.log(
    chalk`△  Adding {underline scripts.lint} to {underline ${packagePath}}`
  );
  (pkg.scripts = pkg.scripts || {}).lint = "zeit-eslint --ext .jsx,.js .";
}

if (
  hasGitHooks &&
  (!pkg.git ||
    !pkg.git["pre-commit"] ||
    (Array.isArray(pkg.git["pre-commit"]) &&
      pkg.git["pre-commit"].indexOf("lint-staged") === -1) ||
    (typeof pkg.git["pre-commit"] === "string" &&
      pkg.git["pre-commit"] !== "lint-staged"))
) {
  // Add it as a linter step for pre-commit
  console.log(
    chalk`△  Detected {underline @zeit/git-hooks} - adding a lint step to the {underline pre-commit} hook as well`
  );

  if (pkg.scripts && pkg.scripts["lint-staged"]) {
    console.error(
      chalk`{yellow.bold △  WARNING!} Cowardly refusing to overwrite existing {underline lint-staged} script in {underline ${packagePath}}`
    );
  } else {
    (pkg.scripts = pkg.scripts || {})["lint-staged"] =
      "git diff --diff-filter=ACMRT --cached --name-only '*.js' '*.jsx' | xargs zeit-eslint";
  }

  pkg.git = pkg.git || {};
  const { git } = pkg;
  if (!git["pre-commit"]) {
    git["pre-commit"] = "lint-staged";
  } else {
    if (typeof git["pre-commit"] === "string") {
      git["pre-commit"] = [git["pre-commit"]];
    }

    git["pre-commit"].unshift("lint-staged");
  }
}

const formattedJson = JSON.stringify(pkg, null, "  ");

fs.writeFileSync(packagePath, formattedJson, "utf-8");
console.log("△  ZEIT linter configuration initialized successfully!");
