
import preprocess from 'svelte-preprocess';
import adapter_ipfs from 'sveltejs-adapter-ipfs';

import {mdsvex} from 'mdsvex';
import remarkGFM from 'remark-gfm';
import remarkUnwrapImages from 'remark-unwrap-images';
import remarkWikiLinks from 'remark-wiki-link';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';

import {execSync} from 'child_process';

import fs from 'fs';
import path from 'path';
function listFolder(dir, files=[]) {
	fs.readdirSync(dir).forEach(f => {
		let dirPath = path.join(dir, f);
		let isDirectory = fs.statSync(dirPath).isDirectory();
		isDirectory
		? listFolder(dirPath, files)
		: files.push(path.join(dir, f));
	});
	return files;
}


const pages = 'pages';
const filepaths = listFolder(pages);
const pagePaths = filepaths.map(v => v.replace(/.md$/, '').replace(`${pages}/`, ''));
const permalinks = [];
const permalinkMap = {};
for (const pagepath of pagePaths) {
	// console.log({pagepath})
	const splitted = pagepath.split('/');
	for (let i = 1; i <= splitted.length; i++) {
		const permalink = splitted.slice(splitted.length - i).join('/');
		const existingPagePath = permalinkMap[permalink];
		let toRegister = true;
		if (existingPagePath) {
			const existingSpliited = existingPagePath.split('/');
			if (existingSpliited.length >= splitted.length) {
				toRegister = true;
			} else {
				toRegister = false;
			}
		}
		if (toRegister) {
			// console.log(`register: ${permalink} => ${pagepath}`);
			permalinkMap[permalink] = pagepath;
			permalinks.push(permalink);
		}
		
	}
}


let VERSION = Date.now();
try {
VERSION = execSync('git rev-parse --short HEAD', {stdio: 'ignore'}).toString().trim();
// eslint-disable-next-line no-empty
} catch(e) {}

let outputFolder = './build';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [
		preprocess(),
		mdsvex({
			extensions: ['.md'],
			remarkPlugins: [
				remarkGFM,
				[
					remarkWikiLinks,
					{
						permalinks,
						hrefTemplate(permalink) {
							// if (!permalinkMap[permalink]) {
							// 	console.error(`not found ${permalink}`)
							// }
							const pagepath = permalinkMap[permalink];
							if (!pagepath) {
								return ""; // make link noops
							}
							// console.log(`${permalink} => ${pagepath}`)
							if (pagepath.endsWith('/index')) {
								return pagepath.substr(0, pagepath.length - 6);
							}
							return pagepath;
						},
						wikiLinkClassName: 'internal wikilink'
					}
				],
				remarkUnwrapImages
			],
			rehypePlugins: [
				rehypeSlug,
				rehypeAutolinkHeadings,
			],
	  	})
	],

	kit: {
		files: {
			routes: pages,
			template: 'template.html'
		},
		adapter: adapter_ipfs({
		  assets: outputFolder,
		  pages: outputFolder,
		//   removeSourceMap: true,
		//   copyBeforeSourceMapRemoval: 'release',
		  removeBuiltInServiceWorkerRegistration: true,
		  injectPagesInServiceWorker: true,
		  injectDebugConsole: true,
		}),
		target: '#svelte',
		trailingSlash: 'ignore',
		vite: {
		  build: {
			sourcemap: true,
		  },
		  define: {
			__VERSION__: JSON.stringify(VERSION),
		  },
		},
	  },
};

export default config;
