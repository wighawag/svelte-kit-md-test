import preprocess from 'svelte-preprocess';
import adapter_ipfs from 'sveltejs-adapter-ipfs';

import {mdsvex} from 'mdsvex';
import remarkGFM from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkUnwrapImages from 'remark-unwrap-images';
import remarkWikiLinks from 'remark-wiki-link';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import rehypeMathJax from 'rehype-mathjax';

import {execSync} from 'child_process';
import {rehypeFOAMSvelteKit, setupPermalLinkToHref} from 'foam-svelte-kit';

let VERSION = Date.now();
try {
VERSION = execSync('git rev-parse --short HEAD', {stdio: 'ignore'}).toString().trim();
// eslint-disable-next-line no-empty
} catch(e) {}

let outputFolder = './build';

const pages = 'foam-pages';
const assets = 'static';

const {permalinks, hrefTemplate} = setupPermalLinkToHref({pages, assets});

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [
		preprocess(),
		mdsvex({
			extensions: ['.md'],
			remarkPlugins: [
				remarkMath,
				remarkGFM,
				[
					remarkWikiLinks,
					{
						permalinks,
						hrefTemplate,
						wikiLinkClassName: 'internal wikilink'
					}
				],
				remarkUnwrapImages,
			],
			rehypePlugins: [
				rehypeMathJax,
				rehypeSlug,
				rehypeAutolinkHeadings,
				[
					rehypeFOAMSvelteKit,
					{pages, assets}
				]
			],
	  	})
	],
	kit: {
		files: {
			routes: pages,
			template: 'template.html',
			assets: assets
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
