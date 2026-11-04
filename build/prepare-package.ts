/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and Zixiao Laboratories. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs = require('fs');
import path = require('path');
import { REPO_ROOT } from './utils';

// Git dependencies are packed from the repository root, whereas the upstream
// release build writes to out/monaco-editor. Never commit generated bundles.
// The explicit package.json files list includes these ignored build products.
for (const name of ['esm', 'dev', 'min', 'monaco.d.ts']) {
	fs.rmSync(path.join(REPO_ROOT, name), { recursive: true, force: true });
	fs.cpSync(path.join(REPO_ROOT, 'out/monaco-editor', name), path.join(REPO_ROOT, name), {
		recursive: true
	});
}

const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
for (const entry of [manifest.exports['.'].types, manifest.exports['.'].import, manifest.exports['.'].require]) {
	if (!fs.existsSync(path.join(REPO_ROOT, entry))) {
		throw new Error(`Missing prepared Monaco entry point: ${entry}`);
	}
}
