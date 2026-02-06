#!/usr/bin/env node
const addFormats = require("ajv-formats");

// File validation mapping: filename patterns to schema URLs
const mapping = [
    {
        "fileMatch": [
            "parameters.imljson",
            "*.params.iml.json"
        ],
        "url": "parameters.json"
    },
    {
        "fileMatch": [
            "expect.imljson",
            "*.mappable-params.iml.json"
        ],
        "url": "parameters.json"
    },
    {
        "fileMatch": [
            "interface.imljson",
            "*.interface.iml.json"
        ],
        "url": "parameters.json"
    },
    {
        "fileMatch": [
            "common.imljson",
            "common.json"
        ],
        "url": "common.json"
    },
    {
        "fileMatch": [
            "api.imljson",
            "*.communication.iml.json"
        ],
        "url": "api.json"
    },
    {
        "fileMatch": [
            "samples.imljson",
            "*.samples.iml.json"
        ],
        "url": "samples.json"
    },
    {
        "fileMatch": [
            "scopes.imljson",
            "*.scope-list.iml.json"
        ],
        "url": "scopes.json"
    },
    {
        "fileMatch": [
            "scope.imljson",
            "*.default-scope.iml.json",
            "*.required-scope.iml.json"
        ],
        "url": "scope.json"
    },
    {
        "fileMatch": [
            "epoch.imljson",
            "*.epoch.iml.json"
        ],
        "url": "epoch.json"
    },
    {
        "fileMatch": [
            "attach.imljson",
            "*.attach.iml.json"
        ],
        "url": "api.json"
    },
    {
        "fileMatch": [
            "detach.imljson",
            "*.detach.iml.json"
        ],
        "url": "api.json"
    },
    {
        "fileMatch": [
            "publish.imljson",
            "*.publish.iml.json"
        ],
        "url": "api.json"
    },
    {
        "fileMatch": [
            "base.imljson",
            "base.iml.json"
        ],
        "url": "base.json"
    },
    {
        "fileMatch": [
            "api-oauth.imljson",
            "*.oauth-communication.iml.json"
        ],
        "url": "apiOAuth.json"
    },
    {
        "fileMatch": [
            "groups.json"
        ],
        "url": "groups.json"
    },
    {
        "fileMatch": [
            "makecomapp.json"
        ],
        "url": "./syntaxes/local-development/schemas/makecomapp.schema.json"
    }
];
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { parse, printParseErrorCode } = require('jsonc-parser');

// Build a simple glob matcher from patterns like "*.params.iml.json"
const globToRegExp = (pattern) => {
    // Escape regex special chars except * then replace * with a class that doesn't match path separators
    const escaped = pattern
        .replace(/[.+^${}()|\[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*');
    return new RegExp(`^${escaped}$`);
};

// Resolve a schema object based on the mapping URL
const resolveSchema = (schemaUrl) => {
    try {
        // Try to resolve relative to repo root (this file resides in repo root)
        const localPath = path.resolve(__dirname, schemaUrl);
        if (fs.existsSync(localPath)) {
            return { schema: JSON.parse(fs.readFileSync(localPath, 'utf8')), name: path.relative(process.cwd(), localPath) };
        }

        // Fallback: attempt to load from @integromat/oss-schema/dist/json/<basename>.json if available
        const baseName = path.basename(schemaUrl);
        const candidatePkg = `@integromat/oss-schema/dist/json/${baseName}`;
        try {
            const pkgSchema = require(candidatePkg);
            return { schema: pkgSchema, name: candidatePkg };
        } catch (_) {
            console.log(`Error ${_.message} for ${candidatePkg}`);
            // ignore
        }
    } catch (err) {
        // fall through to return undefined
    }
    return undefined;
};

// Track context so Ajv warnings mention which file/schema triggered them
let ajvContext = '';
const ajvLogger = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: (msg) => {
        const prefix = ajvContext ? `AJV warning (${ajvContext})` : 'AJV warning';
        console.warn(`${prefix}: ${msg}`);
    },
};

const ajv = new Ajv({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    logger: ajvLogger,
});
addFormats(ajv);

const args = process.argv.slice(2);
const allowWarnings = args.includes('--allow-warnings');
const appDirArg = args.find((arg) => !arg.startsWith('-'));

if (!appDirArg) {
    console.log('Usage: node scripts/validate-app.js <path-to-app> [--allow-warnings]');
    console.log('Example: node scripts/validate-app.js apps/braintrust');
    process.exit(1);
}

const appDir = path.resolve(process.cwd(), appDirArg);
if (!fs.existsSync(appDir) || !fs.statSync(appDir).isDirectory()) {
    console.warn(`Warning: Provided path is not a directory: ${appDir}`);
    process.exit(1);
}

// Recursively list files under appDir
const listFiles = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...listFiles(full));
        else files.push(full);
    }
    return files;
};

// Prepare matchers and schemas
const rules = mapping.map((m) => {
    const patterns = (m.fileMatch || []).map(globToRegExp);
    const resolved = resolveSchema(m.url);
    return { patterns, schemaInfo: resolved, raw: m };
});

const allFiles = listFiles(appDir);
let checkedCount = 0;
let warningCount = 0;

for (const filePath of allFiles) {
    const fileName = path.basename(filePath);
    for (const rule of rules) {
        if (!rule.patterns.some((re) => re.test(fileName))) continue;

        // If no schema available, warn and skip
        if (!rule.schemaInfo) {
            console.warn(`Warning: No schema available for '${fileName}' → mapping url '${rule.raw.url}'. Skipping validation.`);
            warningCount++;
            continue;
        }

        // Validate JSON file
        let data;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const errors = [];
            data = parse(content, errors);
            if (errors.length) {
                const { offset, error } = errors[0];
                const message = printParseErrorCode(error);
                throw new Error(`${message} (offset ${offset})`);
            }
        } catch (err) {
            console.warn(`Warning: Failed to parse JSON '${path.relative(process.cwd(), filePath)}': ${err.message}`);
            warningCount++;
            continue;
        }

        // Create (or reuse) a compiled validator for this schema
        let validate;
        try {
            // Ajv reports certain warnings (e.g., unknown formats). Attach context so they are actionable.
            ajvContext = `${path.relative(process.cwd(), filePath)} → ${rule.schemaInfo.name}`;
            validate = ajv.compile(rule.schemaInfo.schema);
        } catch (err) {
            console.warn(`Warning: Failed to compile schema '${rule.schemaInfo.name}': ${err.message}`);
            warningCount++;
            continue;
        } finally {
            ajvContext = '';
        }

        checkedCount++;
        const valid = validate(data);
        if (valid) {
            console.log(`OK: ${path.relative(process.cwd(), filePath)} ✓`);
        } else {
            console.warn(`Warning: ${path.relative(process.cwd(), filePath)} does not conform to ${rule.schemaInfo.name}`);
            if (validate.errors && validate.errors.length) {
                for (const err of validate.errors) {
                    const instancePath = err.instancePath || '(root)';
                    console.warn(`  - ${instancePath} ${err.message || ''}`.trim());
                }
            }
            warningCount++;
        }
    }
}

console.log(`\nValidation completed. Files checked: ${checkedCount}. Warnings: ${warningCount}.`);
if (warningCount > 0 && !allowWarnings) {
    console.log('Validation failed because warnings were reported. Pass --allow-warnings to skip failing.');
}
process.exit(warningCount > 0 && !allowWarnings ? 1 : 0);
